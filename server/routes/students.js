// server/routes/students.js
const express = require("express");
const { transact, load } = require("../db");
const { newId, generatePassword } = require("../utils/ids");
const { adminStudent, publicStudent } = require("../utils/serialize");
const { requireAdmin, requireAdminOrOwningParent } = require("../middleware/auth");

const router = express.Router();

function nextRollNo(students, className) {
  const rolls = students
    .filter((s) => s.className === className)
    .map((s) => s.rollNo);
  return rolls.length ? Math.max(...rolls) + 1 : 1;
}

// GET /api/students/classes - list distinct classes with a headcount (admin only)
router.get("/classes", requireAdmin, (req, res) => {
  const db = load();
  const counts = {};
  for (const s of db.students) {
    counts[s.className] = (counts[s.className] || 0) + 1;
  }
  const classes = Object.keys(counts)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((className) => ({ className, count: counts[className] }));
  res.json({ classes });
});

// GET /api/students?class=5 - list students, optionally filtered by class (admin only)
router.get("/", requireAdmin, (req, res) => {
  const db = load();
  let students = db.students;
  if (req.query.class) {
    students = students.filter((s) => s.className === req.query.class);
  }
  students = [...students].sort((a, b) => a.rollNo - b.rollNo);
  res.json({ students: students.map(adminStudent) });
});

// GET /api/students/:id - admin sees full record, owning parent sees the public view
router.get("/:id", requireAdminOrOwningParent, (req, res) => {
  const db = load();
  const student = db.students.find((s) => s.id === req.params.id);
  if (!student) return res.status(404).json({ error: "Student not found." });
  const isAdmin = req.session.role === "admin";
  res.json({ student: isAdmin ? adminStudent(student) : publicStudent(student) });
});

// POST /api/students - create a student. Roll number and password are always
// generated server-side; nothing the client sends can override them.
router.post("/", requireAdmin, async (req, res) => {
  const { firstName, lastName, className, guardianName } = req.body || {};
  if (!firstName || !lastName || !className || !guardianName) {
    return res.status(400).json({
      error: "First name, last name, class, and parent/guardian name are all required.",
    });
  }

  const student = await transact((db) => {
    const rollNo = nextRollNo(db.students, String(className).trim());
    const record = {
      id: newId("stu"),
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      className: String(className).trim(),
      guardianName: String(guardianName).trim(),
      rollNo,
      password: generatePassword(8),
      createdAt: new Date().toISOString(),
    };
    db.students.push(record);
    return record;
  });

  res.status(201).json({ student: adminStudent(student) });
});

// PUT /api/students/:id - edit details. Roll number is only recomputed if
// the class actually changes (so editing a name doesn't reshuffle rolls).
router.put("/:id", requireAdmin, async (req, res) => {
  const { firstName, lastName, className, guardianName } = req.body || {};

  const result = await transact((db) => {
    const student = db.students.find((s) => s.id === req.params.id);
    if (!student) return { notFound: true };

    if (firstName) student.firstName = String(firstName).trim();
    if (lastName) student.lastName = String(lastName).trim();
    if (guardianName) student.guardianName = String(guardianName).trim();

    if (className && String(className).trim() !== student.className) {
      const newClassName = String(className).trim();
      student.className = newClassName;
      student.rollNo = nextRollNo(db.students, newClassName);
    }
    return { student };
  });

  if (result.notFound) return res.status(404).json({ error: "Student not found." });
  res.json({ student: adminStudent(result.student) });
});

// POST /api/students/:id/reset-password - issue a brand new password,
// e.g. if a parent has genuinely lost it and wants a fresh one.
router.post("/:id/reset-password", requireAdmin, async (req, res) => {
  const result = await transact((db) => {
    const student = db.students.find((s) => s.id === req.params.id);
    if (!student) return { notFound: true };
    student.password = generatePassword(8);
    return { student };
  });
  if (result.notFound) return res.status(404).json({ error: "Student not found." });
  res.json({ student: adminStudent(result.student) });
});

// DELETE /api/students/:id - also cleans up their attendance/marks/fees records.
router.delete("/:id", requireAdmin, async (req, res) => {
  const result = await transact((db) => {
    const idx = db.students.findIndex((s) => s.id === req.params.id);
    if (idx === -1) return { notFound: true };
    db.students.splice(idx, 1);
    db.attendance = db.attendance.filter((a) => a.studentId !== req.params.id);
    db.marks = db.marks.filter((m) => m.studentId !== req.params.id);
    db.fees = db.fees.filter((f) => f.studentId !== req.params.id);
    return { ok: true };
  });
  if (result.notFound) return res.status(404).json({ error: "Student not found." });
  res.json({ ok: true });
});

module.exports = router;

// server/routes/attendance.js
const express = require("express");
const { transact, load } = require("../db");
const { newId } = require("../utils/ids");
const { requireAdmin, requireAdminOrOwningParent } = require("../middleware/auth");

const router = express.Router({ mergeParams: true });

const VALID_STATUSES = ["present", "absent", "late"];

// POST /api/students/:id/attendance  { date: "2026-09-17", status: "present" }
// Upserts - marking the same date twice just overwrites the status.
router.post("/", requireAdmin, async (req, res) => {
  const { date, status } = req.body || {};
  if (!date || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: "A date and a valid status (present/absent/late) are required." });
  }

  const result = await transact((db) => {
    const student = db.students.find((s) => s.id === req.params.id);
    if (!student) return { notFound: true };

    let record = db.attendance.find((a) => a.studentId === req.params.id && a.date === date);
    if (record) {
      record.status = status;
    } else {
      record = { id: newId("att"), studentId: req.params.id, date, status };
      db.attendance.push(record);
    }
    return { record };
  });

  if (result.notFound) return res.status(404).json({ error: "Student not found." });
  res.status(201).json({ record: result.record });
});

// DELETE /api/students/:id/attendance/:recordId
router.delete("/:recordId", requireAdmin, async (req, res) => {
  const result = await transact((db) => {
    const idx = db.attendance.findIndex(
      (a) => a.id === req.params.recordId && a.studentId === req.params.id
    );
    if (idx === -1) return { notFound: true };
    db.attendance.splice(idx, 1);
    return { ok: true };
  });
  if (result.notFound) return res.status(404).json({ error: "Attendance record not found." });
  res.json({ ok: true });
});

// GET /api/students/:id/attendance - full history + a quick percentage, for
// either the admin or the parent who owns this student.
router.get("/", requireAdminOrOwningParent, (req, res) => {
  const db = load();
  const student = db.students.find((s) => s.id === req.params.id);
  if (!student) return res.status(404).json({ error: "Student not found." });

  const records = db.attendance
    .filter((a) => a.studentId === req.params.id)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const presentCount = records.filter((r) => r.status === "present" || r.status === "late").length;
  const percentage = records.length ? Math.round((presentCount / records.length) * 100) : null;

  res.json({ records, percentage, totalDays: records.length });
});

module.exports = router;

// server/routes/marks.js
const express = require("express");
const { transact, load } = require("../db");
const { newId } = require("../utils/ids");
const { requireAdmin, requireAdminOrOwningParent } = require("../middleware/auth");

const router = express.Router({ mergeParams: true });

// POST /api/students/:id/marks  { subject, examName, marksObtained, maxMarks }
router.post("/", requireAdmin, async (req, res) => {
  const { subject, examName, marksObtained, maxMarks } = req.body || {};
  const obtained = Number(marksObtained);
  const max = Number(maxMarks);

  if (!subject || !examName || Number.isNaN(obtained) || Number.isNaN(max) || max <= 0) {
    return res.status(400).json({
      error: "Subject, exam name, marks obtained, and max marks (a positive number) are required.",
    });
  }

  const result = await transact((db) => {
    const student = db.students.find((s) => s.id === req.params.id);
    if (!student) return { notFound: true };

    const record = {
      id: newId("mk"),
      studentId: req.params.id,
      subject: String(subject).trim(),
      examName: String(examName).trim(),
      marksObtained: obtained,
      maxMarks: max,
      date: new Date().toISOString(),
    };
    db.marks.push(record);
    return { record };
  });

  if (result.notFound) return res.status(404).json({ error: "Student not found." });
  res.status(201).json({ record: result.record });
});

// DELETE /api/students/:id/marks/:recordId
router.delete("/:recordId", requireAdmin, async (req, res) => {
  const result = await transact((db) => {
    const idx = db.marks.findIndex(
      (m) => m.id === req.params.recordId && m.studentId === req.params.id
    );
    if (idx === -1) return { notFound: true };
    db.marks.splice(idx, 1);
    return { ok: true };
  });
  if (result.notFound) return res.status(404).json({ error: "Marks record not found." });
  res.json({ ok: true });
});

// GET /api/students/:id/marks
router.get("/", requireAdminOrOwningParent, (req, res) => {
  const db = load();
  const student = db.students.find((s) => s.id === req.params.id);
  if (!student) return res.status(404).json({ error: "Student not found." });

  const records = db.marks
    .filter((m) => m.studentId === req.params.id)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const totalObtained = records.reduce((sum, r) => sum + r.marksObtained, 0);
  const totalMax = records.reduce((sum, r) => sum + r.maxMarks, 0);
  const overallPercentage = totalMax ? Math.round((totalObtained / totalMax) * 100) : null;

  res.json({ records, overallPercentage });
});

module.exports = router;

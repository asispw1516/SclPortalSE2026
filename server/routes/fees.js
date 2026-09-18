// server/routes/fees.js
const express = require("express");
const { transact, load } = require("../db");
const { newId } = require("../utils/ids");
const { requireAdmin, requireAdminOrOwningParent } = require("../middleware/auth");

const router = express.Router({ mergeParams: true });

// POST /api/students/:id/fees  { month: "2026-09", paid: true }
// Upserts the record for that month.
router.post("/", requireAdmin, async (req, res) => {
  const { month, paid } = req.body || {};
  if (!month || typeof paid !== "boolean") {
    return res.status(400).json({ error: "A month (YYYY-MM) and paid (true/false) are required." });
  }

  const result = await transact((db) => {
    const student = db.students.find((s) => s.id === req.params.id);
    if (!student) return { notFound: true };

    let record = db.fees.find((f) => f.studentId === req.params.id && f.month === month);
    if (record) {
      record.paid = paid;
      record.paidOn = paid ? new Date().toISOString() : null;
    } else {
      record = {
        id: newId("fee"),
        studentId: req.params.id,
        month,
        paid,
        paidOn: paid ? new Date().toISOString() : null,
      };
      db.fees.push(record);
    }
    return { record };
  });

  if (result.notFound) return res.status(404).json({ error: "Student not found." });
  res.status(201).json({ record: result.record });
});

// GET /api/students/:id/fees
router.get("/", requireAdminOrOwningParent, (req, res) => {
  const db = load();
  const student = db.students.find((s) => s.id === req.params.id);
  if (!student) return res.status(404).json({ error: "Student not found." });

  const records = db.fees
    .filter((f) => f.studentId === req.params.id)
    .sort((a, b) => (a.month < b.month ? 1 : -1));

  res.json({ records });
});

module.exports = router;

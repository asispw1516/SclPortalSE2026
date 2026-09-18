// server/routes/announcements.js
const express = require("express");
const { transact, load } = require("../db");
const { newId } = require("../utils/ids");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

// GET /api/announcements - public, no login required (shown on the landing page)
router.get("/", (req, res) => {
  const db = load();
  const announcements = [...db.announcements].sort((a, b) => (a.date < b.date ? 1 : -1));
  res.json({ announcements });
});

// POST /api/announcements  { title, content }
router.post("/", requireAdmin, async (req, res) => {
  const { title, content } = req.body || {};
  if (!title || !content) {
    return res.status(400).json({ error: "Title and content are required." });
  }
  const announcement = await transact((db) => {
    const record = {
      id: newId("ann"),
      title: String(title).trim(),
      content: String(content).trim(),
      date: new Date().toISOString(),
    };
    db.announcements.push(record);
    return record;
  });
  res.status(201).json({ announcement });
});

// DELETE /api/announcements/:id
router.delete("/:id", requireAdmin, async (req, res) => {
  const result = await transact((db) => {
    const idx = db.announcements.findIndex((a) => a.id === req.params.id);
    if (idx === -1) return { notFound: true };
    db.announcements.splice(idx, 1);
    return { ok: true };
  });
  if (result.notFound) return res.status(404).json({ error: "Announcement not found." });
  res.json({ ok: true });
});

module.exports = router;

// server/routes/auth.js
const express = require("express");
const bcrypt = require("bcryptjs");
const { load } = require("../db");
const { publicStudent } = require("../utils/serialize");

const router = express.Router();

function normalize(str) {
  return String(str || "").trim().toLowerCase();
}

router.post("/admin-login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }
  const db = load();
  const admin = db.admin;
  const usernameMatches = normalize(username) === normalize(admin.username);
  const passwordMatches = usernameMatches && bcrypt.compareSync(password, admin.passwordHash);

  if (!usernameMatches || !passwordMatches) {
    return res.status(401).json({ error: "Incorrect admin username or password." });
  }

  req.session.role = "admin";
  req.session.studentId = null;
  return res.json({ role: "admin" });
});

router.post("/parent-login", (req, res) => {
  const { guardianName, studentFirstName, studentLastName, className, rollNo, password } =
    req.body || {};

  if (!guardianName || !studentFirstName || !studentLastName || !className || !rollNo || !password) {
    return res.status(400).json({ error: "All fields are required." });
  }

  const db = load();
  const rollNoDigits = String(rollNo).replace(/\D/g, "");
  const rollNoNum = parseInt(rollNoDigits, 10);

  const student = db.students.find((s) => {
    return (
      normalize(s.className) === normalize(className) &&
      s.rollNo === rollNoNum &&
      normalize(s.guardianName) === normalize(guardianName) &&
      normalize(s.firstName) === normalize(studentFirstName) &&
      normalize(s.lastName) === normalize(studentLastName) &&
      s.password === password
    );
  });

  if (!student) {
    return res.status(401).json({
      error:
        "We couldn't find a matching student record. Double-check the name, class, roll number, and password.",
    });
  }

  req.session.role = "parent";
  req.session.studentId = student.id;
  return res.json({ role: "parent", student: publicStudent(student) });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

router.get("/me", (req, res) => {
  if (req.session && req.session.role === "admin") {
    return res.json({ role: "admin" });
  }
  if (req.session && req.session.role === "parent" && req.session.studentId) {
    const db = load();
    const student = db.students.find((s) => s.id === req.session.studentId);
    if (!student) {
      req.session.destroy(() => {});
      return res.json({ role: null });
    }
    return res.json({ role: "parent", student: publicStudent(student) });
  }
  return res.json({ role: null });
});

module.exports = router;

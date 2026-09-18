// server/index.js
require("dotenv").config();
const path = require("path");
const express = require("express");
const session = require("express-session");

const authRoutes = require("./routes/auth");
const studentRoutes = require("./routes/students");
const attendanceRoutes = require("./routes/attendance");
const marksRoutes = require("./routes/marks");
const feesRoutes = require("./routes/fees");
const announcementRoutes = require("./routes/announcements");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("trust proxy", 1); // Render sits behind a proxy; needed for secure cookies to work

app.use(express.json());

app.use(
  session({
    name: "connect.sid",
    secret: process.env.SESSION_SECRET || "change-this-secret-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 8, // 8 hours
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  })
);

// --- API routes ---
app.use("/api/auth", authRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/students/:id/attendance", attendanceRoutes);
app.use("/api/students/:id/marks", marksRoutes);
app.use("/api/students/:id/fees", feesRoutes);
app.use("/api/announcements", announcementRoutes);

// A student's own "me" shortcuts, so parent-facing pages don't need to know
// their own student id up front - they just call these after logging in.
// Rather than trying to splice req.params into a shared router (fragile
// with Express's param-merging), we simply redirect to the equivalent
// /api/students/:id/... URL, which the browser's fetch() follows
// transparently, cookies and all.
function meRedirect(resource) {
  return (req, res) => {
    if (!req.session || req.session.role !== "parent" || !req.session.studentId) {
      return res.status(401).json({ error: "Parent login required" });
    }
    res.redirect(307, `/api/students/${req.session.studentId}/${resource}`);
  };
}
app.get("/api/me/attendance", meRedirect("attendance"));
app.get("/api/me/marks", meRedirect("marks"));
app.get("/api/me/fees", meRedirect("fees"));

// --- Static frontend ---
app.use(express.static(path.join(__dirname, "..", "public")));

// Fallback 404 for unknown API routes (keep this after static + API mounts)
app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));

app.listen(PORT, () => {
  console.log(`School portal running on http://localhost:${PORT}`);
});

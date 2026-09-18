// server/middleware/auth.js

function requireAdmin(req, res, next) {
  if (req.session && req.session.role === "admin") {
    return next();
  }
  return res.status(401).json({ error: "Admin login required" });
}

function requireParent(req, res, next) {
  if (req.session && req.session.role === "parent" && req.session.studentId) {
    return next();
  }
  return res.status(401).json({ error: "Parent login required" });
}

// Allows either an admin, or the parent who owns the given student.
// Expects req.params.studentId (or .id) to identify the student being accessed.
function requireAdminOrOwningParent(req, res, next) {
  const targetId = req.params.studentId || req.params.id;
  if (req.session && req.session.role === "admin") return next();
  if (
    req.session &&
    req.session.role === "parent" &&
    req.session.studentId === targetId
  ) {
    return next();
  }
  return res.status(401).json({ error: "Not authorized" });
}

module.exports = { requireAdmin, requireParent, requireAdminOrOwningParent };

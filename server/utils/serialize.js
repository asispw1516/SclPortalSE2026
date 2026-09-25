// server/utils/serialize.js
const { formatRollNo } = require("./ids");

// What a parent (or the "me" endpoint) is allowed to see about their child.
// Deliberately omits the password - a logged-in parent already proved they
// know it, and the admin panel is the place to look it up again.
function publicStudent(s) {
  return {
    id: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
    className: s.className,
    rollNo: s.rollNo,
    rollNoDisplay: formatRollNo(s.rollNo),
    guardianName: s.guardianName,
    guardianEmail: s.guardianEmail || "",
    initials: `${(s.firstName || " ")[0]}${(s.lastName || " ")[0]}`.toUpperCase(),
    createdAt: s.createdAt,
  };
}

// What the admin panel is allowed to see - includes the password, since
// the whole point is the office can look it up if a parent forgets it.
function adminStudent(s) {
  return {
    ...publicStudent(s),
    password: s.password,
  };
}

module.exports = { publicStudent, adminStudent };

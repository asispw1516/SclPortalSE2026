// server/utils/ids.js
const crypto = require("crypto");

function newId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

// Characters chosen to avoid look-alikes (0/O, 1/I/l) since a human
// (the admin, then the parent) has to read and retype this password.
const PASSWORD_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

function generatePassword(length = 8) {
  let out = "";
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    out += PASSWORD_CHARS[bytes[i] % PASSWORD_CHARS.length];
  }
  return out;
}

// Zero-pads a class-local roll number to 8 digits, e.g. 5 -> "00000005"
function formatRollNo(n) {
  return String(n).padStart(8, "0");
}

module.exports = { newId, generatePassword, formatRollNo };

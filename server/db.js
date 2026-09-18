// server/db.js
//
// A small file-backed JSON "database". We use this instead of a native
// SQL driver (like better-sqlite3) so the project installs with plain
// `npm install` on any host, including Render's free build environment,
// with no C++ toolchain required.
//
// IMPORTANT (read this before deploying): Render's free web services have
// an EPHEMERAL filesystem - anything written to disk is wiped on every
// restart/redeploy. This file store will work perfectly during local
// development and for demos, but for real persistent data in production
// you need either:
//   (a) a paid Render instance with a Persistent Disk mounted at DATA_DIR, or
//   (b) migrate storage to Render's managed Postgres (see README "Going further").
// See the README for details.

const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123"; // change via env var in production!

function emptyDb() {
  return {
    admin: {
      username: ADMIN_USERNAME,
      passwordHash: bcrypt.hashSync(ADMIN_PASSWORD, 10),
    },
    students: [],
    attendance: [],
    marks: [],
    fees: [],
    announcements: [
      {
        id: "seed-announcement-1",
        title: "Welcome to the new Parent Portal",
        content:
          "You can now check your child's attendance, marks, and fee status online. Admin login and student records are managed by the school office.",
        date: new Date().toISOString(),
      },
    ],
  };
}

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(emptyDb(), null, 2));
  }
}

function load() {
  ensureDb();
  const raw = fs.readFileSync(DB_FILE, "utf-8");
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error("db.json is corrupted: " + err.message);
  }
}

// Writes are queued so two requests arriving at the same moment cannot
// interleave their read-modify-write cycles and clobber each other.
let writeQueue = Promise.resolve();

function save(data) {
  writeQueue = writeQueue.then(
    () =>
      new Promise((resolve, reject) => {
        const tmpFile = DB_FILE + ".tmp";
        fs.writeFile(tmpFile, JSON.stringify(data, null, 2), (err) => {
          if (err) return reject(err);
          fs.rename(tmpFile, DB_FILE, (err2) => {
            if (err2) return reject(err2);
            resolve();
          });
        });
      })
  );
  return writeQueue;
}

// Convenience helper: load the db, let `mutator` change it in place,
// then persist and return whatever `mutator` returns.
async function transact(mutator) {
  const data = load();
  const result = mutator(data);
  await save(data);
  return result;
}

module.exports = { load, save, transact, DB_FILE, DATA_DIR };

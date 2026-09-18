# Greenfield School Portal

A parent/admin school portal: a landing "Parent Dashboard" with announcements
and two logins, an admin panel for managing students, attendance, marks and
fees, and parent-facing pages to check on a child's record.

## What changed from the original static version

The original project was flat HTML/CSS/JS with no backend, so data
couldn't be shared between the admin's computer and a parent's phone. This
version adds a small **Node.js/Express server** with a real, shared data
store, while keeping the same page names you already had:

```
school-portal/
├── server/                  # Express API + data store (new)
│   ├── index.js             # app entry point
│   ├── db.js                # JSON file "database" + seed data
│   ├── middleware/auth.js   # session guards (admin / parent)
│   ├── utils/                # id + password generation, serialization
│   └── routes/               # auth, students, attendance, marks, fees, announcements
├── public/                  # everything the browser loads (served by Express)
│   ├── index.html           # Parent Dashboard (landing page)
│   ├── admin.html           # Admin dashboard
│   ├── profile.html         # Student Dashboard (parent view)
│   ├── attendance.html
│   ├── grades.html          # Marks
│   ├── fees.html
│   ├── announcements.html
│   ├── manageStudents.html  # kept for continuity; redirects into admin.html,
│   │                        #   since "manage students" is now a section there
│   ├── css/style.css
│   └── js/                  # one script per page, plus shared api.js / auth-guard.js
├── data/                    # db.json is created here at runtime (gitignored)
├── package.json
├── render.yaml               # one-click Render Blueprint
└── .env.example
```

## Why a JSON file instead of a SQL database

The server uses a small file-backed JSON store (`server/db.js`) instead of
a native database driver like `better-sqlite3` or `pg`. That's a deliberate
choice for this project: it needs **zero native compilation**, so
`npm install` just works on Render's build environment (and anywhere else)
with no extra build tools. It's a real server-side database in the sense
that matters here — one process, one file, shared by every admin and every
parent, updated through the API, not a per-browser trick like
`localStorage`.

**Important limitation to know about before you rely on this in production:**
Render's **free** web services have an *ephemeral filesystem* — anything
written to disk (including `data/db.json`) is wiped every time the service
restarts or redeploys. For a class demo or local use this is invisible; for
a real school running this day to day, you have two upgrade paths once
you're ready:

1. **Attach a Persistent Disk** (Render feature on paid instance types),
   mount it at e.g. `/var/data`, and set `DATA_DIR=/var/data`. No code
   changes needed — `db.js` already reads `DATA_DIR` from the environment.
2. **Migrate to Render's managed Postgres.** This needs code changes in
   `server/db.js` and the route files (swap the JSON read/write calls for
   SQL queries) — a natural next step, but out of scope for this pass.

## Running locally

```bash
npm install
cp .env.example .env      # then edit ADMIN_PASSWORD and SESSION_SECRET
npm start
```

Visit `http://localhost:3000`. The default admin login is whatever you set
in `.env` (`admin` / `admin123` if you don't change it — **do change it**).

## Deploying to Render

1. Push this project to a GitHub repo (keep the structure as-is).
2. On Render: **New → Web Service** → connect the repo. Render will detect
   `render.yaml` and prefill the settings, or set them manually:
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Environment variables:** `ADMIN_USERNAME`, `ADMIN_PASSWORD`,
     `SESSION_SECRET` (a long random string), `NODE_ENV=production`
3. Deploy. Your app (frontend + API) is served from the same URL — no
   separate static site needed anymore, since the frontend is now served
   *by* the Express server (see `app.use(express.static(...))` in
   `server/index.js`).

## How the data flows

- **Admission (in person):** you collect the student's and parent's
  details, then add the student from the **Admin Dashboard**. The roll
  number (auto-incrementing *within that class only*) and an 8-character
  password are generated automatically and shown once in a copyable box —
  write that down and hand it to the parent.
- **Day to day:** from the admin panel you record attendance, add marks,
  and mark a month's fee as paid, per student.
- **Parents:** they log in on the landing page with their name, the
  student's name, class, roll number, and the password you gave them. Once
  in, they see the student's profile, fees, attendance and marks — all
  read from the same data the admin panel writes to.
- **Announcements:** posted from the admin panel, visible to everyone
  (even logged-out visitors) on the landing page and the full
  announcements page.

## Security notes (for a school project — be aware, not necessarily blockers)

- Session cookies are `httpOnly` and (in production) `secure`, backed by
  `express-session`'s default in-memory store. That's fine for a small
  single-instance app; a restart logs everyone out, which matches the
  filesystem's own ephemeral behavior on Render's free tier.
- Student passwords are stored in **plain text** by design — the whole
  point is the admin can look one up and read it back to a parent who
  forgot it. Keep the admin login itself strong, since that's what
  protects the list.
- The admin password is hashed with bcrypt; change `ADMIN_PASSWORD` before
  you actually use this with real students.

## Things intentionally left simple / left out

- **Student photo:** the UI shows an initials avatar instead of an actual
  uploaded photo — there was no upload mechanism in the original spec.
  Adding real photo upload/storage is a reasonable next step.
- **Real-time push updates:** parents/admins see current data on page
  load/refresh, not via WebSockets. For a small school portal this is
  simpler and sufficient; add polling or WebSockets later if needed.

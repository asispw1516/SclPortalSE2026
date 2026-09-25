// public/js/admin.js

let currentClass = null;
let currentStudentId = null; // used by attendance/marks/fees modals

function openModal(id) {
  document.getElementById(id).classList.remove("hidden");
}
function closeModal(id) {
  document.getElementById(id).classList.add("hidden");
}
document.querySelectorAll("[data-close-modal]").forEach((btn) => {
  btn.addEventListener("click", () => closeModal(btn.dataset.closeModal));
});
document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) backdrop.classList.add("hidden");
  });
});

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ----------------------------- Classes & students ----------------------------- */

async function loadClasses(selectAfter) {
  const data = await api("/students/classes");
  const wrap = document.getElementById("class-chips");

  if (!data.classes.length) {
    wrap.innerHTML = `<span class="muted">No classes yet — add your first student to get started.</span>`;
    document.getElementById("students-body").innerHTML =
      `<tr><td colspan="6" class="spinner-note">Select a class above to see its students.</td></tr>`;
    currentClass = null;
    return;
  }

  if (!currentClass || !data.classes.some((c) => c.className === currentClass)) {
    currentClass = selectAfter || data.classes[0].className;
  }

  wrap.innerHTML = data.classes
    .map(
      (c) => `<button type="button" class="class-chip ${c.className === currentClass ? "active" : ""}" data-class="${escapeHtml(c.className)}">
        Class ${escapeHtml(c.className)} <span class="muted">(${c.count})</span>
      </button>`
    )
    .join("");

  wrap.querySelectorAll(".class-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      currentClass = chip.dataset.class;
      wrap.querySelectorAll(".class-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      loadStudents();
    });
  });

  await loadStudents();
}

async function loadStudents() {
  const body = document.getElementById("students-body");
  if (!currentClass) return;
  body.innerHTML = `<tr><td colspan="6" class="spinner-note">Loading…</td></tr>`;

  const data = await api(`/students?class=${encodeURIComponent(currentClass)}`);
  if (!data.students.length) {
    body.innerHTML = `<tr><td colspan="6"><div class="empty-note">No students in this class yet.</div></td></tr>`;
    return;
  }

  // Fetch this-month fee status for every student in parallel.
  const feesByStudent = await Promise.all(
    data.students.map((s) => api(`/students/${s.id}/fees`).catch(() => ({ records: [] })))
  );

  body.innerHTML = data.students
    .map((s, i) => {
      const thisMonth = feesByStudent[i].records.find((f) => f.month === currentMonthKey());
      const feeBadge =
        thisMonth && thisMonth.paid
          ? '<span class="badge badge-pine">Paid</span>'
          : '<span class="badge badge-brick">Due</span>';
      return `
      <tr data-id="${s.id}">
        <td class="roll-no">${escapeHtml(s.rollNoDisplay)}</td>
        <td>${escapeHtml(s.firstName)} ${escapeHtml(s.lastName)}</td>
        <td>${escapeHtml(s.guardianName)}${s.guardianEmail ? `<br /><span class="muted" style="font-size:12px;">${escapeHtml(s.guardianEmail)}</span>` : ""}</td>
        <td>${feeBadge}</td>
        <td><code>${escapeHtml(s.password)}</code></td>
        <td>
          <div class="row-actions">
            <button class="btn btn-outline btn-sm" data-action="attendance">Attendance</button>
            <button class="btn btn-outline btn-sm" data-action="marks">Marks</button>
            <button class="btn btn-outline btn-sm" data-action="fees">Fees</button>
            <button class="btn btn-ghost btn-sm" data-action="edit">Edit</button>
            <button class="btn btn-danger btn-sm" data-action="delete">Delete</button>
          </div>
        </td>
      </tr>`;
    })
    .join("");

  const studentsById = Object.fromEntries(data.students.map((s) => [s.id, s]));

  body.querySelectorAll("tr[data-id]").forEach((row) => {
    const id = row.dataset.id;
    const student = studentsById[id];
    row.querySelector('[data-action="attendance"]').addEventListener("click", () => openAttendanceModal(student));
    row.querySelector('[data-action="marks"]').addEventListener("click", () => openMarksModal(student));
    row.querySelector('[data-action="fees"]').addEventListener("click", () => openFeesModal(student));
    row.querySelector('[data-action="edit"]').addEventListener("click", () => openEditStudentModal(student));
    row.querySelector('[data-action="delete"]').addEventListener("click", () => deleteStudent(student));
  });
}

/* ----------------------------- Add / edit / delete student ----------------------------- */

document.getElementById("open-add-student").addEventListener("click", () => {
  document.getElementById("add-student-form").reset();
  document.getElementById("add-student-error").innerHTML = "";
  openModal("add-student-modal");
});

document.getElementById("add-student-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const errBox = document.getElementById("add-student-error");
  errBox.innerHTML = "";
  const submitBtn = form.querySelector("button[type=submit]");
  submitBtn.disabled = true;
  try {
    const data = await api("/students", {
      method: "POST",
      body: {
        firstName: form.firstName.value,
        lastName: form.lastName.value,
        className: form.studentClass.value,
        guardianName: form.guardianName.value,
        guardianEmail: form.guardianEmail.value,
      },
    });
    closeModal("add-student-modal");
    showCredentials(data.student);
    await loadClasses(data.student.className);
  } catch (err) {
    errBox.innerHTML = `<div class="form-error">${escapeHtml(err.message)}</div>`;
  } finally {
    submitBtn.disabled = false;
  }
});

function showCredentials(student) {
  document.getElementById("credentials-content").innerHTML = `
    <div class="id-card" style="margin-bottom:14px;">
      <div class="id-card__avatar">${escapeHtml(student.initials)}</div>
      <div>
        <div class="id-card__name">${escapeHtml(student.firstName)} ${escapeHtml(student.lastName)}</div>
        <div class="id-card__meta"><span><strong>Class</strong> ${escapeHtml(student.className)}</span></div>
      </div>
    </div>
    <div class="field"><label>Roll number</label>
      <div class="password-box"><code>${escapeHtml(student.rollNoDisplay)}</code></div>
    </div>
    <div class="field"><label>Password</label>
      <div class="password-box">
        <code id="new-student-password">${escapeHtml(student.password)}</code>
        <button class="btn btn-outline btn-sm" type="button" id="copy-password-btn">Copy</button>
      </div>
    </div>
  `;
  document.getElementById("copy-password-btn").addEventListener("click", () => {
    navigator.clipboard.writeText(student.password).catch(() => {});
  });
  openModal("credentials-modal");
}

function openEditStudentModal(student) {
  const form = document.getElementById("edit-student-form");
  form.studentId.value = student.id;
  form.firstName.value = student.firstName;
  form.lastName.value = student.lastName;
   form.studentClass.value = student.className;
  form.guardianName.value = student.guardianName;
  form.guardianEmail.value = student.guardianEmail || "";
  document.getElementById("edit-student-error").innerHTML = "";
  openModal("edit-student-modal");
}

document.getElementById("edit-student-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const errBox = document.getElementById("edit-student-error");
  errBox.innerHTML = "";
  const submitBtn = form.querySelector("button[type=submit]");
  submitBtn.disabled = true;
  try {
    await api(`/students/${form.studentId.value}`, {
      method: "PUT",
          body: {
        firstName: form.firstName.value,
        lastName: form.lastName.value,
        className: form.studentClass.value,
        guardianName: form.guardianName.value,
        guardianEmail: form.guardianEmail.value,
      },
    });
    closeModal("edit-student-modal");
    await loadClasses(form.studentClass.value);
  } catch (err) {
    errBox.innerHTML = `<div class="form-error">${escapeHtml(err.message)}</div>`;
  } finally {
    submitBtn.disabled = false;
  }
});

async function deleteStudent(student) {
  const ok = confirm(`Remove ${student.firstName} ${student.lastName} (Class ${student.className}, Roll ${student.rollNoDisplay})? This also deletes their attendance, marks, and fee records.`);
  if (!ok) return;
  await api(`/students/${student.id}`, { method: "DELETE" });
  await loadClasses(currentClass);
}

/* ----------------------------- Attendance modal ----------------------------- */

async function openAttendanceModal(student) {
  currentStudentId = student.id;
  document.getElementById("attendance-modal-title").textContent =
    `Attendance — ${student.firstName} ${student.lastName} (Class ${student.className})`;
  document.getElementById("attendance-form").reset();
  document.getElementById("att-date").value = todayKey();
  document.getElementById("attendance-error").innerHTML = "";
  openModal("attendance-modal");
  await renderAttendanceHistory(student.id);
}

async function renderAttendanceHistory(studentId) {
  const body = document.getElementById("attendance-modal-body");
  body.innerHTML = `<tr><td colspan="3" class="spinner-note">Loading…</td></tr>`;
  const data = await api(`/students/${studentId}/attendance`);
  if (!data.records.length) {
    body.innerHTML = `<tr><td colspan="3"><div class="empty-note">No attendance recorded yet.</div></td></tr>`;
    return;
  }
  const badge = { present: "badge-pine", absent: "badge-brick", late: "badge-brass" };
  body.innerHTML = data.records
    .map(
      (r) => `<tr data-id="${r.id}">
        <td>${formatDateLabel(r.date)}</td>
        <td><span class="badge ${badge[r.status]}">${escapeHtml(r.status)}</span></td>
        <td><button class="btn btn-ghost btn-sm" data-remove="${r.id}">Remove</button></td>
      </tr>`
    )
    .join("");
  body.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await api(`/students/${studentId}/attendance/${btn.dataset.remove}`, { method: "DELETE" });
      renderAttendanceHistory(studentId);
    });
  });
}

document.getElementById("attendance-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const errBox = document.getElementById("attendance-error");
  errBox.innerHTML = "";
  try {
    await api(`/students/${currentStudentId}/attendance`, {
      method: "POST",
      body: { date: form.date.value, status: form.status.value },
    });
    await renderAttendanceHistory(currentStudentId);
    await loadStudents();
  } catch (err) {
    errBox.innerHTML = `<div class="form-error">${escapeHtml(err.message)}</div>`;
  }
});

/* ----------------------------- Marks modal ----------------------------- */

async function openMarksModal(student) {
  currentStudentId = student.id;
  document.getElementById("marks-modal-title").textContent =
    `Marks — ${student.firstName} ${student.lastName} (Class ${student.className})`;
  document.getElementById("marks-form").reset();
  document.getElementById("marks-error").innerHTML = "";
  openModal("marks-modal");
  await renderMarksHistory(student.id);
}

async function renderMarksHistory(studentId) {
  const body = document.getElementById("marks-modal-body");
  body.innerHTML = `<tr><td colspan="4" class="spinner-note">Loading…</td></tr>`;
  const data = await api(`/students/${studentId}/marks`);
  if (!data.records.length) {
    body.innerHTML = `<tr><td colspan="4"><div class="empty-note">No marks recorded yet.</div></td></tr>`;
    return;
  }
  body.innerHTML = data.records
    .map(
      (r) => `<tr data-id="${r.id}">
        <td>${escapeHtml(r.examName)}</td>
        <td>${escapeHtml(r.subject)}</td>
        <td class="numeric">${r.marksObtained} / ${r.maxMarks}</td>
        <td><button class="btn btn-ghost btn-sm" data-remove="${r.id}">Remove</button></td>
      </tr>`
    )
    .join("");
  body.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await api(`/students/${studentId}/marks/${btn.dataset.remove}`, { method: "DELETE" });
      renderMarksHistory(studentId);
    });
  });
}

document.getElementById("marks-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const errBox = document.getElementById("marks-error");
  errBox.innerHTML = "";
  try {
    await api(`/students/${currentStudentId}/marks`, {
      method: "POST",
      body: {
        examName: form.examName.value,
        subject: form.subject.value,
        marksObtained: form.marksObtained.value,
        maxMarks: form.maxMarks.value,
      },
    });
    form.reset();
    await renderMarksHistory(currentStudentId);
  } catch (err) {
    errBox.innerHTML = `<div class="form-error">${escapeHtml(err.message)}</div>`;
  }
});

/* ----------------------------- Fees modal ----------------------------- */

async function openFeesModal(student) {
  currentStudentId = student.id;
  document.getElementById("fees-modal-title").textContent =
    `Fees — ${student.firstName} ${student.lastName} (Class ${student.className})`;
  openModal("fees-modal");
  await renderFeesGrid(student.id);
}

async function renderFeesGrid(studentId) {
  const body = document.getElementById("fees-modal-body");
  body.innerHTML = `<tr><td colspan="2" class="spinner-note">Loading…</td></tr>`;
  const data = await api(`/students/${studentId}/fees`);
  const paidByMonth = Object.fromEntries(data.records.map((r) => [r.month, r.paid]));

  const year = new Date().getFullYear();
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);

  body.innerHTML = months
    .map((m) => {
      const paid = !!paidByMonth[m];
      return `<tr>
        <td>${formatMonthLabel(m)}</td>
        <td><label style="display:flex;align-items:center;gap:8px;">
          <input type="checkbox" data-month="${m}" ${paid ? "checked" : ""} /> ${paid ? "Paid" : "Not paid"}
        </label></td>
      </tr>`;
    })
    .join("");

  body.querySelectorAll("input[data-month]").forEach((checkbox) => {
    checkbox.addEventListener("change", async () => {
      await api(`/students/${studentId}/fees`, {
        method: "POST",
        body: { month: checkbox.dataset.month, paid: checkbox.checked },
      });
      checkbox.closest("label").lastChild.textContent = checkbox.checked ? " Paid" : " Not paid";
      loadStudents(); // refresh the "this month" badge in the table behind the modal
    });
  });
}

/* ----------------------------- Announcements ----------------------------- */

async function loadAdminAnnouncements() {
  const board = document.getElementById("admin-announcements-board");
  const data = await api("/announcements");
  if (!data.announcements.length) {
    board.innerHTML = `<div class="empty-note">No announcements yet.</div>`;
    return;
  }
  board.innerHTML = data.announcements
    .map(
      (a) => `
      <article class="board-card" data-id="${a.id}">
        <h3 class="board-card__title">${escapeHtml(a.title)}</h3>
        <p class="board-card__date">${formatDateLabel(a.date)}</p>
        <p class="board-card__body">${escapeHtml(a.content)}</p>
        <div class="board-card__actions">
          <button class="btn btn-danger btn-sm" data-remove-announcement="${a.id}">Delete</button>
        </div>
      </article>`
    )
    .join("");

  board.querySelectorAll("[data-remove-announcement]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await api(`/announcements/${btn.dataset.removeAnnouncement}`, { method: "DELETE" });
      loadAdminAnnouncements();
    });
  });
}

document.getElementById("open-add-announcement").addEventListener("click", () => {
  document.getElementById("add-announcement-form").reset();
  document.getElementById("add-announcement-error").innerHTML = "";
  openModal("add-announcement-modal");
});

document.getElementById("add-announcement-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const errBox = document.getElementById("add-announcement-error");
  errBox.innerHTML = "";
  try {
    await api("/announcements", {
      method: "POST",
      body: { title: form.title.value, content: form.content.value },
    });
    closeModal("add-announcement-modal");
    loadAdminAnnouncements();
  } catch (err) {
    errBox.innerHTML = `<div class="form-error">${escapeHtml(err.message)}</div>`;
  }
});

/* ----------------------------- Init ----------------------------- */

(async function init() {
  const me = await requireAdminOrRedirect();
  if (!me) return;
  wireLogout(document.getElementById("logout-btn"));
  await loadClasses();
  await loadAdminAnnouncements();
})();

// public/js/index.js

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

function renderAnnouncements(announcements) {
  const board = document.getElementById("announcements-board");
  if (!announcements.length) {
    board.innerHTML = `<div class="empty-note">No announcements yet. Check back soon.</div>`;
    return;
  }
  board.innerHTML = announcements
    .map(
      (a) => `
      <article class="board-card">
        <h3 class="board-card__title">${escapeHtml(a.title)}</h3>
        <p class="board-card__date">${formatDateLabel(a.date)}</p>
        <p class="board-card__body">${escapeHtml(a.content)}</p>
      </article>`
    )
    .join("");
}

async function loadAnnouncements() {
  try {
    const data = await api("/announcements");
    renderAnnouncements(data.announcements);
  } catch (e) {
    document.getElementById("announcements-board").innerHTML =
      `<div class="empty-note">Couldn't load announcements right now.</div>`;
  }
}

function renderHeaderForParent(student) {
  document.getElementById("header-actions").innerHTML = `
    <span class="header-identity">Welcome, ${escapeHtml(student.guardianName)}</span>
    <button class="btn btn-outline btn-sm" id="logout-btn" type="button">Log out</button>
  `;
  wireLogout(document.getElementById("logout-btn"));
}

async function initSession() {
  const me = await api("/auth/me");
  if (me.role === "admin") {
    window.location.href = "admin.html";
    return;
  }
  if (me.role === "parent") {
    document.getElementById("logged-out-section").classList.add("hidden");
    document.getElementById("logged-in-section").classList.remove("hidden");
    document.getElementById("page-sub").textContent =
      "Here's a quick way to check on your child's day-to-day record.";
    renderHeaderForParent(me.student);
  }
}

document.getElementById("open-admin-login").addEventListener("click", () => openModal("admin-modal"));
document.getElementById("open-parent-login").addEventListener("click", () => openModal("parent-modal"));

document.getElementById("admin-login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const errBox = document.getElementById("admin-login-error");
  errBox.innerHTML = "";
  const submitBtn = form.querySelector("button[type=submit]");
  submitBtn.disabled = true;
  try {
    await api("/auth/admin-login", {
      method: "POST",
      body: { username: form.username.value, password: form.password.value },
    });
    window.location.href = "admin.html";
  } catch (err) {
    errBox.innerHTML = `<div class="form-error">${escapeHtml(err.message)}</div>`;
    submitBtn.disabled = false;
  }
});

document.getElementById("parent-login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const errBox = document.getElementById("parent-login-error");
  errBox.innerHTML = "";
  const submitBtn = form.querySelector("button[type=submit]");
  submitBtn.disabled = true;
  try {
    await api("/auth/parent-login", {
      method: "POST",
      body: {
        guardianName: form.guardianName.value,
        studentFirstName: form.studentFirstName.value,
        studentLastName: form.studentLastName.value,
        className: form.studentClass.value,
        rollNo: form.rollNo.value,
        password: form.password.value,
      },
    });
    window.location.href = "index.html";
  } catch (err) {
    errBox.innerHTML = `<div class="form-error">${escapeHtml(err.message)}</div>`;
    submitBtn.disabled = false;
  }
});

loadAnnouncements();
initSession();

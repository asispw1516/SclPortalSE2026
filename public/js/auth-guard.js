// public/js/auth-guard.js

async function requireAdminOrRedirect() {
  try {
    const me = await api("/auth/me");
    if (me.role !== "admin") {
      window.location.href = "index.html";
      return null;
    }
    return me;
  } catch (e) {
    window.location.href = "index.html";
    return null;
  }
}

async function requireParentOrRedirect() {
  try {
    const me = await api("/auth/me");
    if (me.role !== "parent") {
      window.location.href = "index.html";
      return null;
    }
    return me.student;
  } catch (e) {
    window.location.href = "index.html";
    return null;
  }
}

function wireLogout(buttonEl) {
  if (!buttonEl) return;
  buttonEl.addEventListener("click", async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch (e) {
      /* ignore - redirect regardless */
    }
    window.location.href = "index.html";
  });
}

function initials(firstName, lastName) {
  return `${(firstName || " ")[0]}${(lastName || " ")[0]}`.toUpperCase();
}

function formatMonthLabel(monthStr) {
  // "2026-09" -> "September 2026"
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

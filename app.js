console.log("PRO CODE GENERATOR Loaded");

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  Replace with your deployed Google Apps Script Web App URL
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycby2G8Q8JLi2cfiyXITFHaxkyCR10eZ-UGxU3SrSsGNRtZZv6WpDQrWi7Pez8rgP7CaHnw/exec";

// â”€â”€â”€ Auth gate â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const currentUser = PCGAuth.requireLogin();
if (!currentUser) { throw new Error("Redirect to login."); }

// Populate user info in the sidebar
(function applyUserSession() {
  const usernameEl = document.getElementById("sidebarUsername");
  const roleEl     = document.getElementById("sidebarRole");
  const avatarEl   = document.getElementById("sidebarAvatar");

  if (usernameEl) usernameEl.textContent = currentUser.username;
  if (roleEl)     roleEl.textContent     = currentUser.role;
  if (avatarEl)   avatarEl.textContent   = (currentUser.username || "?")[0].toUpperCase();

  document.body.setAttribute("data-role", (currentUser.role || "").toLowerCase());
})();

// â”€â”€â”€ Admin Panel icon visibility â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Show the Admin Panel nav icon ONLY for admin and author roles
(function applyAdminNavVisibility() {
  const adminNavLink = document.querySelector("nav a.nav-admin[data-page='page-admin']");
  if (adminNavLink) {
    if (PCGAuth.isAdminOrAuthor()) {
      adminNavLink.style.display = "flex";
    } else {
      adminNavLink.style.display = "none";
    }
  }
})();

// â”€â”€â”€ Role-based nav & page redirection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Named so it can be re-called after a live permission refresh.
function applyNavVisibility() {
  const allowedPages = {
    dashboard: PCGAuth.can("dashboard"),
    form:      PCGAuth.can("form"),
    reports:   PCGAuth.can("reports"),
    settings:  PCGAuth.can("settings"),
    admin:     PCGAuth.can("admin")
  };

  const navLinks = {
    dashboard: document.querySelector("nav a[data-page='page-dashboard']"),
    form:      document.querySelector("nav a[data-page='page-form']"),
    reports:   document.querySelector("nav a[data-page='page-reports']"),
    settings:  document.querySelector("nav a[data-page='page-settings']"),
    admin:     document.querySelector("nav a[data-page='page-admin']")
  };

  // Hide/Show nav links based on role permissions
  // (admin link visibility is handled separately above)
  for (const [page, link] of Object.entries(navLinks)) {
    if (link && page !== "admin") {
      link.style.display = allowedPages[page] ? "flex" : "none";
    }
  }

  const pageOrder = ["dashboard", "reports", "form", "settings", "admin"];
  let firstAllowedPage = null;
  for (const p of pageOrder) {
    if (allowedPages[p]) {
      firstAllowedPage = p;
      break;
    }
  }

  const activePageDiv = document.querySelector(".page.page-active");
  let currentPageId  = activePageDiv ? activePageDiv.id : "page-dashboard";
  let currentPageKey = currentPageId.replace("page-", "");

  if (!allowedPages[currentPageKey] && firstAllowedPage) {
    document.querySelectorAll(".page").forEach(p => p.classList.remove("page-active"));
    document.querySelectorAll("nav a").forEach(l => l.classList.remove("active"));
    const newPageId  = `page-${firstAllowedPage}`;
    const newPage    = document.getElementById(newPageId);
    if (newPage) newPage.classList.add("page-active");
    const newNavLink = document.querySelector(`nav a[data-page='${newPageId}']`);
    if (newNavLink) newNavLink.classList.add("active");
  } else if (allowedPages[currentPageKey]) {
    const activeNav = document.querySelector(`nav a[data-page='${currentPageId}']`);
    if (activeNav && !activeNav.classList.contains("active")) {
      document.querySelectorAll("nav a").forEach(l => l.classList.remove("active"));
      activeNav.classList.add("active");
    }
  }

  if (!firstAllowedPage) {
    PCGAuth.logout();
  }
}
applyNavVisibility();

// â”€â”€â”€ Live permission sync (polling) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//
// Polls the sheet every 30 seconds so any permission change made by
// an admin is reflected in the sidebar immediately â€” no logout/login
// required.  Admins and authors are skipped (they always have full
// access and their permissions are never constrained per-module).
//
async function refreshUserPermissions() {
  const user = PCGAuth.getUser();
  if (!user || !user.email) return;

  const role = (user.role || "").toLowerCase();
  if (role === "admin" || role === "author") return; // full access â€” no sync needed

  try {
    const params = new URLSearchParams({ action: "getUserPermissions", email: user.email });
    const res  = await fetch(`${APPS_SCRIPT_URL}?${params}`);
    const data = await res.json();

    if (data.ok && data.permissions) {
      // Write fresh permissions back into the session
      user.permissions = data.permissions;
      sessionStorage.setItem("pcg_user", JSON.stringify(user));
      // Re-apply nav with the updated permissions (silently updates sidebar)
      applyNavVisibility();
    }
  } catch (_) {
    // Network failure â€” keep current cached permissions silently
  }
}

// Run once immediately on page load, then poll every 30 seconds.
// 30 s is a good balance: fast enough to feel instant after an admin
// saves a change, slow enough to not spam the Apps Script quota.
refreshUserPermissions();
const _permPollInterval = setInterval(refreshUserPermissions, 30_000);

// â”€â”€â”€ Logout handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
document.getElementById("btnLogout").addEventListener("click", () => {
  clearInterval(_permPollInterval); // stop polling on logout
  PCGAuth.logout();
});

// â”€â”€â”€ Toast notification helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let _toastTimer = null;
function showToast(message, type = "success") {
  const toast   = document.getElementById("pcgToast");
  const msgEl   = document.getElementById("toastMsg");
  const iconEl  = document.getElementById("toastIcon");
  if (!toast || !msgEl) return;

  msgEl.textContent = message;
  toast.className = "pcg-toast pcg-toast-" + type;
  iconEl.className = type === "success"
    ? "fa-solid fa-circle-check toast-icon-ok"
    : "fa-solid fa-circle-exclamation toast-icon-err";

  if (_toastTimer) clearTimeout(_toastTimer);
  toast.classList.add("pcg-toast-visible");
  _toastTimer = setTimeout(() => toast.classList.remove("pcg-toast-visible"), 3200);
}

// â”€â”€â”€ CustomSelect Class â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
class CustomSelect {
  constructor(wrapper) {
    this.wrapper      = wrapper;
    this.trigger      = wrapper.querySelector(".cs-trigger");
    this.valueEl      = wrapper.querySelector(".cs-value");
    this.panel        = wrapper.querySelector(".cs-panel");
    this.searchInput  = wrapper.querySelector(".cs-search");
    this.list         = wrapper.querySelector(".cs-list");
    this._value       = "";
    this._options     = [];
    this._disabled    = false;
    this._onChange    = null;
    this._focusedIdx  = -1;
    this._placeholder = wrapper.dataset.placeholder || "Selectâ€¦";

    const uid = `cs-${wrapper.dataset.id || Math.random().toString(36).slice(2)}`;
    this.list.id = `${uid}-list`;

    this.trigger.setAttribute("role", "combobox");
    this.trigger.setAttribute("aria-haspopup", "listbox");
    this.trigger.setAttribute("aria-expanded", "false");
    this.trigger.setAttribute("aria-controls", this.list.id);
    this.list.setAttribute("role", "listbox");

    this.trigger.addEventListener("click", e => {
      e.stopPropagation();
      if (this._disabled) return;
      this._isOpen() ? this.close() : this.open();
    });

    this.trigger.addEventListener("keydown", e => {
      if (this._disabled) return;
      switch (e.key) {
        case "Enter": case " ": case "ArrowDown":
          e.preventDefault(); this.open(); break;
        case "Escape": this.close(); break;
      }
    });

    this.searchInput.addEventListener("keydown", e => {
      switch (e.key) {
        case "ArrowDown": e.preventDefault(); this._moveFocus(1); break;
        case "ArrowUp":   e.preventDefault(); this._moveFocus(-1); break;
        case "Enter":     e.preventDefault(); this._confirmFocused(); break;
        case "Escape":    e.preventDefault(); this.close(); this.trigger.focus(); break;
        case "Tab":       this.close(); break;
        case "Backspace":
          if (this.searchInput.value === "" && this._value) {
            e.preventDefault(); this._clearSelection();
          }
          break;
      }
    });

    this.searchInput.addEventListener("input", () => {
      this._focusedIdx = -1;
      this._clearFocusedStyle();
      this._filterList();
    });

    this.panel.addEventListener("click", e => e.stopPropagation());
    document.addEventListener("click", () => this.close());
  }

  _isOpen() { return this.wrapper.classList.contains("cs-open"); }

  open() {
    document.querySelectorAll(".custom-select.cs-open").forEach(el => {
      if (el !== this.wrapper) el.classList.remove("cs-open");
    });
    this.wrapper.classList.add("cs-open");
    this.trigger.setAttribute("aria-expanded", "true");
    this.searchInput.value = "";
    this._focusedIdx = -1;
    this._filterList();
    setTimeout(() => this.searchInput.focus(), 60);
  }

  close() {
    if (!this._isOpen()) return;
    this.wrapper.classList.remove("cs-open");
    this.trigger.setAttribute("aria-expanded", "false");
    this._clearFocusedStyle();
    this._focusedIdx = -1;
    this.trigger.removeAttribute("aria-activedescendant");
  }

  _visibleItems() {
    return [...this.list.querySelectorAll(".cs-item")].filter(li => li.style.display !== "none");
  }

  _moveFocus(direction) {
    const items = this._visibleItems();
    if (!items.length) return;
    this._focusedIdx = Math.max(0, Math.min(this._focusedIdx + direction, items.length - 1));
    if (this._focusedIdx < 0) this._focusedIdx = 0;
    this._applyFocusedStyle(items);
  }

  _applyFocusedStyle(items) {
    items.forEach((li, i) => li.classList.toggle("cs-focused", i === this._focusedIdx));
    const focused = items[this._focusedIdx];
    if (!focused) return;
    focused.id = focused.id || `${this.list.id}-opt-${this._focusedIdx}`;
    this.trigger.setAttribute("aria-activedescendant", focused.id);
    focused.scrollIntoView({ block: "nearest" });
  }

  _clearFocusedStyle() {
    this.list.querySelectorAll(".cs-focused").forEach(li => li.classList.remove("cs-focused"));
  }

  _confirmFocused() {
    const items = this._visibleItems();
    const focused = items[this._focusedIdx];
    if (focused) { this._selectItem(focused.dataset.value); this.trigger.focus(); }
  }

  _filterList() {
    const q = this.searchInput.value.toLowerCase().trim();
    let visible = 0;
    this.list.querySelectorAll(".cs-item").forEach(item => {
      const match = item.dataset.value.toLowerCase().includes(q);
      item.style.display = match ? "" : "none";
      if (match) visible++;
    });
    let emptyEl = this.list.querySelector(".cs-empty");
    if (visible === 0) {
      if (!emptyEl) {
        emptyEl = document.createElement("li");
        emptyEl.className = "cs-empty";
        emptyEl.textContent = "No results found";
        this.list.appendChild(emptyEl);
      }
      emptyEl.style.display = "";
    } else if (emptyEl) {
      emptyEl.style.display = "none";
    }
  }

  populate(options, placeholder, disabled = false) {
    this._options    = options || [];
    this._disabled   = disabled || this._options.length === 0;
    this._placeholder = placeholder || this._placeholder;
    this.list.innerHTML = "";
    this._options.forEach((opt, i) => {
      const li = document.createElement("li");
      li.className     = "cs-item";
      li.textContent   = opt;
      li.dataset.value = opt;
      li.id            = `${this.list.id}-opt-${i}`;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", opt === this._value ? "true" : "false");
      if (opt === this._value) li.classList.add("cs-selected");
      li.addEventListener("click", () => this._selectItem(opt));
      this.list.appendChild(li);
    });
    if (this._value && !this._options.includes(this._value)) this._value = "";
    this._refreshTrigger();
    this.trigger.disabled = this._disabled;
    this.wrapper.classList.toggle("cs-disabled", this._disabled);
    if (this._disabled) this.close();
  }

  reset(placeholder, disabled = false) { this._value = ""; this.populate([], placeholder, disabled); }

  _selectItem(val) {
    this._value = val;
    this._refreshTrigger();
    this.list.querySelectorAll(".cs-item").forEach(li => {
      const selected = li.dataset.value === val;
      li.classList.toggle("cs-selected", selected);
      li.setAttribute("aria-selected", selected ? "true" : "false");
    });
    this.close();
    if (this._onChange) this._onChange(val);
  }

  _clearSelection() {
    if (!this._value) return;
    this._value = "";
    this._refreshTrigger();
    this.list.querySelectorAll(".cs-item").forEach(li => {
      li.classList.remove("cs-selected");
      li.setAttribute("aria-selected", "false");
    });
    if (this._onChange) this._onChange("");
  }

  _refreshTrigger() {
    this.valueEl.innerHTML = "";
    if (this._value) {
      const tag    = document.createElement("span");
      tag.className = "cs-tag";
      const text   = document.createElement("span");
      text.className   = "cs-tag-text";
      text.textContent = this._value;
      const remove = document.createElement("span");
      remove.className = "cs-tag-remove";
      remove.setAttribute("aria-label", `Remove ${this._value}`);
      remove.setAttribute("title", "Remove");
      remove.textContent = "Ã—";
      remove.addEventListener("click", e => { e.stopPropagation(); this._clearSelection(); });
      tag.appendChild(text);
      tag.appendChild(remove);
      this.valueEl.appendChild(tag);
      this.valueEl.classList.remove("cs-placeholder");
    } else {
      this.valueEl.textContent = this._placeholder;
      this.valueEl.classList.add("cs-placeholder");
    }
  }

  getValue()   { return this._value; }
  onChange(fn) { this._onChange = fn; }
}

// â”€â”€â”€ Build select registry â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const selects = {};
document.querySelectorAll(".custom-select").forEach(el => {
  selects[el.dataset.id] = new CustomSelect(el);
});

const generatedCode = document.getElementById("generated-code");

// â”€â”€â”€ KPI & Chart State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const activeFrames   = {};
const currentCounts  = { leather: 0, nonLeather: 0, packing: 0 };
let firstLoad        = true;
let dropdownsLoaded  = false;
let groupRows        = [];

let donutChart = null;
let barChart   = null;

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function uniqueValues(values) {
  return [...new Set(values.map(v => String(v).trim()).filter(Boolean))];
}

function updateCategoryOptions() {
  const group = selects.group.getValue();
  const categories = uniqueValues(
    groupRows.filter(r => r.group === group).map(r => r.category)
  );
  selects.category.populate(categories, "Select Category", !group);
  selects.subCategory.reset("Select Sub-Category", true);
}

function updateSubCategoryOptions() {
  const group    = selects.group.getValue();
  const category = selects.category.getValue();
  const subs     = uniqueValues(
    groupRows
      .filter(r => r.group === group && r.category === category)
      .map(r => r.subCategory)
  );
  selects.subCategory.populate(subs, "Select Sub-Category", !category);
}

function updateGeneratedCode() {
  if (!generatedCode) return;
  const parts = [
    selects.number.getValue(),
    selects.uom.getValue(),
    selects.description.getValue(),
    selects.descriptionOpt.getValue(),
    selects.colour.getValue()
  ].map(v => v.trim()).filter(Boolean);
  generatedCode.textContent = parts.length ? parts.join(" ") : "Waiting for input";
}

// â”€â”€â”€ Wire dropdown events â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
selects.group.onChange(() => { updateCategoryOptions(); updateGeneratedCode(); });
selects.category.onChange(() => { updateSubCategoryOptions(); updateGeneratedCode(); });

["subCategory","number","uom","description","descriptionOpt","colour",
 "stockKeepingUom","altUom","conversionRate"].forEach(key => {
  if (selects[key]) selects[key].onChange(updateGeneratedCode);
});

// â”€â”€â”€ Animated Count-Up â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function animateCount(key, element, from, to, duration = 1500) {
  if (activeFrames[key]) cancelAnimationFrame(activeFrames[key]);
  const start = performance.now();
  const delta = to - from;
  function easeOutExpo(t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }
  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const current  = Math.round(from + easeOutExpo(progress) * delta);
    element.textContent = current.toLocaleString();
    if (progress < 1) {
      activeFrames[key] = requestAnimationFrame(tick);
    } else {
      element.textContent = to.toLocaleString();
      delete activeFrames[key];
    }
  }
  activeFrames[key] = requestAnimationFrame(tick);
}

// â”€â”€â”€ Chart.js Initialisation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Chart.defaults.font.family = "'Montserrat', Arial, sans-serif";
Chart.defaults.color = "#9aa6b8";

const CHART_COLORS = {
  leather:   "#8b5cf6",
  nonLeather:"#38bdf8",
  packing:   "#f59e0b",
};

function initCharts() {
  const donutCtx = document.getElementById("donutChart").getContext("2d");
  donutChart = new Chart(donutCtx, {
    type: "doughnut",
    data: {
      labels: ["Leather", "Non-Leather", "Packing"],
      datasets: [{
        data: [0, 0, 0],
        backgroundColor: [CHART_COLORS.leather, CHART_COLORS.nonLeather, CHART_COLORS.packing],
        hoverBackgroundColor: [CHART_COLORS.leather + "dd", CHART_COLORS.nonLeather + "dd", CHART_COLORS.packing + "dd"],
        borderWidth: 0,
        hoverOffset: 6,
        spacing: 3,
      }],
    },
    options: {
      cutout: "68%",
      animation: { duration: 900, easing: "easeOutExpo" },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(10,22,40,0.97)",
          borderColor: "rgba(255,255,255,0.1)",
          borderWidth: 1,
          padding: 12,
          titleFont: { size: 11, weight: "700" },
          bodyFont:  { size: 18, weight: "800" },
          callbacks: {
            label: function(ctx) {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0) || 1;
              const pct   = ((ctx.raw / total) * 100).toFixed(1);
              return `  ${ctx.raw.toLocaleString()}  (${pct}%)`;
            },
          },
        },
      },
    },
  });

  const barCtx = document.getElementById("barChart").getContext("2d");
  barChart = new Chart(barCtx, {
    type: "bar",
    data: {
      labels: ["Leather", "Non-Leather", "Packing"],
      datasets: [{
        label: "Items",
        data: [0, 0, 0],
        backgroundColor: [CHART_COLORS.leather + "cc", CHART_COLORS.nonLeather + "cc", CHART_COLORS.packing + "cc"],
        hoverBackgroundColor: [CHART_COLORS.leather, CHART_COLORS.nonLeather, CHART_COLORS.packing],
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      animation: { duration: 900, easing: "easeOutExpo" },
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(10,22,40,0.97)",
          borderColor: "rgba(255,255,255,0.1)",
          borderWidth: 1,
          padding: 12,
          titleFont: { size: 11, weight: "700" },
          bodyFont:  { size: 18, weight: "800" },
          callbacks: {
            label: function(ctx) { return `  ${ctx.raw.toLocaleString()}`; },
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11, weight: "700" }, color: "#9aa6b8" }, border: { display: false } },
        y: { grid: { color: "rgba(255,255,255,0.06)", drawBorder: false }, ticks: { font: { size: 10, weight: "600" }, color: "#9aa6b8", callback: v => v >= 1000 ? (v / 1000).toFixed(1) + "k" : v }, border: { display: false } },
      },
    },
  });
}

// â”€â”€â”€ Update Charts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function updateCharts(counts) {
  const { leather: lc, nonLeather: nlc, packing: pc } = counts;
  const total = lc + nlc + pc || 1;

  if (donutChart) {
    donutChart.data.datasets[0].data = [lc, nlc, pc];
    donutChart.update();
  }
  if (barChart) {
    barChart.data.datasets[0].data = [lc, nlc, pc];
    barChart.update();
  }

  const donutTotalEl = document.getElementById("donut-total");
  if (donutTotalEl) donutTotalEl.textContent = total.toLocaleString();

  const pctL  = ((lc  / total) * 100).toFixed(1);
  const pctNL = ((nlc / total) * 100).toFixed(1);
  const pctP  = ((pc  / total) * 100).toFixed(1);

  setText("legend-pct-leather",    pctL  + "%");
  setText("legend-pct-nonleather", pctNL + "%");
  setText("legend-pct-packing",    pctP  + "%");
  setText("legend-val-leather",    lc.toLocaleString());
  setText("legend-val-nonleather", nlc.toLocaleString());
  setText("legend-val-packing",    pc.toLocaleString());

  setText("bar-val-leather",    lc.toLocaleString());
  setText("bar-val-nonleather", nlc.toLocaleString());
  setText("bar-val-packing",    pc.toLocaleString());
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// â”€â”€â”€ KPI Cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function updateKPICards(counts) {
  const { leather: lc, nonLeather: nlc, packing: pc } = counts;
  const total = lc + nlc + pc || 1;

  const fromL  = firstLoad ? 0 : currentCounts.leather;
  const fromNL = firstLoad ? 0 : currentCounts.nonLeather;
  const fromP  = firstLoad ? 0 : currentCounts.packing;
  firstLoad = false;

  animateCount("leather",    document.getElementById("leather-count"),     fromL,  lc);
  animateCount("nonLeather", document.getElementById("non-leather-count"), fromNL, nlc);
  animateCount("packing",    document.getElementById("packing-count"),     fromP,  pc);

  currentCounts.leather    = lc;
  currentCounts.nonLeather = nlc;
  currentCounts.packing    = pc;

  setTimeout(() => {
    document.getElementById("leather-progress").textContent    = Math.round((lc  / total) * 100) + "%";
    document.getElementById("non-leather-progress").textContent = Math.round((nlc / total) * 100) + "%";
    document.getElementById("packing-progress").textContent    = Math.round((pc  / total) * 100) + "%";
  }, 1600);

  updateCharts(counts);

  const timeEl = document.getElementById("live-time");
  if (timeEl) timeEl.textContent = "Last updated: " + new Date().toLocaleTimeString();
}

// â”€â”€â”€ Live indicator helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function setLiveRefreshing(state) {
  const dot    = document.getElementById("live-dot");
  const status = document.getElementById("live-status");
  if (!dot || !status) return;
  if (state) {
    dot.classList.add("refreshing");
    status.textContent = "Refreshingâ€¦";
  } else {
    dot.classList.remove("refreshing");
    status.textContent = "Live Â· refreshes every 15s";
  }
}

// â”€â”€â”€ Dropdowns â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function updateDropdowns(data) {
  const d = data.dropdowns || {};
  groupRows = Array.isArray(d.groups) ? d.groups : [];
  selects.group.populate(uniqueValues(groupRows.map(r => r.group)), "Select Group");
  selects.category.reset("Select Category", true);
  selects.subCategory.reset("Select Sub-Category", true);
  selects.number.populate(d.numbers              || [], "Select Number");
  selects.uom.populate(d.uoms                    || [], "Select UOM");
  selects.description.populate(d.descriptions    || [], "Select Description");
  selects.descriptionOpt.populate(d.descriptionOptions || [], "Select Description (Opt.)");
  selects.colour.populate(d.colours              || [], "Select Colour");
  selects.stockKeepingUom.populate(d.stockKeepingUoms || [], "Select Stock Keeping UOM");
  selects.altUom.populate(d.altUoms              || [], "Select Alt. UOM");
  selects.conversionRate.populate(d.conversionRates || [], "Select Rate");
}

// â”€â”€â”€ Count extraction â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function getCountsFromResponse(data) {
  if (data.counts) {
    return {
      leather:    Number(data.counts.leather)    || 0,
      nonLeather: Number(data.counts.nonLeather) || 0,
      packing:    Number(data.counts.packing)    || 0
    };
  }
  const rows   = data.productName || data.rows || data.data || [];
  const counts = { leather: 0, nonLeather: 0, packing: 0 };
  rows.forEach(row => {
    const values = Object.values(row).map(v => typeof v === "string" ? v.trim() : String(v));
    for (const val of values) {
      const lower = val.toLowerCase();
      if (lower === "non leather" || lower === "non-leather") { counts.nonLeather++; break; }
      else if (lower === "packing material" || lower === "packing") { counts.packing++; break; }
      else if (lower === "leather") { counts.leather++; break; }
    }
  });
  return counts;
}

// â”€â”€â”€ Data fetch â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function loadAppData() {
  setLiveRefreshing(true);
  try {
    const response = await fetch(APPS_SCRIPT_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    updateKPICards(getCountsFromResponse(data));

    if (!dropdownsLoaded) {
      updateDropdowns(data);
      dropdownsLoaded = true;
    }
  } catch (err) {
    console.warn("App data unavailable:", err);
    ["leather-count","non-leather-count","packing-count"].forEach(id => {
      document.getElementById(id).textContent = "--";
    });
    ["leather-progress","non-leather-progress","packing-progress"].forEach(id => {
      document.getElementById(id).textContent = "N/A";
    });
  } finally {
    setLiveRefreshing(false);
  }
}

// â”€â”€â”€ Sidebar click handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
document.querySelectorAll("nav a[data-page]").forEach(link => {
  link.addEventListener("click", (e) => {
    const targetId  = link.dataset.page;
    const pageKey   = targetId.replace("page-", "");

    if (!PCGAuth.can(pageKey)) {
      e.preventDefault();
      return;
    }

    document.querySelectorAll("nav a").forEach(l => l.classList.remove("active"));
    link.classList.add("active");
    document.querySelectorAll(".page").forEach(p => p.classList.remove("page-active"));
    const target = document.getElementById(targetId);
    if (target) target.classList.add("page-active");

    // Load admin panel when navigating to it
    if (pageKey === "admin") {
      loadAdminPanel();
    }
  });
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  ADMIN PANEL LOGIC
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

let adminUsersCache = null; // cache users after first load

/**
 * Render role badge HTML
 */
function roleBadgeHtml(role) {
  const map = {
    admin:  { cls: "role-badge-admin",  label: "Admin"  },
    author: { cls: "role-badge-author", label: "Author" },
    user:   { cls: "role-badge-user",   label: "User"   }
  };
  const info = map[(role || "").toLowerCase()] || { cls: "role-badge-user", label: role || "User" };
  return `<span class="role-badge ${info.cls}">${info.label}</span>`;
}

/**
 * Render permission selector (Viewer / Editor / Remove) for a module
 */
function permSelectHtml(userId, module, currentValue) {
  const val = (currentValue || "viewer").toLowerCase().trim();
  return `
    <div class="perm-select-wrap">
      <button
        class="perm-btn ${val === "viewer" ? "perm-btn-active-viewer" : ""}"
        data-user="${userId}"
        data-module="${module}"
        data-value="viewer"
        title="Viewer â€” read-only access"
        onclick="handlePermBtn(this)">
        <i class="fa-solid fa-eye"></i> Viewer
      </button>
      <button
        class="perm-btn ${val === "editor" ? "perm-btn-active-editor" : ""}"
        data-user="${userId}"
        data-module="${module}"
        data-value="editor"
        title="Editor â€” full edit access"
        onclick="handlePermBtn(this)">
        <i class="fa-solid fa-pen-to-square"></i> Editor
      </button>
      <button
        class="perm-btn ${val === "remove" ? "perm-btn-active-remove" : ""}"
        data-user="${userId}"
        data-module="${module}"
        data-value="remove"
        title="Remove â€” hide this section from the user"
        onclick="handlePermBtn(this)">
        <i class="fa-solid fa-ban"></i> Remove
      </button>
    </div>`;
}

/**
 * Handle Viewer / Editor / Remove button click
 */
function handlePermBtn(btn) {
  const userId = btn.dataset.user;
  const module = btn.dataset.module;
  const value  = btn.dataset.value;

  // Deactivate all sibling buttons for same user+module
  const wrap = btn.closest(".perm-select-wrap");
  wrap.querySelectorAll(".perm-btn").forEach(b => {
    b.classList.remove("perm-btn-active-viewer", "perm-btn-active-editor", "perm-btn-active-remove");
  });

  if (value === "viewer")      btn.classList.add("perm-btn-active-viewer");
  else if (value === "editor") btn.classList.add("perm-btn-active-editor");
  else                         btn.classList.add("perm-btn-active-remove");

  // Mark row as changed
  const row = document.querySelector(`.admin-user-row[data-user-id="${userId}"]`);
  if (row) row.classList.add("admin-row-changed");
}

/**
 * Render a single user row
 */
function renderUserRow(user, index) {
  const userId  = encodeURIComponent(user.email);
  const initial = (user.username || user.email || "?")[0].toUpperCase();
  const perms   = user.permissions || {};
  user.role     = (user.role || "").toLowerCase().trim();

  return `
    <div class="admin-user-row" data-user-id="${userId}" data-email="${user.email}">
      <div class="aur-user">
        <div class="aur-avatar">${initial}</div>
        <div class="aur-info">
          <span class="aur-name">${user.username || "â€”"}</span>
          <span class="aur-email">${user.email}</span>
          ${roleBadgeHtml(user.role)}
        </div>
      </div>
      <div class="aur-modules">
        <div class="aur-module-cell">
          ${permSelectHtml(userId, "dashboard", perms.dashboard)}
        </div>
        <div class="aur-module-cell">
          ${permSelectHtml(userId, "reports", perms.reports)}
        </div>
        <div class="aur-module-cell">
          ${permSelectHtml(userId, "forms", perms.forms)}
        </div>
      </div>
      <div class="aur-action">
        <button class="admin-save-btn" onclick="saveUserPermissions('${userId}', this)" title="Save permissions">
          <i class="fa-solid fa-floppy-disk"></i>
          <span>Save</span>
        </button>
      </div>
    </div>`;
}


async function saveUserPermissions(userId, btn) {
  const row   = document.querySelector(`.admin-user-row[data-user-id="${userId}"]`);
  const email = row ? row.dataset.email : decodeURIComponent(userId);

  // Read current permission selections from the row
  function getSelectedPerm(module) {
    const activeBtn = row.querySelector(
      `.perm-btn.perm-btn-active-viewer[data-module="${module}"],` +
      `.perm-btn.perm-btn-active-editor[data-module="${module}"],` +
      `.perm-btn.perm-btn-active-remove[data-module="${module}"]`
    );
    return activeBtn ? activeBtn.dataset.value : "viewer";
  }

  const dashboard = getSelectedPerm("dashboard");
  const reports   = getSelectedPerm("reports");
  const forms     = getSelectedPerm("forms");

  // Disable button during save
  btn.disabled = true;
  btn.innerHTML = `<span class="admin-save-spinner"></span><span>Savingâ€¦</span>`;

  try {
    const params = new URLSearchParams({
      action:      "updateUserPermissions",
      adminEmail:  currentUser.email,
      targetEmail: email,
      dashboard,
      reports,
      forms
    });
    const response = await fetch(`${APPS_SCRIPT_URL}?${params}`);
    const data = await response.json();

    if (data.ok) {
      showToast(`Permissions saved for ${email}`, "success");
      if (row) row.classList.remove("admin-row-changed");
    } else {
      showToast(data.error || "Failed to save permissions", "error");
    }
  } catch (err) {
    showToast("Network error â€” could not save permissions", "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i><span>Save</span>`;
  }
}

/**
 * Load and render the admin panel user list
 */
async function loadAdminPanel() {
  if (!PCGAuth.isAdminOrAuthor()) return;

  const listEl   = document.getElementById("adminUsersList");
  const statsBar = document.getElementById("adminStatsBar");
  if (!listEl) return;

  // Show loading only on first load
  if (!adminUsersCache) {
    listEl.innerHTML = `
      <div class="admin-loading">
        <span class="loader"></span>
        <span>Loading usersâ€¦</span>
      </div>`;
  }

  try {
    const params = new URLSearchParams({
      action:     "getUsersList",
      adminEmail: currentUser.email
    });
    const response = await fetch(`${APPS_SCRIPT_URL}?${params}`);

    const data = await response.json();

    if (!data.ok) {
      listEl.innerHTML = `<div class="admin-error"><i class="fa-solid fa-triangle-exclamation"></i> ${data.error || "Failed to load users."}</div>`;
      return;
    }

    adminUsersCache = (data.users || []).filter(u => {
      const r = (u.role || "").toLowerCase().trim();
      return r === "admin" || r === "user";
    });
    const users = adminUsersCache;

    // Update stats bar
    if (statsBar) {
      const adminCount = users.filter(u => (u.role || "").toLowerCase().trim() === "admin").length;
      const userCount  = users.length - adminCount;
      setText("statTotalUsers", users.length);
      setText("statAdmins",     adminCount);
      setText("statUsers",      userCount);
      statsBar.style.display = "grid";
    }

    if (users.length === 0) {
      listEl.innerHTML = `
        <div class="admin-empty">
          <i class="fa-solid fa-users-slash"></i>
          <span>No users found in the USERS sheet.</span>
        </div>`;
      return;
    }

    listEl.innerHTML = users.map((user, i) => renderUserRow(user, i)).join("");

  } catch (err) {
    listEl.innerHTML = `<div class="admin-error"><i class="fa-solid fa-triangle-exclamation"></i> Network error â€” could not load users.</div>`;
  }
}

// â”€â”€â”€ Boot â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
initCharts();
loadAppData();
setInterval(loadAppData, 15_000);

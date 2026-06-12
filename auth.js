/**
 * auth.js — PCG Session Management
 * Include this on every page that requires authentication.
 *
 * Usage:
 *   <script src="auth.js"></script>
 *   Then call: PCGAuth.requireLogin()   → on protected pages
 *              PCGAuth.getUser()        → returns user object or null
 *              PCGAuth.logout()         → clears session & redirects to login
 *              PCGAuth.can(page)        → checks role permission for a page key
 *              PCGAuth.isAdminOrAuthor() → checks if current user is admin or author
 *              PCGAuth.getModulePerm(page) → returns "viewer" | "editor" | "remove"
 */

const PCGAuth = (() => {

  const SESSION_KEY = "pcg_user";
  const LOGIN_PAGE  = "login.html";

  /**
   * Role permission map — which page keys each role can potentially access.
   * page keys: "dashboard", "form", "reports", "settings", "admin"
   *
   * For the "user" role, all three content pages are listed here so the
   * per-module permission check (viewer / editor / remove) below can run.
   * Listing a page here does NOT grant access — it just means the per-module
   * check is evaluated.  A value of "remove" in the user's permissions object
   * will still hide that page.
   *
   * Admins and authors always have full access to all pages in their list.
   */
  const PERMISSIONS = {
    admin:  ["dashboard", "form", "reports", "settings", "admin"],
    author: ["dashboard", "form", "reports", "settings", "admin"],
    user:   ["dashboard", "form", "reports", "settings"]
  };

  /**
   * Map page keys → permission object keys stored in user.permissions.
   * "settings" has no module permission entry, so it is always visible for users.
   */
  const MODULE_MAP = {
    dashboard: "dashboard",
    reports:   "reports",
    form:      "forms"
  };

  function getUser() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function requireLogin() {
    const user = getUser();
    if (!user || !user.email || !user.role) {
      window.location.href = LOGIN_PAGE;
      return null;
    }
    return user;
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.href = LOGIN_PAGE;
  }

  /**
   * Returns the raw module permission string for a page key.
   * Returns "viewer" by default when no specific permission is stored.
   * Returns null if the page has no per-module permission entry.
   * @param {string} pageKey  e.g. "form", "reports", "dashboard"
   * @returns {"viewer"|"editor"|"remove"|null}
   */
  function getModulePerm(pageKey) {
    const user = getUser();
    if (!user) return null;
    const role = (user.role || "").toLowerCase();
    if (role !== "user") return null; // admins/authors always have full access

    const moduleKey = MODULE_MAP[pageKey.toLowerCase()];
    if (!moduleKey) return null; // no per-module entry for this page (e.g. settings)

    if (!user.permissions) return "viewer";
    return ((user.permissions[moduleKey]) || "viewer").toLowerCase().trim();
  }

  /**
   * Check whether the current user can access (see) a page.
   *
   * Rules:
   *  - admin / author: can access everything in their PERMISSIONS list.
   *  - user: can access a page if it's in the PERMISSIONS list AND the
   *    per-module permission is "viewer" or "editor" (NOT "remove").
   *
   * @param {string} pageKey  e.g. "form", "reports", "admin"
   * @returns {boolean}
   */
  function can(pageKey) {
    const user = getUser();
    if (!user) return false;
    const role  = (user.role || "").toLowerCase();
    const perms = PERMISSIONS[role] || [];

    if (!perms.includes(pageKey.toLowerCase())) return false;

    // Per-module access control — only applies to "user" role.
    // viewer  → show section (read-only)
    // editor  → show section (edit access)
    // remove  → hide section entirely, deny access
    if (role === "user") {
      const modulePerm = getModulePerm(pageKey);
      if (modulePerm === "remove") return false;
    }

    return true;
  }

  /**
   * Check whether the current user is admin or author.
   * @returns {boolean}
   */
  function isAdminOrAuthor() {
    const user = getUser();
    if (!user) return false;
    const role = (user.role || "").toLowerCase();
    return role === "admin" || role === "author";
  }

  return { getUser, requireLogin, logout, can, getModulePerm, isAdminOrAuthor, PERMISSIONS };

})();

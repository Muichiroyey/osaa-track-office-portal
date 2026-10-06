const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

// A DIFFERENT storage key from the Admin Panel's "osaa_track_admin_token"
// and the Student/Alumni Portal's "osaa_track_portal_token". If someone
// runs multiple of these apps in the same browser (a staff member testing
// things, say), the sessions must not overwrite each other.
const TOKEN_KEY = "osaa_track_office_token";
const WHO_KEY = "osaa_track_office_remembered_who";
const TAB_KEY_PREFIX = "osaa_track_office_tab:";
const TAB_ID_KEY = "osaa_track_office_tab_id";

/**
 * MANY PEOPLE, ONE BROWSER — how the sign-in is kept
 * ───────────────────────────────────────────────────────────────────────
 * The server has always let any number of people be signed in at once (each
 * sign-in is its own session). What used to get in the way was the browser:
 * the token lived in ONE shared slot (localStorage), and every tab of a
 * browser shares that slot — so signing in as Maria in a second tab replaced
 * Juan's token, and Juan's tab suddenly acted as Maria. Now:
 *
 *  • THIS TAB'S sign-in lives in sessionStorage, which belongs to the tab
 *    alone (and survives a reload of it). Whoever a tab is, it stays — no
 *    other tab can change it.
 *  • "Remember me" additionally keeps a copy in localStorage, purely so the
 *    NEXT visit (after the browser was closed) can pick up where it left off.
 *  • A brand-new tab only takes over that remembered sign-in when no other
 *    tab is signed in (that's the "I closed the browser and came back" case).
 *    If another tab IS signed in, the new tab shows the sign-in page — so
 *    several people can each use their own tab — with a one-click "Continue
 *    as …" for anyone who just opened a second tab for themselves.
 *  • Signing out only ever ends the sign-in of the tab you did it in.
 */
export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

/** The sign-in remembered on this device (if any), and who it is — no secrets in `who`. */
export function getRemembered() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  let who = null;
  try {
    who = JSON.parse(localStorage.getItem(WHO_KEY));
  } catch {
    who = null;
  }
  return { token, who };
}

/** Make this tab use the remembered sign-in. */
export function adoptRemembered() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  return token;
}

/**
 * Signed in: keep it for THIS tab, and (with "Remember me") on the device.
 * Signed out (token = null): forget it for this tab — and forget the
 * device's remembered copy too, but only if it is the very one this tab was
 * using, so signing out never disturbs somebody else's remembered sign-in.
 */
export function setToken(token, remember = true, who = null) {
  const previous = sessionStorage.getItem(TOKEN_KEY);
  if (!token) {
    sessionStorage.removeItem(TOKEN_KEY);
    if (previous && localStorage.getItem(TOKEN_KEY) === previous) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(WHO_KEY);
    }
    return;
  }
  sessionStorage.setItem(TOKEN_KEY, token);
  if (remember) {
    localStorage.setItem(TOKEN_KEY, token);
    if (who) localStorage.setItem(WHO_KEY, JSON.stringify(who));
    else localStorage.removeItem(WHO_KEY);
  }
}

// ── "is another tab signed in?" ──────────────────────────────────────────
// Every signed-in tab stamps its own key in localStorage every couple of
// seconds (one key per tab, so tabs never overwrite each other). A key that
// hasn't been refreshed lately belongs to a tab that was closed or crashed.
const BEAT_MS = 2000;
const ALIVE_MS = 6000;

function tabId() {
  let id = sessionStorage.getItem(TAB_ID_KEY);
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(TAB_ID_KEY, id);
  }
  return id;
}

export function isAnotherTabSignedIn() {
  const mine = TAB_KEY_PREFIX + tabId();
  const now = Date.now();
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(TAB_KEY_PREFIX) || key === mine) continue;
    if (now - Number(localStorage.getItem(key)) < ALIVE_MS) return true;
  }
  return false;
}

/** Call while signed in; returns the function that stops it. */
export function startTabHeartbeat() {
  const key = TAB_KEY_PREFIX + tabId();
  const beat = () => {
    try {
      localStorage.setItem(key, String(Date.now()));
    } catch {
      /* storage full or blocked — this tab just won't be visible to others */
    }
  };
  const forget = () => localStorage.removeItem(key);
  beat();
  const timer = setInterval(beat, BEAT_MS);
  window.addEventListener("pagehide", forget);
  return () => {
    clearInterval(timer);
    window.removeEventListener("pagehide", forget);
    forget();
  };
}

// Every successful create/edit/delete announces itself here so the screens
// showing that data refresh at once (see context/LiveUpdatesContext.jsx).
const writeListeners = new Set();
export function onApiWrite(fn) {
  writeListeners.add(fn);
  return () => writeListeners.delete(fn);
}
const SILENT_WRITE_PREFIXES = ["/api/uploads", "/api/office/auth/login", "/api/office/auth/logout"];

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      // Always ask the server — a list must never be answered from a stored copy.
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Could not reach the server. Is the backend running?");
  }

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json().catch(() => ({})) : null;

  if (!res.ok) {
    throw new ApiError(res.status, data?.error || "UNKNOWN_ERROR", data?.message || "Something went wrong.");
  }
  if (method !== "GET" && !SILENT_WRITE_PREFIXES.some((p) => path.startsWith(p))) {
    writeListeners.forEach((fn) => fn(path));
  }
  return data;
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: "GET" }),
  post: (path, body, opts) => request(path, { ...opts, method: "POST", body }),
  put: (path, body, opts) => request(path, { ...opts, method: "PUT", body }),
  patch: (path, body, opts) => request(path, { ...opts, method: "PATCH", body }),
  del: (path, opts) => request(path, { ...opts, method: "DELETE" }),
};

// Protected binary endpoints (file view/download) can't go through the
// JSON helper above but sit behind the same bearer token, so they fail the
// same ways. Throwing the same ApiError shape lets the file viewers route
// an expired session back to the login screen instead of silently failing.
export async function fetchProtectedFile(path) {
  const token = getToken();
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Could not reach the server. Is the backend running?");
  }
  if (!res.ok) {
    const isJson = res.headers.get("content-type")?.includes("application/json");
    const data = isJson ? await res.json().catch(() => ({})) : null;
    throw new ApiError(res.status, data?.error || "UNKNOWN_ERROR", data?.message || "Could not load the file.");
  }
  return res.blob();
}

// Shared upload pipeline — the exact same POST /api/uploads the Admin
// Panel posts to. Portal identities are accepted there by requireAnyAuth.
export async function uploadFile(file) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${BASE_URL}/api/uploads`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}` },
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data?.error || "UPLOAD_FAILED", data?.message || "Upload failed.");
  return { id: data.id, original_name: data.originalName, size_bytes: data.sizeBytes };
}

export async function downloadFile(fileId, fileName) {
  const blob = await fetchProtectedFile(`/api/uploads/${fileId}/download`);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName || "download";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

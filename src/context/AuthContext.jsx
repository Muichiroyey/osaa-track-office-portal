import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  api,
  getToken,
  setToken,
  getRemembered,
  adoptRemembered,
  isAnotherTabSignedIn,
  startTabHeartbeat,
  ApiError,
} from "../api/client.js";

const AuthContext = createContext(null);

/**
 * ONE SIGN-IN PAGE, ONE ACCOUNT TYPE.
 * Unlike the Student & Alumni Portal, there is no account-type picker here
 * — an authorized office's institutional email is unambiguous about which
 * account it is (spec: "Office Log-In Panel"). The signed-in account's
 * `officeId`/`officeName` (resolved server-side from users.type='offices')
 * is what every screen scopes its data to.
 *
 * MANY PEOPLE AT ONCE: each browser tab holds its own sign-in (see the note
 * in api/client.js), so several offices can use the portal side by side —
 * in different tabs of one browser, or on different devices — without ever
 * seeing or replacing each other's session.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("checking"); // checking | authenticated | unauthenticated
  const [sessionNotice, setSessionNotice] = useState(null);
  // Who is remembered on this device but not signed in in THIS tab — offered
  // on the sign-in page as "Continue as …" (name/email/type only, no secrets).
  const [remembered, setRemembered] = useState(null);
  const userRef = useRef(null);
  userRef.current = user;

  const readRemembered = () => {
    const r = getRemembered();
    return r ? r.who || {} : null;
  };

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      if (!getToken()) {
        // A brand-new tab. If it is the only signed-in window (the browser was
        // just re-opened) it picks up the remembered sign-in; if another tab
        // is already signed in — possibly as somebody else — it must NOT
        // silently become that person, so it shows the sign-in page instead.
        const saved = getRemembered();
        if (saved && !isAnotherTabSignedIn()) {
          adoptRemembered();
        } else {
          if (!cancelled) {
            setRemembered(saved ? saved.who || {} : null);
            setStatus("unauthenticated");
          }
          return;
        }
      }
      try {
        const data = await api.get("/api/office/auth/me");
        if (!cancelled) {
          setUser(data.user);
          setStatus("authenticated");
        }
      } catch {
        if (!cancelled) {
          setToken(null);
          setStatus("unauthenticated");
        }
      }
    }

    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email, password, remember = true) => {
    const data = await api.post("/api/office/auth/login", { email, password }, { auth: false });
    setToken(data.token, remember, { name: data.user.name, email: data.user.email, type: data.user.type });
    setUser(data.user);
    setStatus("authenticated");
    setSessionNotice(null);
    setRemembered(null);
    return data.user;
  }, []);

  // "Continue as …" on the sign-in page: take over the sign-in remembered on
  // this device, without typing the password again.
  const continueAsRemembered = useCallback(async () => {
    if (!adoptRemembered()) throw new ApiError(401, "UNAUTHENTICATED", "That sign-in is no longer available. Please sign in.");
    try {
      const data = await api.get("/api/office/auth/me");
      setUser(data.user);
      setStatus("authenticated");
      setSessionNotice(null);
      setRemembered(null);
      return data.user;
    } catch (err) {
      setToken(null);
      setRemembered(null);
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      // Ends the sign-in of THIS tab only (each tab has its own session).
      await api.post("/api/office/auth/logout");
    } catch {
      // clearing local state regardless
    }
    setToken(null);
    setUser(null);
    setStatus("unauthenticated");
    setRemembered(readRemembered());
  }, []);

  // Any request that comes back with an invalidated session — expired,
  // or the account deactivated by the admin mid-session.
  const handleSessionInvalidated = useCallback((err) => {
    if (
      err instanceof ApiError &&
      (err.code === "SESSION_EXPIRED" || err.code === "ACCOUNT_INACTIVE" || err.code === "SESSION_SUPERSEDED")
    ) {
      setToken(null);
      setUser(null);
      setStatus("unauthenticated");
      setSessionNotice(err.message);
      setRemembered(readRemembered());
      return true;
    }
    return false;
  }, []);

  const updateUser = useCallback((partial) => {
    setUser((prev) => (prev ? { ...prev, ...partial } : prev));
  }, []);

  // Changing your own password reissues this device's token (every other
  // session for the account is dropped server-side), so it has to be
  // stored back wherever the current one lives.
  const applyNewToken = useCallback((token) => {
    // The device's remembered copy is refreshed only if it is THIS person's
    // (another person's remembered sign-in is none of this tab's business).
    const current = userRef.current;
    const saved = getRemembered();
    const wasThisPerson = Boolean(saved && current && saved.who?.email === current.email);
    setToken(token, wasThisPerson, current ? { name: current.name, email: current.email, type: current.type } : null);
  }, []);

  // While signed in, let other tabs of this browser know — that is how a new
  // tab tells "I just re-opened the browser" from "somebody is already using it".
  useEffect(() => {
    if (status !== "authenticated") return undefined;
    return startTabHeartbeat();
  }, [status]);

  const office = user ? { id: user.officeId, name: user.officeName, category: user.officeCategory } : null;

  return (
    <AuthContext.Provider
      value={{
        user,
        status,
        office,
        login,
        logout,
        remembered,
        continueAsRemembered,
        sessionNotice,
        setSessionNotice,
        handleSessionInvalidated,
        updateUser,
        applyNewToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

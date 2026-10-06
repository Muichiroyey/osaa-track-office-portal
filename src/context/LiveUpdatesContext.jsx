import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getToken, onApiWrite } from "../api/client.js";
import { useAuth } from "./AuthContext.jsx";
import { createLiveClient } from "../realtime/liveClient.js";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
const LiveContext = createContext(null);

/**
 * Keeps the portal in sync with the server in real time (see
 * realtime/liveClient.js). Mounted once, inside AuthProvider: it connects
 * when the student/alumni is signed in and disconnects on sign-out.
 */
// Office Portal version: connects to /api/office/realtime/stream for signed-in office accounts.
export function LiveUpdatesProvider({ children }) {
  const { status } = useAuth();
  const client = useMemo(
    () => createLiveClient({ url: `${API_BASE}/api/office/realtime/stream`, getToken, jitterMs: 700 }),
    []
  );
  const [connected, setConnected] = useState(false);

  // Something YOU just saved: refresh the screens showing it right now.
  // (Pushes from the server are spread over ~0.7s of jitter so a change made
  // by the admin doesn't make every signed-in student re-fetch in the same instant.)
  useEffect(() => onApiWrite(() => client.notifyLocalWrite()), [client]);
  useEffect(() => client.onStatus(setConnected), [client]);
  useEffect(() => {
    if (status !== "authenticated") return undefined;
    client.start();
    return () => client.stop();
  }, [status, client]);

  const value = useMemo(() => ({ subscribe: client.subscribe, connected }), [client, connected]);
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

/**
 * Re-run `run` whenever any of `topics` changes anywhere (this tab, another
 * tab, the student/alumni portal). `run` is called with { background: true }
 * so it can skip error toasts for a quiet refresh. Always uses the latest
 * `run`, so it can close over current filters without re-subscribing.
 *
 *   useLiveRefresh(["announcements"], load);
 */
export function useLiveRefresh(topics, run, { enabled = true } = {}) {
  const ctx = useContext(LiveContext);
  const runRef = useRef(run);
  runRef.current = run;
  const key = Array.isArray(topics) ? topics.join("|") : String(topics);
  const subscribe = ctx?.subscribe;

  useEffect(() => {
    if (!enabled || !subscribe) return undefined;
    return subscribe(key.split("|"), (opts) => runRef.current?.(opts));
  }, [subscribe, key, enabled]);
}

export function useLiveConnected() {
  return useContext(LiveContext)?.connected ?? false;
}

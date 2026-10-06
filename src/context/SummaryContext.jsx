import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api } from "../api/client.js";
import { useAuth } from "./AuthContext.jsx";
import { useLiveRefresh } from "./LiveUpdatesContext.jsx";

const SummaryContext = createContext(null);
// Which badge counts each PERSON has already looked at. Keyed by user id — when
// several people share one browser, one person opening Announcements must not
// clear another person's badge.
const SEEN_KEY = "osaa_track_office_seen_badges";

function loadSeen(userId) {
  if (!userId) return {};
  try {
    return JSON.parse(localStorage.getItem(`${SEEN_KEY}:${userId}`)) || {};
  } catch {
    return {};
  }
}

/**
 * The per-user dashboard summary, shared by Home and the sidebar badges —
 * same pattern as the Admin Panel's DashboardContext, so the two apps
 * behave the same way. Refetched whenever the user lands on Home and on a
 * slow interval, so a decision the SAA makes shows up without a reload.
 */
export function SummaryProvider({ children }) {
  const { status, user, handleSessionInvalidated } = useAuth();
  const userId = user?.id ?? null;
  const [summary, setSummary] = useState(null);
  const [state, setState] = useState("idle");
  const [seen, setSeen] = useState(() => loadSeen(userId));

  // A different person in this tab (signed out, then somebody else signed in):
  // start from THEIR numbers, never the previous person's.
  useEffect(() => {
    setSeen(loadSeen(userId));
    setSummary(null);
    setState("idle");
  }, [userId]);

  const refresh = useCallback(async () => {
    setState((s) => (s === "ready" ? "ready" : "loading"));
    try {
      const data = await api.get("/api/office/summary");
      setSummary(data);
      setState("ready");
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      setState("error");
    }
  }, [handleSessionInvalidated]);

  useEffect(() => {
    if (status !== "authenticated") return;
    refresh();
    // Slow safety-net poll; real changes arrive instantly through the live stream below.
    const t = setInterval(refresh, 60000);
    return () => clearInterval(t);
  }, [status, refresh]);

  // A decision the SAA makes, a new announcement, a chat reply… the numbers
  // and badges update the moment it happens.
  useLiveRefresh(["summary"], refresh, { enabled: status === "authenticated" });

  // Two kinds of badge:
  //  • "tracked" ones (new announcements, posts, documents…) are unread counts the
  //    SERVER keeps per person — opening the module tells the server, which moves
  //    that person's "last opened" time forward, so the number is the same on every
  //    device and only comes back for something genuinely new.
  //  • the rest (Document Queue, SAA Chat…) are always-current counts that clear
  //    locally once looked at and return when the number grows.
  const acknowledging = useRef(new Set());

  const markSeen = useCallback(
    (key) => {
      if (summary?.trackedBadges?.includes(key)) {
        if (!(summary.badges?.[key] > 0) || acknowledging.current.has(key)) return;
        acknowledging.current.add(key);
        api
          .post("/api/office/seen", { module: key })
          .then(() => refresh())
          .catch(() => {})
          .finally(() => acknowledging.current.delete(key));
        return;
      }
      setSeen((prev) => {
        const current = summary?.badges?.[key] || 0;
        if (prev[key] === current) return prev;
        const next = { ...prev, [key]: current };
        if (userId) localStorage.setItem(`${SEEN_KEY}:${userId}`, JSON.stringify(next));
        return next;
      });
    },
    [summary, userId, refresh]
  );

  const getVisibleBadge = useCallback(
    (key) => {
      if (summary?.trackedBadges?.includes(key)) return Math.max(0, summary.badges?.[key] || 0);
      return Math.max(0, (summary?.badges?.[key] || 0) - (seen[key] || 0));
    },
    [summary, seen]
  );

  return (
    <SummaryContext.Provider value={{ summary, state, refresh, markSeen, getVisibleBadge }}>
      {children}
    </SummaryContext.Provider>
  );
}

export function useSummary() {
  const ctx = useContext(SummaryContext);
  if (!ctx) throw new Error("useSummary must be used within SummaryProvider");
  return ctx;
}

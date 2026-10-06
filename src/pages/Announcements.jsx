import { useCallback, useEffect, useState } from "react";
import { Bell, Paperclip, AlertTriangle, ChevronDown, Download, Eye, X } from "lucide-react";
import { api, downloadFile } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useLiveRefresh } from "../context/LiveUpdatesContext.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import FileViewerModal from "../components/ui/FileViewerModal.jsx";
import { formatDate as formatShortDateOnly, parseDbDate } from "../utils/time.js";

function formatDate(value) {
  return formatShortDateOnly(value, "");
}

/**
 * Read-only digital bulletin. The server only ever returns published
 * announcements addressed to this account's audience — drafts, archived
 * notices, and anything aimed at a different audience never leave the
 * Admin Panel.
 */
export default function Announcements() {
  const { handleSessionInvalidated } = useAuth();
  const [items, setItems] = useState([]);
  const [state, setState] = useState("loading");
  const [openId, setOpenId] = useState(null);
  const [viewing, setViewing] = useState(null);
  // Filters: priority (All / Urgent / Normal) and the date an announcement was published.
  const [priority, setPriority] = useState("all");
  const [dateFilter, setDateFilter] = useState("");

  const load = useCallback(async (opts) => {
    setState((s) => (s === "ready" ? "ready" : "loading"));
    try {
      const data = await api.get("/api/office/announcements");
      setItems(data.items);
      setState("ready");
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      setState((s) => (opts?.background && s === "ready" ? "ready" : "error"));
    }
  }, [handleSessionInvalidated]);

  useEffect(() => {
    load();
  }, [load]);

  useLiveRefresh(["announcements"], load);

  // Newest published first, always. The server already sends them in that order;
  // sorting here keeps it true even when a live refresh merges new items in.
  const stamp = (a) => parseDbDate(a.published_at || a.created_at)?.getTime() ?? 0;
  const sorted = [...items].sort((a, b) => stamp(b) - stamp(a));
  const visible = sorted.filter((a) => {
    if (priority !== "all" && a.priority !== priority) return false;
    // "YYYY-MM-DD HH:mm:ss" is already Philippine wall-clock time, so its first 10 characters ARE the PH calendar day.
    if (dateFilter && String(a.published_at || a.created_at || "").slice(0, 10) !== dateFilter) return false;
    return true;
  });
  const filtering = priority !== "all" || Boolean(dateFilter);

  if (state === "loading") return <LoadingState label="Loading announcements..." />;
  if (state === "error") return <ErrorState message="Couldn't load announcements." onRetry={load} />;

  return (
    <>
      <div className="mb-5">
        <h1 className="font-heading text-xl font-bold text-slate-800 sm:text-2xl">Announcements</h1>
        <p className="mt-1 text-sm text-slate-500">
          Official notices published by the SAA office for authorized offices.
        </p>
      </div>

      {items.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-full bg-slate-200/70 p-1 text-xs font-semibold">
            {[
              { key: "all", label: "All" },
              { key: "urgent", label: "Urgent" },
              { key: "normal", label: "Normal" },
            ].map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setPriority(opt.key)}
                className={`rounded-full px-3.5 py-1.5 transition ${priority === opt.key ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            Date
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-sm font-normal text-slate-700 focus:border-brand-blue"
            />
          </label>
          {dateFilter && (
            <button
              type="button"
              onClick={() => setDateFilter("")}
              className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700"
            >
              <X size={13} /> Clear date
            </button>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState icon={Bell} title="No announcements yet" description="Notices addressed to you will appear here." />
      ) : visible.length === 0 && filtering ? (
        <EmptyState icon={Bell} title="No matching announcements" description="Try a different date or priority." />
      ) : (
        <ul className="space-y-3">
          {visible.map((a) => {
            const open = openId === a.id;
            return (
              <li
                key={a.id}
                className={`overflow-hidden rounded-xl2 border bg-white shadow-card ${
                  a.priority === "urgent" ? "border-red-200" : "border-slate-200"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : a.id)}
                  className="flex w-full items-start gap-3 px-4 py-4 text-left transition hover:bg-slate-50 sm:px-5"
                >
                  <div
                    className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl ${
                      a.priority === "urgent" ? "bg-red-100 text-status-danger" : "bg-amber-100 text-amber-600"
                    }`}
                  >
                    {a.priority === "urgent" ? <AlertTriangle size={17} /> : <Bell size={17} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {a.priority === "urgent" && (
                        <span className="rounded-full bg-status-danger px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                          Urgent
                        </span>
                      )}
                      <h2 className="font-heading text-[15px] font-semibold text-slate-800">{a.title}</h2>
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                      <span>{formatDate(a.published_at || a.created_at)}</span>
                      <span className="capitalize">To: {(a.audience || []).join(", ")}</span>
                      {a.attachments?.length > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Paperclip size={11} />
                          {a.attachments.length} attachment{a.attachments.length === 1 ? "" : "s"}
                        </span>
                      )}
                    </p>
                    {!open && <p className="mt-2 line-clamp-2 text-sm text-slate-600">{a.body}</p>}
                  </div>
                  <ChevronDown
                    size={17}
                    className={`mt-1 shrink-0 text-slate-300 transition-transform ${open ? "rotate-180" : ""}`}
                  />
                </button>

                {open && (
                  <div className="border-t border-slate-100 px-4 py-4 sm:px-5">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{a.body}</p>
                    {a.attachments?.length > 0 && (
                      <ul className="mt-4 space-y-2">
                        {a.attachments.map((f) => (
                          <li key={f.id} className="flex items-center gap-2.5 rounded-lg bg-slate-50 px-3 py-2.5 text-sm">
                            <Paperclip size={14} className="shrink-0 text-slate-400" />
                            <span className="min-w-0 flex-1 truncate text-slate-700">{f.original_name}</span>
                            <button type="button" onClick={() => setViewing(f)} className="shrink-0 text-slate-400 hover:text-brand-blue">
                              <Eye size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => downloadFile(f.id, f.original_name)}
                              className="shrink-0 text-slate-400 hover:text-brand-blue"
                            >
                              <Download size={15} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {viewing && (
        <FileViewerModal
          open
          onClose={() => setViewing(null)}
          fileName={viewing.original_name}
          viewUrl={`/api/uploads/${viewing.id}/view`}
          downloadUrl={`/api/uploads/${viewing.id}/download`}
        />
      )}
    </>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { HelpCircle, ChevronDown, MessageCircle, Minus, Search, Loader2 } from "lucide-react";
import { api } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLiveRefresh } from "../../context/LiveUpdatesContext.jsx";

/**
 * FAQ as a floating help box instead of a page of its own.
 *
 * It lives in the portal layout, so it is there on every screen: a round
 * "FAQ" button at the bottom-right opens a compact panel with the SAA
 * office's published answers (searchable, grouped by the categories the SAA
 * set in the Admin Panel). The minus button — or Esc — minimizes it back to
 * the button, and it stays minimized/open as you move between pages, so
 * help never takes you away from what you were doing.
 *
 * `endpoint` is the portal's own FAQ API (/api/portal/faq or /api/office/faq).
 */
export default function FaqWidget({ endpoint }) {
  const { handleSessionInvalidated } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [active, setActive] = useState("All");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(null);
  const [state, setState] = useState("idle"); // idle | loading | ready | error
  const everLoaded = useRef(false);

  const load = useCallback(
    async (opts) => {
      setState((s) => (opts?.background && s === "ready" ? "ready" : "loading"));
      try {
        const data = await api.get(endpoint);
        setItems(data.items);
        setCategories(data.categories);
        setState("ready");
        everLoaded.current = true;
      } catch (err) {
        if (handleSessionInvalidated(err)) return;
        setState((s) => (opts?.background && s === "ready" ? "ready" : "error"));
      }
    },
    [endpoint, handleSessionInvalidated]
  );

  // Fetched the first time the box is opened (not on every page load), then
  // kept current whenever the SAA edits an answer.
  useEffect(() => {
    if (open && !everLoaded.current && state === "idle") load();
  }, [open, state, load]);
  useLiveRefresh(["faq"], () => {
    if (everLoaded.current) load({ background: true });
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (f) =>
        (active === "All" || f.category === active) &&
        (!q || f.question.toLowerCase().includes(q) || String(f.answer || "").toLowerCase().includes(q))
    );
  }, [items, active, query]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open FAQ"
        title="Frequently asked questions"
        className="fixed bottom-5 right-5 z-40 flex h-12 items-center gap-2 rounded-full bg-brand-blue px-4 text-sm font-semibold text-white shadow-panel transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue sm:px-5"
      >
        <HelpCircle size={19} />
        <span className="hidden sm:inline">FAQ</span>
      </button>
    );
  }

  return (
    <section
      role="dialog"
      aria-label="Frequently asked questions"
      className="fixed bottom-5 right-5 z-40 flex h-[min(560px,calc(100vh-6rem))] w-[380px] max-w-[calc(100vw-2.5rem)] animate-toast-in flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-panel"
    >
      <header className="flex items-center gap-2.5 bg-brand-blue px-4 py-3 text-white">
        <HelpCircle size={18} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold leading-tight">Frequently Asked Questions</h2>
          <p className="truncate text-[11px] text-blue-100">Official answers from the SAA office</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Minimize FAQ"
          title="Minimize"
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-white/80 transition hover:bg-white/15 hover:text-white"
        >
          <Minus size={18} />
        </button>
      </header>

      <div className="border-b border-slate-100 px-3 pb-2.5 pt-3">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search questions..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-xs text-slate-700 placeholder:text-slate-400 focus:border-brand-blue focus:bg-white"
          />
        </div>
        {categories.length > 0 && (
          <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-0.5">
            {["All", ...categories].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setActive(c)}
                className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                  active === c ? "bg-brand-blue text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/60 px-3 py-3">
        {state === "loading" || state === "idle" ? (
          <div className="flex h-full items-center justify-center gap-2 text-xs text-slate-400">
            <Loader2 size={15} className="animate-spin" /> Loading FAQ...
          </div>
        ) : state === "error" ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-xs text-slate-500">
            <p>Couldn&rsquo;t load the FAQ.</p>
            <button type="button" onClick={() => load()} className="font-semibold text-brand-blue underline">
              Try again
            </button>
          </div>
        ) : shown.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center text-slate-400">
            <HelpCircle size={22} />
            <p className="text-sm font-medium text-slate-500">{query ? "No matching questions" : "No entries yet"}</p>
            <p className="max-w-[240px] text-xs">
              {query ? "Try different words, or ask the SAA office in SAA Chat." : "The SAA office hasn't published FAQ entries here."}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {shown.map((f) => {
              const expanded = openId === f.id;
              return (
                <li key={f.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <button
                    type="button"
                    onClick={() => setOpenId(expanded ? null : f.id)}
                    aria-expanded={expanded}
                    className="flex w-full items-start gap-2.5 px-3.5 py-3 text-left transition hover:bg-slate-50"
                  >
                    <span className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-slate-800">{f.question}</span>
                    <ChevronDown size={15} className={`mt-0.5 shrink-0 text-slate-300 transition-transform ${expanded ? "rotate-180" : ""}`} />
                  </button>
                  {expanded && (
                    <div className="border-t border-slate-100 px-3.5 py-3">
                      <span className="mb-1.5 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">{f.category}</span>
                      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-600">{f.answer}</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <footer className="flex items-center gap-2 border-t border-slate-100 bg-white px-4 py-2.5 text-xs text-slate-500">
        <MessageCircle size={14} className="shrink-0 text-brand-blue" />
        <span className="flex-1">Can&rsquo;t find your answer?</span>
        <Link to="/saa-chat" onClick={() => setOpen(false)} className="font-semibold text-brand-blue underline">
          Ask in SAA Chat
        </Link>
      </footer>
    </section>
  );
}

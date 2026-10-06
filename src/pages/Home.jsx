import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ClipboardList, PenTool, Users, Bell, ChevronRight, Activity } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useSummary } from "../context/SummaryContext.jsx";
import StatCard from "../components/ui/StatCard.jsx";
import QuickActions from "../components/ui/QuickActions.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import { phNow } from "../utils/time.js";

const TONE_DOT = {
  warning: "bg-status-warning",
  success: "bg-status-success",
  danger: "bg-status-danger",
  info: "bg-status-info",
};

function WelcomeBanner({ officeName, category }) {
  // "Today" in the Philippines, whatever the device's own clock zone is.
  const { weekday: day, longDate: date } = phNow();

  return (
    <div
      className="mb-6 overflow-hidden rounded-xl2 px-5 py-6 text-white shadow-card sm:px-8 sm:py-7"
      style={{ backgroundImage: "linear-gradient(120deg, #1e1b4b 0%, #312e81 55%, #3730a3 100%)" }}
    >
      <p className="text-[11px] font-bold uppercase tracking-[2px] text-gold">
        {category || "Office Portal"}
      </p>
      <h1 className="mt-1.5 font-display text-2xl font-extrabold sm:text-[28px]">Welcome back, {officeName}!</h1>
      <p className="mt-1 text-sm text-white/60">
        {day}, {date}
      </p>
    </div>
  );
}

function ActivityFeed({ activity }) {
  return (
    <section className="mt-7">
      <h2 className="mb-3 flex items-center gap-2 font-heading text-base font-semibold text-slate-800">
        <Activity size={17} className="text-brand-blue" />
        Activity updates
      </h2>
      <div className="overflow-hidden rounded-xl2 border border-slate-200 bg-white shadow-card">
        {activity.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">Nothing needs your office's attention right now.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {activity.map((item) => (
              <li key={item.id}>
                <Link to={item.to || "/"} className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-slate-50">
                  <span className={`size-2 shrink-0 rounded-full ${TONE_DOT[item.tone] || "bg-slate-300"}`} />
                  <p className="flex-1 text-sm text-slate-600">{item.message}</p>
                  <ChevronRight size={15} className="shrink-0 text-slate-300" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export default function Home() {
  const { office } = useAuth();
  const { summary, state, refresh } = useSummary();

  // Refetch every time Home is opened, so a decision SAA made while the tab
  // sat open isn't stale — same behavior as the Admin Panel's own Home.
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === "loading" && !summary) return <LoadingState label="Loading your office dashboard..." />;
  if (state === "error" && !summary) return <ErrorState message="Couldn't load your dashboard." onRetry={refresh} />;
  if (!summary) return null;

  const cards = [
    {
      key: "documents",
      icon: ClipboardList,
      iconClass: "bg-sky-100 text-sky-600",
      title: "Document Queue",
      to: "/document-queue",
      metrics: [
        { label: "Action needed", value: summary.documents.actionNeeded, tone: summary.documents.actionNeeded ? "warning" : undefined },
        { label: "Pending SAA review", value: summary.documents.pending },
      ],
    },
    {
      key: "signatures",
      icon: PenTool,
      iconClass: "bg-violet-100 text-violet-600",
      title: "E-Signature Requests",
      to: "/document-queue",
      metrics: [
        { label: "Awaiting your signature", value: summary.signatures.pending, tone: summary.signatures.pending ? "warning" : undefined },
        { label: "Confirmed", value: summary.signatures.confirmed, tone: "success" },
      ],
    },
    {
      key: "endorsements",
      icon: Users,
      iconClass: "bg-emerald-100 text-emerald-600",
      title: "Student Endorsement",
      to: "/student-endorsement",
      metrics: [
        { label: "Awaiting your response", value: summary.endorsements.pendingReceived, tone: summary.endorsements.pendingReceived ? "warning" : undefined },
        { label: "Sent by your office", value: summary.endorsements.sentTotal },
      ],
    },
    {
      key: "announcements",
      icon: Bell,
      iconClass: "bg-amber-100 text-amber-600",
      title: "Announcements",
      to: "/announcements",
      metrics: [
        { label: "New this week", value: summary.announcements.recent },
        { label: "Urgent", value: summary.announcements.urgent, tone: "danger" },
      ],
    },
  ];

  return (
    <>
      <WelcomeBanner officeName={office?.name} category={office?.category} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <StatCard key={c.key} icon={c.icon} iconClass={c.iconClass} title={c.title} metrics={c.metrics} to={c.to} />
        ))}
      </div>

      <QuickActions />

      <ActivityFeed activity={summary.activity} />
    </>
  );
}

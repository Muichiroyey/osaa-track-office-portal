import { Link } from "react-router-dom";
import { useSummary } from "../../context/SummaryContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { navGroupsFor } from "../layout/navConfig.js";

/**
 * Quick-action shortcuts to EVERY module in the sidebar (Home itself aside).
 * Built from the same navConfig the sidebar uses, so a module added to the
 * navigation later shows up here automatically — the two can never drift apart.
 * The red count is the same unread number the sidebar shows for that module.
 */
export default function QuickActions() {
  const { user } = useAuth();
  const { getVisibleBadge } = useSummary();
  const items = navGroupsFor(user?.type)
    .flatMap((g) => g.items)
    .filter((item) => !item.end);

  return (
    <section className="mt-7">
      <h2 className="mb-3 font-heading text-base font-semibold text-slate-800">Quick actions</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          const count = item.badgeKey ? getVisibleBadge(item.badgeKey) : 0;
          return (
            <Link
              key={item.to}
              to={item.to}
              className="group relative flex items-center gap-3 rounded-xl2 border border-slate-200 bg-white px-4 py-3.5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-blue/10 text-brand-blue">
                <Icon size={18} strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">{item.label}</span>
              {count > 0 && (
                <span className="flex h-[19px] min-w-[22px] items-center justify-center rounded-full bg-status-danger px-1.5 text-[10px] font-bold text-white">
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

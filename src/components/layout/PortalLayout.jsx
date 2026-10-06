import { useEffect, useState } from "react";
import { Outlet, useLocation, Link } from "react-router-dom";
import { KeyRound } from "lucide-react";
import Header from "./Header.jsx";
import Sidebar from "./Sidebar.jsx";
import FaqWidget from "./FaqWidget.jsx";
import { SummaryProvider } from "../../context/SummaryContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

// One-line nudge shown until the user replaces the password the SAA office
// issued them. Dismissible per session — it's a reminder, not a wall,
// since nothing about the account is unsafe to use in the meantime.
function IssuedPasswordNotice() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const location = useLocation();

  if (!user?.usingIssuedPassword || dismissed || location.pathname === "/settings") return null;

  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl2 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <KeyRound size={16} className="shrink-0" />
      <p className="flex-1">You&rsquo;re still using the password the SAA office gave you. Set your own in Settings.</p>
      <Link to="/settings" className="font-semibold underline">
        Change password
      </Link>
      <button type="button" onClick={() => setDismissed(true)} className="text-amber-600 underline">
        Later
      </button>
    </div>
  );
}

export default function PortalLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setSidebarOpen(false), [location.pathname]);

  return (
    <SummaryProvider>
      <div className="min-h-screen bg-slate-100">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="min-h-screen pl-0 pt-[76px] lg:pl-[300px]">
          <div className="mx-auto max-w-[1229px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
            <IssuedPasswordNotice />
            <Outlet />
          </div>
        </main>
        {/* FAQ is a floating, minimizable box on every screen — not a page of its own. */}
        <FaqWidget endpoint="/api/office/faq" />
      </div>
    </SummaryProvider>
  );
}

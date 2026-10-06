import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, LogOut, Menu, Settings as SettingsIcon } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import ProtectedImage from "../ui/ProtectedImage.jsx";
import psuSeal from "../../assets/psu-seal.png";
import saaSeal from "../../assets/saa-seal.png";

function SealBadge({ src, alt, className = "" }) {
  return (
    <div
      className={`flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-[1.6px] border-[#667eea] bg-white shadow-card sm:size-[52px] ${className}`}
    >
      <img src={src} alt={alt} className="size-full object-cover" />
    </div>
  );
}

function initials(name) {
  const value = (name || "?").trim();
  const parts = value.split(/\s+/).filter(Boolean);
  if (parts.length > 1) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return value.slice(0, 2).toUpperCase();
}

// Every account here is an authorized office, so the badge shows the
// office's own category (e.g. "Colleges", "Organizations", "Other
// Offices") instead of a student/alumni distinction.
const CATEGORY_BADGE_CLASS = "bg-[#e0e7ff] text-[#4338ca]";

export default function Header({ onMenuClick }) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const badgeLabel = user?.officeCategory || "Office";
  const displayName = user?.officeName || user?.name;

  return (
    <header className="fixed left-0 right-0 top-0 z-30 h-[76px] border-b-[1.6px] border-[#1e1b49] bg-gradient-to-b from-gold to-slate-100 shadow-card">
      <div className="flex h-full items-center justify-between gap-2 px-3 sm:px-6 lg:px-10">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4 lg:gap-6">
          <button
            type="button"
            aria-label="Open navigation menu"
            onClick={onMenuClick}
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-[#334155] transition hover:bg-black/5 lg:hidden"
          >
            <Menu size={22} />
          </button>

          <div className="hidden items-center gap-3 xs:flex">
            <SealBadge src={psuSeal} alt="Pangasinan State University seal" />
            <SealBadge src={saaSeal} alt="Student and Alumni Affairs Unit seal" className="hidden sm:flex" />
          </div>
          <div className="hidden h-11 w-px bg-black/70 sm:block" />
          <div className="min-w-0">
            <h1 className="truncate font-heading text-base font-bold tracking-[0.5px] text-[#2c3e50] sm:text-xl">
              OSAA-TRACK
            </h1>
            <p className="hidden truncate text-[11px] font-medium uppercase tracking-[0.9px] text-[#7f8c8d] sm:block">
              Pangasinan State University &ndash; Lingayen
            </p>
          </div>
        </div>

        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-xl2 px-1.5 py-1.5 transition hover:bg-black/5 sm:gap-3.5 sm:px-3.5 sm:py-2.5"
          >
            {user?.avatarFileId ? (
              <ProtectedImage
                file={{ id: user.avatarFileId }}
                alt={user?.name}
                className="size-9 shrink-0 rounded-full shadow-card sm:size-10"
              />
            ) : (
              <div
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-card sm:size-10"
                style={{ backgroundImage: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}
              >
                {initials(user?.name)}
              </div>
            )}
            <div className="hidden text-left md:block">
              <p className="max-w-[200px] truncate text-sm font-semibold text-[#2c3e50]">{displayName}</p>
              <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${CATEGORY_BADGE_CLASS}`}>
                {badgeLabel}
              </span>
            </div>
            <ChevronDown size={16} className="hidden text-slate-500 sm:block" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-60 animate-toast-in overflow-hidden rounded-xl2 border border-slate-200 bg-white py-1.5 shadow-panel">
              <div className="border-b border-slate-100 px-4 py-2.5">
                <p className="text-xs text-slate-500">Signed in as</p>
                <p className="truncate text-sm font-medium text-slate-700">{displayName}</p>
                <p className="truncate text-xs text-slate-400">{user?.email}</p>
                <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${CATEGORY_BADGE_CLASS}`}>
                  {badgeLabel}
                </span>
              </div>
              <Link
                to="/settings"
                onClick={() => setMenuOpen(false)}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-slate-600 transition hover:bg-slate-50"
              >
                <SettingsIcon size={16} />
                Settings
              </Link>
              <button
                type="button"
                onClick={logout}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-status-danger transition hover:bg-red-50"
              >
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

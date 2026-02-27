import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import clsx from "clsx";
import { useAuth } from "../../Hooks/useAuthHook";
import {
  Briefcase,
  Bell,
  ChevronDown,
  LogOut,
  LayoutDashboard,
  Bookmark,
  FileText,
  User,
} from "lucide-react";

/* ─── Design tokens (scoped) ─── */
const NAV_TOKENS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
  .nav-root { font-family: 'DM Sans', sans-serif; }
  :root {
    --nav-ink:      #0d0d12;
    --nav-ink-70:   rgba(13,13,18,0.70);
    --nav-ink-40:   rgba(13,13,18,0.40);
    --nav-ink-08:   rgba(13,13,18,0.08);
    --nav-slate:    #1e2235;
    --nav-slate-2:  #2d3352;
    --nav-amber:    #d97706;
    --nav-border:   rgba(13,13,18,0.09);
    --nav-cream:    #faf9f7;
    --nav-shadow-sm: 0 1px 3px rgba(13,13,18,.07), 0 1px 2px rgba(13,13,18,.05);
    --nav-shadow-lg: 0 20px 60px rgba(13,13,18,.11), 0 8px 20px rgba(13,13,18,.07);
  }
`;

const NAV_LINKS = [
  { href: "/jobs", label: "Find Jobs" },
  { href: "/companies", label: "Companies" },
  { href: "/salaries", label: "Salaries" },
];

const PROFILE_LINKS = [
  { label: "My Profile", href: "/profile", icon: User },
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Applications", href: "/applications", icon: FileText },
  { label: "Saved Jobs", href: "/saved", icon: Bookmark },
];

const Nav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user, logout } = useAuth();

  const [scrolled, setScrolled] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  /* scroll shadow */
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const isActive = (href) => location.pathname === href;

  const handleLogout = () => {
    logout({});
    setProfileOpen(false);
    navigate("/login");
  };

  return (
    <>
      <style>{NAV_TOKENS}</style>

      <motion.header
        initial={{ y: -64, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className={clsx(
          "nav-root sticky top-0 z-50 transition-all duration-300",
          scrolled
            ? "bg-white/95 backdrop-blur-xl shadow-(--nav-shadow-sm) border-b border-(--nav-border)"
            : "bg-white border-b border-(--nav-border)",
        )}
      >
        <nav className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between gap-8">
          {/* ── Logo ── */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="w-9 h-9 rounded-xl bg-(--nav-slate) flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
              <Briefcase size={17} className="text-white" />
            </div>
            <div className="leading-none">
              <span className="font-bold text-(--nav-ink) text-[15px] tracking-tight block">
                Talk2Hire
              </span>
              <span className="text-[10px] text-(--nav-amber) font-semibold tracking-wide">
                Careers Portal
              </span>
            </div>
          </Link>

          {/* ── Nav links (center) ── */}
          <div className="hidden md:flex items-center gap-1 flex-1">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                to={href}
                className={clsx(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                  isActive(href)
                    ? "bg-(--nav-slate) text-white"
                    : "text-(--nav-ink-70) hover:text-(--nav-ink) hover:bg-(--nav-ink-08)",
                )}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* ── Right side ── */}
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                {/* Notification bell */}
                <button className="relative w-9 h-9 flex items-center justify-center rounded-lg text-(--nav-ink-40) hover:text-(--nav-ink) hover:bg-(--nav-ink-08) transition-all">
                  <Bell size={17} />
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
                </button>

                <div className="w-px h-6 bg-(--nav-border)" />

                {/* Profile dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setProfileOpen((p) => !p)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-(--nav-ink-08) transition-all"
                  >
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-lg bg-(--nav-slate) flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0">
                      {user?.fullName?.[0]?.toUpperCase() ?? "U"}
                    </div>

                    <div className="hidden sm:flex flex-col items-start leading-none">
                      <span className="text-sm font-semibold text-(--nav-ink) max-w-30 truncate">
                        {user?.fullName ?? "Profile"}
                      </span>
                      <span className="text-[10px] text-(--nav-ink-40) mt-0.5 truncate max-w-30">
                        {user?.email ?? ""}
                      </span>
                    </div>

                    <ChevronDown
                      size={13}
                      className={clsx(
                        "text-(--nav-ink-40) transition-transform duration-200 shrink-0",
                        profileOpen && "rotate-180",
                      )}
                    />
                  </button>

                  {/* Dropdown */}
                  <AnimatePresence>
                    {profileOpen && (
                      <>
                        {/* Backdrop */}
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setProfileOpen(false)}
                        />

                        <motion.div
                          initial={{ opacity: 0, y: 6, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 6, scale: 0.96 }}
                          transition={{ duration: 0.15, ease: "easeOut" }}
                          className="absolute right-0 top-full mt-2 w-56 bg-white border border-(--nav-border) rounded-2xl shadow-(--nav-shadow-lg) z-20 overflow-hidden"
                        >
                          {/* User info header */}
                          <div className="px-4 py-3 bg-(--nav-cream) border-b border-(--nav-border)">
                            <p className="text-xs font-bold text-(--nav-ink)] truncate">
                              {user?.fullName ?? "User"}
                            </p>
                            <p className="text-[11px] text-(--nav-ink-40) truncate mt-0.5">
                              {user?.email ?? ""}
                            </p>
                          </div>

                          {/* Menu items */}
                          <div className="p-1.5">
                            {PROFILE_LINKS.map(
                              ({ label, href, icon: Icon }) => (
                                <button
                                  key={href}
                                  onClick={() => {
                                    navigate(href);
                                    setProfileOpen(false);
                                  }}
                                  className={clsx(
                                    "w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-all text-left",
                                    isActive(href)
                                      ? "bg-(--nav-ink-08)] text-(--nav-ink) font-medium"
                                      : "text-(--nav-ink-70) hover:text-(--nav-ink) hover:bg-(--nav-ink-08)",
                                  )}
                                >
                                  <Icon
                                    size={14}
                                    className="text-(--nav-ink-40)] shrink-0"
                                  />
                                  {label}
                                </button>
                              ),
                            )}
                          </div>

                          {/* Sign out */}
                          <div className="p-1.5 border-t border-(--nav-border)">
                            <button
                              onClick={handleLogout}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all text-left"
                            >
                              <LogOut size={14} className="shrink-0" />
                              Sign Out
                            </button>
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              /* Unauthenticated */
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-medium text-(--nav-ink-70) hover:text-(--nav-ink) hover:bg-(--nav-ink-08) rounded-lg transition-all"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  className="px-4 py-2 text-sm font-semibold text-white bg-(--nav-slate) rounded-xl shadow-md hover:bg-(--nav-slate-2) hover:shadow-lg transition-all"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </nav>
      </motion.header>
    </>
  );
};

export default Nav;

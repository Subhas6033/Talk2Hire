import { useState } from "react";
import { useNavigate } from "react-router-dom";

const Icon = {
  Dashboard: () => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="w-4 h-4"
    >
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  Users: () => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="w-4 h-4"
    >
      <circle cx="9" cy="7" r="4" />
      <path d="M2 21v-2a7 7 0 0 1 14 0v2" />
      <circle cx="18" cy="8" r="3" />
      <path d="M21 21v-1.5a5 5 0 0 0-4-4.9" />
    </svg>
  ),
  Building: () => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="w-4 h-4"
    >
      <path d="M3 21h18M5 21V7l7-4 7 4v14" />
      <path d="M9 21v-4h6v4" />
      <path d="M9 11h1m4 0h1M9 15h1m4 0h1" />
    </svg>
  ),
  Blog: () => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="w-4 h-4"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  ),
  Jobs: () => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="w-4 h-4"
    >
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M12 12v4M10 14h4" />
    </svg>
  ),
  Settings: () => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="w-4 h-4"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  Bell: () => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="w-5 h-5"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  Search: () => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="w-4 h-4"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  ),
  ChevronDown: () => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="w-4 h-4"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  ),
  Menu: () => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="w-5 h-5"
    >
      <path d="M3 12h18M3 6h18M3 18h18" />
    </svg>
  ),
  X: () => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="w-5 h-5"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  ),
  LogOut: () => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="w-4 h-4"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  ),
};

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: <Icon.Dashboard /> },
  { id: "users", label: "Users", icon: <Icon.Users /> },
  { id: "companies", label: "Companies", icon: <Icon.Building /> },
  { id: "blog", label: "Blog", icon: <Icon.Blog /> },
  { id: "jobs", label: "Jobs", icon: <Icon.Jobs /> },
  { id: "settings", label: "Settings", icon: <Icon.Settings /> },
];

function Avatar({ initials }) {
  return (
    <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
      {initials}
    </span>
  );
}

const AdminNav = ({ active, setActive }) => {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const notifs = [
    {
      text: "Stripe upgraded to Enterprise",
      time: "2 min ago",
      dot: "bg-indigo-500",
    },
    {
      text: "Priya Nair account deactivated",
      time: "14 min ago",
      dot: "bg-amber-400",
    },
    {
      text: "New blog post published",
      time: "1 hr ago",
      dot: "bg-emerald-500",
    },
    { text: "Atlassian signed up", time: "3 hr ago", dot: "bg-cyan-500" },
  ];

  const closeAll = () => {
    setNotifOpen(false);
    setProfileOpen(false);
  };
  const handleNav = (id) => {
    setActive(id);
    closeAll();
    setMobileOpen(false);
  };

  return (
    <header className="bg-white border-b border-gray-100 shrink-0 relative z-40">
      <div className="flex items-center justify-between px-4 sm:px-6 h-16 gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2.5 shrink-0 hover:cursor-pointer">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-sm"
            style={{ background: "linear-gradient(135deg, #4F6EF7, #7C3AED)" }}
          >
            T
          </div>
          <span className="font-black text-gray-900 text-base tracking-tight hidden sm:block">
            Talk2Hire
          </span>
          <span className="text-xs font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded-full">
            Admin
          </span>
        </div>

        {/* Desktop nav links */}
        <nav className="hidden lg:flex items-center gap-0.5 flex-1 justify-center">
          {NAV.map(({ id, label, icon }) => {
            const isActive = active === id;
            return (
              <button
                key={id}
                onClick={() => handleNav(id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all hover:cursor-pointer ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                }`}
              >
                <span
                  className={isActive ? "text-indigo-500" : "text-gray-400"}
                >
                  {icon}
                </span>
                {label}
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 ml-0.5" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Right side actions */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Search — xl+ only */}
          <div className="hidden xl:flex relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              <Icon.Search />
            </span>
            <input
              type="text"
              placeholder="Quick search…"
              className="pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl w-44 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 focus:bg-white transition-all"
            />
          </div>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => {
                setNotifOpen((o) => !o);
                setProfileOpen(false);
              }}
              className="relative p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 hover:cursor-pointer rounded-xl transition-all"
            >
              <Icon.Bell />
              {notifs.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-11 w-72 sm:w-80 bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-900">
                    Notifications
                  </span>
                  <span className="text-xs bg-red-50 text-red-600 font-bold px-2 py-0.5 rounded-full">
                    {notifs.length} new
                  </span>
                </div>
                <div className="divide-y divide-gray-50 max-h-60 overflow-y-auto">
                  {notifs.map((n, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <span
                        className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.dot}`}
                      />
                      <div>
                        <p className="text-sm text-gray-700">{n.text}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{n.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-2.5 border-t border-gray-100 text-center">
                  <button className="text-xs text-indigo-600 font-semibold hover:underline">
                    View all notifications
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="w-px h-6 bg-gray-200 hidden sm:block" />

          {/* Profile */}
          <div className="relative">
            <button
              onClick={() => {
                setProfileOpen((o) => !o);
                setNotifOpen(false);
              }}
              className="flex items-center gap-2 p-1 pr-2 rounded-xl hover:bg-gray-50 hover:cursor-pointer transition-all"
            >
              <Avatar initials="AD" />
              <div className="hidden md:block text-left">
                <p className="text-sm font-bold text-gray-900 leading-tight">
                  Admin
                </p>
                <p className="text-xs text-gray-400 leading-tight">
                  admin@talk2hire.com
                </p>
              </div>
              <span
                className={`text-gray-400 hidden sm:block transition-transform duration-200 ${profileOpen ? "rotate-180" : ""}`}
              >
                <Icon.ChevronDown />
              </span>
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-11 w-52 bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-bold text-gray-900">Admin User</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    admin@talk2hire.com
                  </p>
                </div>
                <div className="py-1.5">
                  {[
                    { label: "Profile", icon: <Icon.Users /> },
                    { label: "Settings", icon: <Icon.Settings /> },
                  ].map(({ label, icon }) => (
                    <button
                      key={label}
                      onClick={() => handleNav(label.toLowerCase())}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                    >
                      <span className="text-gray-400">{icon}</span>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="py-1.5 border-t border-gray-100">
                  <button
                    onClick={() => navigate("/")}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Icon.LogOut />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen((o) => !o)}
            className="lg:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-xl transition-all"
          >
            {mobileOpen ? <Icon.X /> : <Icon.Menu />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-1">
          <div className="relative mb-3">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              <Icon.Search />
            </span>
            <input
              type="text"
              placeholder="Quick search…"
              className="pl-9 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl w-full focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          {NAV.map(({ id, label, icon }) => {
            const isActive = active === id;
            return (
              <button
                key={id}
                onClick={() => handleNav(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                }`}
              >
                <span
                  className={isActive ? "text-indigo-500" : "text-gray-400"}
                >
                  {icon}
                </span>
                {label}
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
};

export default AdminNav;

import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useCompany } from "../../Hooks/useCompanyAuthHook";
import { useMicrosoftAuth } from "../../Hooks/useMicrosoftCompanyAuthHook";
import {
  LayoutDashboard,
  Briefcase,
  Video,
  LogOut,
  Bell,
  ChevronDown,
  Building2,
  Home,
} from "lucide-react";

export default function CompanyNavbar() {
  const [profileOpen, setProfileOpen] = useState(false);

  const {
    isAuthenticated: isEmailAuth,
    company: emailCompany,
    logout: emailLogout,
  } = useCompany();
  const {
    isAuthenticated: isMsAuth,
    company: msCompany,
    logout: msLogout,
  } = useMicrosoftAuth();

  // Merge — Microsoft takes priority if active
  const isAuthenticated = isEmailAuth || isMsAuth;
  const company = isMsAuth ? msCompany : emailCompany;

  const location = useLocation();
  const navigate = useNavigate();

  const NAV = [
    { id: "/company", label: "Home", icon: Home },
    { id: "/company/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "/company/jobs", label: "Post a Job", icon: Briefcase },
    { id: "/company/interviews", label: "Interviews", icon: Video },
  ];

  const handleLogout = async () => {
    setProfileOpen(false);
    if (isMsAuth) {
      await msLogout();
    } else {
      await emailLogout();
    }
    navigate("/login/company", { replace: true });
  };

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* ── Logo ── */}
          <button
            onClick={() => navigate("/company")}
            className="flex items-center gap-2.5 group"
          >
            <div className="flex items-center gap-2 leading-none">
              <img
                src="/talk2hirelogo.png"
                alt="Talk2Hire"
                className="h-12 w-12 rounded-full"
              />
              <div>
                <span className="font-bold text-gray-900 text-[15px] tracking-tight block">
                  Talk2Hire
                </span>
                <span className="text-[10px] text-amber-600 font-semibold tracking-wide">
                  Business Portal
                </span>
              </div>
            </div>
          </button>

          {/* ── Nav Links (authenticated) ── */}
          {isAuthenticated && (
            <div className="hidden md:flex items-center gap-1">
              {NAV.map(({ id, label, icon: Icon }) => {
                const active = location.pathname === id;
                return (
                  <button
                    key={id}
                    onClick={() => navigate(id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      active
                        ? "bg-indigo-50 text-indigo-600"
                        : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                    }`}
                  >
                    <Icon
                      size={15}
                      className={active ? "text-indigo-500" : "text-gray-400"}
                    />
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Right Side ── */}
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <button className="relative w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all">
                <Bell size={18} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
              </button>

              <div className="w-px h-6 bg-gray-200" />

              <div className="relative">
                <button
                  onClick={() => setProfileOpen((p) => !p)}
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-gray-100 transition-all"
                >
                  {company?.logo ? (
                    <img
                      src={company.logo}
                      alt={company.companyName ?? "Company"}
                      className="w-8 h-8 rounded-lg object-cover shadow-sm"
                    />
                  ) : (
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-sm"
                      style={{
                        background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                      }}
                    >
                      {company?.companyName?.[0]?.toUpperCase() ?? "C"}
                    </div>
                  )}
                  <div className="hidden sm:flex flex-col items-start leading-none">
                    <span className="text-sm font-semibold text-gray-800 max-w-30 truncate">
                      {company?.companyName ?? "Company"}
                    </span>
                    <span className="text-[10px] text-gray-400 mt-0.5">
                      {company?.companyMail ?? ""}
                    </span>
                  </div>
                  <ChevronDown
                    size={14}
                    className={`text-gray-400 transition-transform duration-200 ${profileOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {profileOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setProfileOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-gray-200 rounded-2xl shadow-xl z-20 overflow-hidden">
                      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                        <p className="text-xs font-semibold text-gray-800 truncate">
                          {company?.companyName ?? "Company"}
                        </p>
                        <p className="text-[11px] text-gray-400 truncate mt-0.5">
                          {company?.companyMail ?? ""}
                        </p>
                      </div>

                      <div className="p-1.5">
                        <button
                          onClick={() => {
                            navigate("/company/profile");
                            setProfileOpen(false);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all text-left"
                        >
                          <Building2 size={15} className="text-gray-400" />
                          Company Profile
                        </button>
                        <button
                          onClick={() => {
                            navigate("/company/jobs");
                            setProfileOpen(false);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all text-left"
                        >
                          <Briefcase size={15} className="text-gray-400" />
                          Manage Jobs
                        </button>
                      </div>

                      <div className="p-1.5 border-t border-gray-100">
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all text-left"
                        >
                          <LogOut size={15} />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate("/login/company")}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate("/signup/company")}
                className="px-4 py-2 text-sm font-semibold text-white rounded-lg shadow-md hover:shadow-lg transition-all"
                style={{
                  background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                }}
              >
                Get Started
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

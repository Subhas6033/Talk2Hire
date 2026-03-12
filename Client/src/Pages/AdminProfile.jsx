import { useState } from "react";
import useAdminAuth from "../Hooks/useAdminAuthHook";

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600;700&display=swap');

  .dash-root { font-family: 'DM Sans', sans-serif; }
  .display-font { font-family: 'DM Serif Display', serif; }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; } to { opacity: 1; }
  }
  @keyframes shimmer {
    0%   { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }

  .anim-fade-up { animation: fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both; }
  .anim-fade-in { animation: fadeIn 0.35s ease both; }

  .skeleton {
    background: linear-gradient(90deg, #f3f4f6 25%, #e9eaec 50%, #f3f4f6 75%);
    background-size: 400px 100%;
    animation: shimmer 1.4s infinite;
  }

  .card-hover { transition: box-shadow 0.2s ease, border-color 0.2s ease; }
  .card-hover:hover { box-shadow: 0 4px 24px rgba(0,0,0,0.06); border-color: #e0e0e0; }

  .logout-btn { transition: all 0.15s ease; }
  .logout-btn:hover { transform: translateY(-1px); }
  .logout-btn:active { transform: translateY(0); }

  .toast { animation: fadeUp 0.35s cubic-bezier(0.16,1,0.3,1) both; }
`;

const ROLE_STYLES = {
  super_admin: "bg-violet-50 text-violet-700 border-violet-100",
  admin: "bg-indigo-50 text-indigo-700 border-indigo-100",
  moderator: "bg-cyan-50 text-cyan-700 border-cyan-100",
  support: "bg-emerald-50 text-emerald-700 border-emerald-100",
};

const ROLE_LABELS = {
  super_admin: "Super Admin",
  admin: "Admin",
  moderator: "Moderator",
  support: "Support",
};

function RoleBadge({ role }) {
  return (
    <span
      className={`inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full border ${ROLE_STYLES[role] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}
    >
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

function AdminAvatar({ name = "?", size = "lg" }) {
  const palette = [
    ["#eef2ff", "#4338ca"],
    ["#f5f3ff", "#7c3aed"],
    ["#ecfeff", "#0e7490"],
    ["#ecfdf5", "#065f46"],
    ["#fffbeb", "#92400e"],
    ["#fff1f2", "#9f1239"],
  ];
  const initials = (name || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const [bg, color] = palette[initials.charCodeAt(0) % palette.length];
  const sizeClass = size === "lg" ? "w-20 h-20 text-2xl" : "w-10 h-10 text-sm";

  return (
    <span
      className={`${sizeClass} rounded-2xl flex items-center justify-center font-bold shrink-0`}
      style={{ background: bg, color }}
    >
      {initials}
    </span>
  );
}

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between py-3.5 border-b border-gray-50 last:border-0">
      <span className="text-xs font-medium text-gray-400 w-32 shrink-0">
        {label}
      </span>
      <span className="text-xs font-semibold text-gray-700 text-right">
        {value}
      </span>
    </div>
  );
}

function StatCard({ label, value, icon, delay = 0 }) {
  return (
    <div
      className="anim-fade-up bg-white rounded-2xl border border-gray-100 p-5 card-hover"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xl">{icon}</span>
      </div>
      <p className="display-font text-3xl text-gray-900 leading-none mb-1">
        {value ?? "—"}
      </p>
      <p className="text-xs text-gray-400 font-medium">{label}</p>
    </div>
  );
}

function SkeletonProfile() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-8">
      <div className="flex items-start gap-6 mb-8">
        <div className="skeleton w-20 h-20 rounded-2xl" />
        <div className="flex-1 space-y-3 pt-1">
          <div className="skeleton h-5 w-48 rounded" />
          <div className="skeleton h-3 w-32 rounded" />
          <div className="skeleton h-6 w-20 rounded-full" />
        </div>
      </div>
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="flex justify-between py-3.5 border-b border-gray-50"
        >
          <div className="skeleton h-3 w-24 rounded" />
          <div className="skeleton h-3 w-32 rounded" />
        </div>
      ))}
    </div>
  );
}

function LogoutModal({ onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm anim-fade-in">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xl p-6 w-full max-w-sm mx-4 anim-fade-up">
        <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center mb-4">
          <span className="text-lg">👋</span>
        </div>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Sign out?</h3>
        <p className="text-xs text-gray-500 mb-5">
          You'll need to log in again to access the admin panel.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-xs font-semibold text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

function Toast({ message, type = "success", onClose }) {
  return (
    <div
      className={`toast fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium ${
        type === "error"
          ? "bg-red-50 border-red-200 text-red-700"
          : "bg-emerald-50 border-emerald-200 text-emerald-700"
      }`}
    >
      <span>{type === "error" ? "✕" : "✓"}</span>
      {message}
      <button
        onClick={onClose}
        className="ml-2 opacity-60 hover:opacity-100 text-xs"
      >
        ✕
      </button>
    </div>
  );
}

const AdminProfile = () => {
  const { admin, loading, logout, getProfile } = useAdminAuth();
  const [showLogout, setShowLogout] = useState(false);
  const [toast, setToast] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await getProfile();
      setToast({ message: "Profile refreshed.", type: "success" });
    } catch {
      setToast({ message: "Failed to refresh profile.", type: "error" });
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = async () => {
    setShowLogout(false);
    await logout();
  };

  const formatDate = (d) => {
    if (!d) return null;
    return new Date(d).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const permissions = {
    super_admin: [
      "Full system access",
      "Manage admins",
      "Delete any record",
      "View audit logs",
    ],
    admin: [
      "Manage users & companies",
      "Manage jobs & blogs",
      "View stats",
      "Moderate content",
    ],
    moderator: ["Manage jobs", "Moderate content", "View stats"],
    support: ["View users", "View companies", "View stats"],
  };

  return (
    <div className="dash-root min-h-screen bg-[#f8f9fb] p-5 sm:p-7 lg:p-9">
      <style>{STYLES}</style>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      {showLogout && (
        <LogoutModal
          onConfirm={handleLogout}
          onCancel={() => setShowLogout(false)}
        />
      )}

      <div className="anim-fade-up flex items-end justify-between mb-8">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-1">
            Account
          </p>
          <h1 className="display-font text-3xl sm:text-4xl text-gray-900 leading-none">
            My Profile
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-white hover:shadow-sm transition-all disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "↻ Refresh"}
          </button>
          <button
            onClick={() => setShowLogout(true)}
            className="logout-btn px-4 py-2 rounded-xl bg-gray-900 text-xs font-semibold text-white hover:bg-gray-800 transition-all"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {loading && !admin ? (
            <SkeletonProfile />
          ) : (
            <div
              className="anim-fade-up bg-white rounded-2xl border border-gray-100 p-8"
              style={{ animationDelay: "60ms" }}
            >
              <div className="flex flex-col sm:flex-row items-start gap-5 mb-8 pb-8 border-b border-gray-50">
                <AdminAvatar name={admin?.name || admin?.email} size="lg" />
                <div className="flex-1 min-w-0">
                  <h2 className="display-font text-2xl text-gray-900 leading-tight mb-1">
                    {admin?.name || "Admin"}
                  </h2>
                  <p className="text-sm text-gray-500 mb-3">{admin?.email}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <RoleBadge role={admin?.role} />
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-100">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Active session
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-4">
                  Account Details
                </p>
                <InfoRow label="Full Name" value={admin?.name} />
                <InfoRow label="Email" value={admin?.email} />
                <InfoRow
                  label="Role"
                  value={ROLE_LABELS[admin?.role] ?? admin?.role}
                />
                <InfoRow
                  label="Admin ID"
                  value={admin?.id ? `#${admin.id}` : null}
                />
                <InfoRow
                  label="Member Since"
                  value={formatDate(admin?.created_at)}
                />
                <InfoRow
                  label="Last Updated"
                  value={formatDate(admin?.updated_at)}
                />
              </div>
            </div>
          )}

          <div
            className="anim-fade-up bg-white rounded-2xl border border-gray-100 p-6"
            style={{ animationDelay: "120ms" }}
          >
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-5">
              Permissions
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
              {(permissions[admin?.role] ?? []).map((perm, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-100"
                  style={{
                    animation: `fadeUp 0.4s ease ${140 + i * 40}ms both`,
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                  <span className="text-xs font-medium text-gray-700">
                    {perm}
                  </span>
                </div>
              ))}
              {!admin?.role && (
                <p className="text-xs text-gray-400 col-span-2">
                  No permissions data available.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div
            className="anim-fade-up bg-white rounded-2xl border border-gray-100 p-6"
            style={{ animationDelay: "80ms" }}
          >
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-5">
              Session Info
            </p>
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">
                  Status
                </p>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-semibold text-gray-700">
                    Authenticated
                  </span>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">
                  Token
                </p>
                <span className="text-xs font-medium text-gray-600 bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg font-mono">
                  Bearer ••••••••
                </span>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">
                  Access
                </p>
                <span className="text-xs text-gray-600">
                  Auto-refreshes every 15 min
                </span>
              </div>
            </div>
          </div>

          <div
            className="anim-fade-up bg-white rounded-2xl border border-gray-100 p-6"
            style={{ animationDelay: "160ms" }}
          >
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-5">
              Quick Actions
            </p>
            <div className="space-y-2">
              {[
                {
                  label: "Admin Dashboard",
                  href: "/admin/dashboard",
                  icon: "📊",
                },
                { label: "User Management", href: "/admin/users", icon: "👥" },
                {
                  label: "Company Management",
                  href: "/admin/companies",
                  icon: "🏢",
                },
                { label: "Job Management", href: "/admin/jobs", icon: "💼" },
                { label: "Blog Management", href: "/admin/blog", icon: "📝" },
              ].map(({ label, href, icon }) => (
                <a
                  key={href}
                  href={href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors group"
                >
                  <span className="text-base">{icon}</span>
                  <span className="text-xs font-semibold text-gray-600 group-hover:text-gray-900 transition-colors flex-1">
                    {label}
                  </span>
                  <span className="text-gray-300 group-hover:text-gray-500 text-xs transition-colors">
                    →
                  </span>
                </a>
              ))}
            </div>
          </div>

          <div
            className="anim-fade-up bg-white rounded-2xl border border-red-50 p-6"
            style={{ animationDelay: "200ms" }}
          >
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-4">
              Danger Zone
            </p>
            <p className="text-xs text-gray-500 mb-4">
              Signing out will end your current session and clear all local
              admin data.
            </p>
            <button
              onClick={() => setShowLogout(true)}
              className="logout-btn w-full px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 text-xs font-semibold text-red-600 hover:bg-red-100 transition-all"
            >
              Sign out of admin panel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminProfile;

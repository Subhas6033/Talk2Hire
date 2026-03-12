import { useState, useEffect, useRef, useCallback } from "react";
import { useAdminUsers } from "../Hooks/useAdminUserManage";

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600;700&display=swap');

  .dash-root { font-family: 'DM Sans', sans-serif; }
  .display-font { font-family: 'DM Serif Display', serif; }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; } to { opacity: 1; }
  }
  @keyframes slideIn {
    from { opacity: 0; transform: translateX(-8px); }
    to   { opacity: 1; transform: translateX(0); }
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

  .row-hover { transition: background 0.15s ease; }
  .row-hover:hover { background: #fafafa; }

  .sort-btn { cursor: pointer; user-select: none; }
  .sort-btn:hover { color: #111; }

  .search-input:focus { outline: none; }

  .action-btn {
    transition: all 0.15s ease;
  }
  .action-btn:hover { transform: scale(1.05); }
  .action-btn:active { transform: scale(0.97); }

  .toast {
    animation: fadeUp 0.35s cubic-bezier(0.16,1,0.3,1) both;
  }
`;

function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function Toast({ message, type = "error", onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

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

function InitAvatar({ name = "??" }) {
  const palette = [
    ["#eef2ff", "#4338ca"],
    ["#f5f3ff", "#7c3aed"],
    ["#ecfeff", "#0e7490"],
    ["#ecfdf5", "#065f46"],
    ["#fffbeb", "#92400e"],
    ["#fff1f2", "#9f1239"],
  ];
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const [bg, color] = palette[initials.charCodeAt(0) % palette.length];
  return (
    <span
      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
      style={{ background: bg, color }}
    >
      {initials}
    </span>
  );
}

function StatusBadge({ active }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full border ${
        active
          ? "bg-emerald-50 text-emerald-700 border-emerald-100"
          : "bg-gray-50 text-gray-500 border-gray-200"
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-gray-400"}`}
      />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function SortIcon({ active, dir }) {
  return (
    <span
      className="ml-1 inline-flex flex-col gap-px opacity-40"
      style={{ opacity: active ? 1 : 0.35 }}
    >
      <span
        className={`block w-0 h-0 border-l-[3px] border-r-[3px] border-b-4 border-transparent ${active && dir === "asc" ? "border-b-indigo-600" : "border-b-gray-400"}`}
        style={{
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
        }}
      />
      <span
        className={`block w-0 h-0 border-l-[3px] border-r-[3px] border-t-4 border-transparent ${active && dir === "desc" ? "border-t-indigo-600" : "border-t-gray-400"}`}
        style={{
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
        }}
      />
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {[40, 160, 180, 80, 100, 80].map((w, i) => (
        <td key={i} className="px-5 py-4">
          <div className="skeleton h-3 rounded" style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

function ConfirmModal({ user, onConfirm, onCancel, type }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm anim-fade-in">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xl p-6 w-full max-w-sm mx-4 anim-fade-up">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center mb-4 ${type === "delete" ? "bg-red-50" : "bg-amber-50"}`}
        >
          <span className="text-lg">{type === "delete" ? "🗑" : "⚠️"}</span>
        </div>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">
          {type === "delete"
            ? "Delete user?"
            : `${user?.is_active ? "Deactivate" : "Activate"} user?`}
        </h3>
        <p className="text-xs text-gray-500 mb-5">
          {type === "delete"
            ? `This will permanently delete ${user?.fullName}. This action cannot be undone.`
            : `${user?.is_active ? "This user will lose access to the platform." : "This user will regain access to the platform."}`}
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
            className={`flex-1 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-colors ${
              type === "delete"
                ? "bg-red-500 hover:bg-red-600"
                : "bg-gray-900 hover:bg-gray-800"
            }`}
          >
            {type === "delete"
              ? "Delete"
              : user?.is_active
                ? "Deactivate"
                : "Activate"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Pagination({ pagination, onPageChange }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  const { page, totalPages, total, limit } = pagination;

  const pages = [];
  const delta = 1;
  const left = Math.max(2, page - delta);
  const right = Math.min(totalPages - 1, page + delta);

  pages.push(1);
  if (left > 2) pages.push("...");
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < totalPages - 1) pages.push("...");
  if (totalPages > 1) pages.push(totalPages);

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-gray-50">
      <p className="text-xs text-gray-400">
        Showing{" "}
        <span className="font-semibold text-gray-600">
          {from}–{to}
        </span>{" "}
        of <span className="font-semibold text-gray-600">{total}</span> users
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={!pagination.hasPrev}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm"
        >
          ‹
        </button>
        {pages.map((p, i) =>
          p === "..." ? (
            <span
              key={`dots-${i}`}
              className="w-8 h-8 flex items-center justify-center text-xs text-gray-300"
            >
              ···
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold transition-all ${
                p === page
                  ? "bg-gray-900 text-white shadow-sm"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {p}
            </button>
          ),
        )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={!pagination.hasNext}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm"
        >
          ›
        </button>
      </div>
    </div>
  );
}

const AdminUserManagement = () => {
  const {
    users,
    pagination,
    loading,
    actionLoading,
    error,
    filters,
    handleSearch,
    handleStatusFilter,
    handleSort,
    handlePageChange,
    handleToggleStatus,
    handleDelete,
    handleClearError,
  } = useAdminUsers();

  const [searchInput, setSearchInput] = useState(filters.search);
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState(null);
  const debouncedSearch = useDebounce(searchInput);

  useEffect(() => {
    handleSearch(debouncedSearch);
  }, [debouncedSearch]);

  useEffect(() => {
    if (error) {
      setToast({ message: error, type: "error" });
      handleClearError();
    }
  }, [error]);

  const onConfirmAction = async () => {
    if (!confirm) return;
    if (confirm.type === "delete") {
      await handleDelete(confirm.user.id);
      setToast({
        message: `${confirm.user.fullName} deleted.`,
        type: "success",
      });
    } else {
      await handleToggleStatus(confirm.user.id, confirm.user.is_active);
      setToast({
        message: `${confirm.user.fullName} ${confirm.user.is_active ? "deactivated" : "activated"}.`,
        type: "success",
      });
    }
    setConfirm(null);
  };

  const formatDate = (d) =>
    new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const STATUS_TABS = ["all", "active", "inactive"];

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

      {confirm && (
        <ConfirmModal
          user={confirm.user}
          type={confirm.type}
          onConfirm={onConfirmAction}
          onCancel={() => setConfirm(null)}
        />
      )}

      <div className="anim-fade-up mb-8">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-1">
          User Management
        </p>
        <h1 className="display-font text-3xl sm:text-4xl text-gray-900 leading-none">
          All Users
        </h1>
        <p className="text-sm text-gray-500 mt-2">
          {pagination
            ? `${pagination.total.toLocaleString()} total registered users`
            : "Loading..."}
        </p>
      </div>

      <div
        className="anim-fade-up bg-white rounded-2xl border border-gray-100 overflow-hidden"
        style={{ animationDelay: "60ms" }}
      >
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-5 border-b border-gray-50">
          <div className="flex items-center gap-1 bg-gray-50 rounded-xl p-1">
            {STATUS_TABS.map((s) => (
              <button
                key={s}
                onClick={() => handleStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                  filters.status === s
                    ? "bg-white text-gray-900 shadow-sm border border-gray-100"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                🔍
              </span>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search name or email…"
                className="search-input w-full pl-8 pr-4 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl text-gray-700 placeholder-gray-400 focus:border-indigo-300 focus:bg-white transition-all"
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <select
              value={filters.limit}
              onChange={(e) => handleStatusFilter(filters.status)}
              className="px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl text-gray-600 focus:outline-none focus:border-indigo-300 transition-all"
            >
              {[10, 25, 50].map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-50">
                {[
                  { key: null, label: "User", width: "w-64" },
                  { key: "email", label: "Email" },
                  { key: null, label: "Mobile" },
                  { key: null, label: "Status" },
                  { key: "created_at", label: "Joined" },
                  { key: null, label: "Actions" },
                ].map(({ key, label, width }, i) => (
                  <th
                    key={i}
                    className={`px-5 py-3.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-widest ${width ?? ""} ${key ? "sort-btn hover:text-gray-700" : ""}`}
                    onClick={() => key && handleSort(key)}
                  >
                    <span className="flex items-center gap-1">
                      {label}
                      {key && (
                        <SortIcon
                          active={filters.sortBy === key}
                          dir={filters.sortOrder}
                        />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: filters.limit }).map((_, i) => (
                  <SkeletonRow key={i} />
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-3xl">👤</span>
                      <p className="text-sm font-medium text-gray-400">
                        No users found
                      </p>
                      {filters.search && (
                        <p className="text-xs text-gray-400">
                          Try a different search term
                        </p>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((user, i) => (
                  <tr
                    key={user.id}
                    className="row-hover"
                    style={{ animation: `slideIn 0.3s ease ${i * 30}ms both` }}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {user.profile_image_path ? (
                          <img
                            src={user.profile_image_path}
                            alt={user.fullName}
                            className="w-8 h-8 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <InitAvatar name={user.fullName} />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {user.fullName}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            #{user.id}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs text-gray-600">
                        {user.email}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs text-gray-500">
                        {user.mobile || "—"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge active={user.is_active === 1} />
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs text-gray-500">
                        {formatDate(user.created_at)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setConfirm({ user, type: "toggle" })}
                          disabled={actionLoading === user.id}
                          className={`action-btn px-3 py-1.5 rounded-lg text-[10px] font-semibold border transition-all disabled:opacity-50 ${
                            user.is_active
                              ? "bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100"
                              : "bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100"
                          }`}
                        >
                          {actionLoading === user.id
                            ? "…"
                            : user.is_active
                              ? "Deactivate"
                              : "Activate"}
                        </button>
                        <button
                          onClick={() => setConfirm({ user, type: "delete" })}
                          disabled={actionLoading === user.id}
                          className="action-btn w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 text-red-500 border border-red-100 hover:bg-red-100 disabled:opacity-50 text-xs transition-all"
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination pagination={pagination} onPageChange={handlePageChange} />
      </div>
    </div>
  );
};

export default AdminUserManagement;

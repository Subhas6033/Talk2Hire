import { useState, useEffect } from "react";
import { useAdminJobs } from "../Hooks/useAdminJobManage";

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600;700&display=swap');

  .dash-root { font-family: 'DM Sans', sans-serif; }
  .display-font { font-family: 'DM Serif Display', serif; }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes slideIn {
    from { opacity: 0; transform: translateX(-8px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes shimmer {
    0%   { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }

  .anim-fade-up { animation: fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both; }
  .anim-fade-in { animation: fadeIn 0.3s ease both; }

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
  .action-btn { transition: all 0.15s ease; }
  .action-btn:hover { transform: scale(1.05); }
  .action-btn:active { transform: scale(0.97); }
  .toast { animation: fadeUp 0.35s cubic-bezier(0.16,1,0.3,1) both; }

  .drawer { animation: fadeIn 0.2s ease both; }

  .status-menu {
    animation: fadeUp 0.2s cubic-bezier(0.16,1,0.3,1) both;
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
      className={`toast fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium ${type === "error" ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}
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

const STATUS_STYLES = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-100",
  closed: "bg-red-50 text-red-600 border-red-100",
  draft: "bg-amber-50 text-amber-700 border-amber-100",
};

const STATUS_DOT = {
  active: "bg-emerald-500",
  closed: "bg-red-500",
  draft: "bg-amber-500",
};

const TYPE_STYLES = {
  "Full-time": "bg-blue-50 text-blue-700 border-blue-100",
  "Part-time": "bg-purple-50 text-purple-700 border-purple-100",
  Contract: "bg-orange-50 text-orange-700 border-orange-100",
  Internship: "bg-cyan-50 text-cyan-700 border-cyan-100",
};

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full border ${STATUS_STYLES[status] ?? "bg-gray-50 text-gray-500 border-gray-200"}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status] ?? "bg-gray-400"}`}
      />
      {status?.charAt(0).toUpperCase() + status?.slice(1)}
    </span>
  );
}

function TypeBadge({ type }) {
  return (
    <span
      className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${TYPE_STYLES[type] ?? "bg-gray-50 text-gray-500 border-gray-200"}`}
    >
      {type}
    </span>
  );
}

function CompanyAvatar({ name = "??", logo }) {
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
  if (logo) {
    return (
      <img
        src={logo}
        alt={name}
        className="w-8 h-8 rounded-lg object-contain border border-gray-100 bg-white p-0.5 shrink-0"
        onError={(e) => {
          e.target.style.display = "none";
        }}
      />
    );
  }
  return (
    <span
      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
      style={{ background: bg, color }}
    >
      {initials}
    </span>
  );
}

function SortIcon({ active, dir }) {
  return (
    <span
      className="ml-1 inline-flex flex-col gap-px"
      style={{ opacity: active ? 1 : 0.3 }}
    >
      <span
        className="block w-0 h-0 border-l-[3px] border-r-[3px] border-b-4"
        style={{
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderBottomColor: active && dir === "asc" ? "#4f46e5" : "#9ca3af",
        }}
      />
      <span
        className="block w-0 h-0 border-l-[3px] border-r-[3px] border-t-4"
        style={{
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderTopColor: active && dir === "desc" ? "#4f46e5" : "#9ca3af",
        }}
      />
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {[200, 120, 80, 70, 60, 80, 60, 90].map((w, i) => (
        <td key={i} className="px-5 py-4">
          <div className="skeleton h-3 rounded" style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

function ConfirmModal({ job, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm anim-fade-in">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xl p-6 w-full max-w-sm mx-4 anim-fade-up">
        <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center mb-4">
          <span className="text-lg">🗑</span>
        </div>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">
          Delete job posting?
        </h3>
        <p className="text-xs text-gray-500 mb-5">
          This will permanently delete{" "}
          <span className="font-semibold text-gray-700">"{job?.title}"</span> at{" "}
          {job?.companyName}. This cannot be undone.
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
            className="flex-1 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-xs font-semibold text-white transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusMenu({ job, onSelect, onClose }) {
  const statuses = ["active", "closed", "draft"];
  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div
        className="status-menu absolute bg-white rounded-xl border border-gray-100 shadow-xl overflow-hidden"
        style={{ top: "auto", zIndex: 50 }}
        onClick={(e) => e.stopPropagation()}
      >
        {statuses
          .filter((s) => s !== job.status)
          .map((s) => (
            <button
              key={s}
              onClick={() => {
                onSelect(s);
                onClose();
              }}
              className="flex items-center gap-2 w-full px-4 py-2.5 text-xs font-semibold hover:bg-gray-50 transition-colors capitalize"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[s]}`} />
              Mark as {s}
            </button>
          ))}
      </div>
    </div>
  );
}

function DetailDrawer({
  job,
  onClose,
  onDelete,
  onStatusChange,
  actionLoading,
}) {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  if (!job) return null;

  const formatDate = (d) =>
    new Date(d).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div
        className="drawer bg-white w-full max-w-md h-full shadow-2xl border-l border-gray-100 overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-50 sticky top-0 bg-white z-10">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <CompanyAvatar name={job.companyName} logo={job.logo} />
              <div>
                <p className="text-xs font-semibold text-gray-500">
                  {job.companyName}
                </p>
                <p className="text-[10px] text-gray-400">{job.industry}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors text-sm"
            >
              ✕
            </button>
          </div>
          <h2 className="display-font text-xl text-gray-900 leading-snug mb-3">
            {job.title}
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={job.status} />
            <TypeBadge type={job.type} />
          </div>
        </div>

        <div className="p-6 flex-1 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Department", value: job.department },
              { label: "Location", value: job.location },
              { label: "Experience", value: job.experience },
              { label: "Salary", value: job.salary },
              { label: "Applicants", value: job.applicants?.toLocaleString() },
              {
                label: "Posted",
                value: job.posted ? formatDate(job.posted) : null,
              },
              {
                label: "Created",
                value: job.created_at ? formatDate(job.created_at) : null,
              },
              { label: "Job ID", value: `#${job.id}` },
            ].map(({ label, value }) =>
              value ? (
                <div key={label}>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">
                    {label}
                  </p>
                  <p className="text-xs font-medium text-gray-700">{value}</p>
                </div>
              ) : null,
            )}
          </div>

          {job.description && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
                Description
              </p>
              <p className="text-xs text-gray-600 leading-relaxed line-clamp-6">
                {job.description}
              </p>
            </div>
          )}

          {job.requirements && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
                Requirements
              </p>
              <p className="text-xs text-gray-600 leading-relaxed line-clamp-4">
                {job.requirements}
              </p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-50 flex gap-2 sticky bottom-0 bg-white">
          <div className="relative flex-1">
            <button
              onClick={() => setShowStatusMenu(!showStatusMenu)}
              disabled={actionLoading === job.id}
              className="w-full px-4 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {actionLoading === job.id ? "Updating…" : "Change Status ↓"}
            </button>
            {showStatusMenu && (
              <div className="absolute bottom-full mb-1 left-0 w-full bg-white rounded-xl border border-gray-100 shadow-xl overflow-hidden status-menu">
                {["active", "closed", "draft"]
                  .filter((s) => s !== job.status)
                  .map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        onStatusChange(job.id, s);
                        setShowStatusMenu(false);
                      }}
                      className="flex items-center gap-2 w-full px-4 py-2.5 text-xs font-semibold hover:bg-gray-50 transition-colors capitalize"
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[s]}`}
                      />
                      Mark as {s}
                    </button>
                  ))}
              </div>
            )}
          </div>
          <button
            onClick={() => onDelete(job)}
            disabled={actionLoading === job.id}
            className="px-4 py-2 rounded-xl bg-red-50 text-red-600 border border-red-100 text-xs font-semibold hover:bg-red-100 transition-colors disabled:opacity-50"
          >
            Delete
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
  const left = Math.max(2, page - 1);
  const right = Math.min(totalPages - 1, page + 1);
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
        of <span className="font-semibold text-gray-600">{total}</span> jobs
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
              key={`d${i}`}
              className="w-8 h-8 flex items-center justify-center text-xs text-gray-300"
            >
              ···
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold transition-all ${p === page ? "bg-gray-900 text-white shadow-sm" : "text-gray-500 hover:bg-gray-100"}`}
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

const STATUS_TABS = ["all", "active", "closed", "draft"];
const TYPE_TABS = ["all", "Full-time", "Part-time", "Contract", "Internship"];

const AdminJobManagement = () => {
  const {
    jobs,
    pagination,
    loading,
    actionLoading,
    error,
    filters,
    handleSearch,
    handleStatusFilter,
    handleTypeFilter,
    handleSort,
    handlePageChange,
    handleUpdateStatus,
    handleDelete,
    handleClearError,
  } = useAdminJobs();

  const [searchInput, setSearchInput] = useState(filters.search);
  const [confirm, setConfirm] = useState(null);
  const [drawer, setDrawer] = useState(null);
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

  const onConfirmDelete = async () => {
    if (!confirm) return;
    await handleDelete(confirm.id);
    setToast({ message: `"${confirm.title}" deleted.`, type: "success" });
    setConfirm(null);
    if (drawer?.id === confirm.id) setDrawer(null);
  };

  const onStatusChange = async (id, status) => {
    await handleUpdateStatus(id, status);
    setToast({ message: `Job marked as ${status}.`, type: "success" });
    if (drawer?.id === id)
      setDrawer((prev) => (prev ? { ...prev, status } : null));
  };

  const formatDate = (d) =>
    new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const COLS = [
    { key: "title", label: "Job Title" },
    { key: null, label: "Company" },
    { key: null, label: "Type" },
    { key: null, label: "Location" },
    { key: "applicants", label: "Applicants" },
    { key: null, label: "Status" },
    { key: "created_at", label: "Posted" },
    { key: null, label: "Actions" },
  ];

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
          job={confirm}
          onConfirm={onConfirmDelete}
          onCancel={() => setConfirm(null)}
        />
      )}
      <DetailDrawer
        job={drawer}
        onClose={() => setDrawer(null)}
        onDelete={(job) => {
          setDrawer(null);
          setConfirm(job);
        }}
        onStatusChange={onStatusChange}
        actionLoading={actionLoading}
      />

      <div className="anim-fade-up mb-8">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-1">
          Job Management
        </p>
        <h1 className="display-font text-3xl sm:text-4xl text-gray-900 leading-none">
          All Jobs
        </h1>
        <p className="text-sm text-gray-500 mt-2">
          {pagination
            ? `${pagination.total.toLocaleString()} job postings`
            : "Loading..."}
        </p>
      </div>

      <div
        className="anim-fade-up bg-white rounded-2xl border border-gray-100 overflow-hidden"
        style={{ animationDelay: "60ms" }}
      >
        <div className="p-5 border-b border-gray-50 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 sm:max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                🔍
              </span>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search title, company, location…"
                className="search-input w-full pl-8 pr-8 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl text-gray-700 placeholder-gray-400 focus:border-indigo-300 focus:bg-white transition-all"
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
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1 bg-gray-50 rounded-xl p-1">
              {STATUS_TABS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${filters.status === s ? "bg-white text-gray-900 shadow-sm border border-gray-100" : "text-gray-500 hover:text-gray-700"}`}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 bg-gray-50 rounded-xl p-1 overflow-x-auto">
              {TYPE_TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => handleTypeFilter(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${filters.type === t ? "bg-white text-gray-900 shadow-sm border border-gray-100" : "text-gray-500 hover:text-gray-700"}`}
                >
                  {t === "all" ? "All Types" : t}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-50">
                {COLS.map(({ key, label }, i) => (
                  <th
                    key={i}
                    className={`px-5 py-3.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-widest ${key ? "sort-btn hover:text-gray-700" : ""}`}
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
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-3xl">💼</span>
                      <p className="text-sm font-medium text-gray-400">
                        No jobs found
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
                jobs.map((job, i) => (
                  <tr
                    key={job.id}
                    className="row-hover cursor-pointer"
                    style={{ animation: `slideIn 0.3s ease ${i * 25}ms both` }}
                    onClick={() => setDrawer(job)}
                  >
                    <td className="px-5 py-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate max-w-50">
                          {job.title}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {job.department}
                        </p>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <CompanyAvatar name={job.companyName} logo={job.logo} />
                        <span className="text-xs text-gray-600 truncate max-w-30">
                          {job.companyName}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <TypeBadge type={job.type} />
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs text-gray-500 truncate block max-w-25">
                        {job.location}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-gray-700">
                          {job.applicants?.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          applied
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs text-gray-500">
                        {formatDate(job.created_at)}
                      </span>
                    </td>
                    <td
                      className="px-5 py-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setDrawer(job)}
                          className="action-btn px-3 py-1.5 rounded-lg text-[10px] font-semibold border bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100"
                        >
                          View
                        </button>
                        <button
                          onClick={() => setConfirm(job)}
                          disabled={actionLoading === job.id}
                          className="action-btn w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 text-red-500 border border-red-100 hover:bg-red-100 disabled:opacity-50 text-xs"
                        >
                          {actionLoading === job.id ? "…" : "🗑"}
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

export default AdminJobManagement;

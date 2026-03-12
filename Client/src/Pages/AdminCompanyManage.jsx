import { useState, useEffect } from "react";
import { useAdminCompanies } from "../Hooks/useAdminCompanyManageHooks";

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

  .action-btn { transition: all 0.15s ease; }
  .action-btn:hover { transform: scale(1.05); }
  .action-btn:active { transform: scale(0.97); }

  .toast { animation: fadeUp 0.35s cubic-bezier(0.16,1,0.3,1) both; }

  .detail-drawer {
    animation: fadeIn 0.2s ease both;
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

function CompanyAvatar({ name = "??", logo }) {
  const palette = [
    ["#eef2ff", "#4338ca"],
    ["#f5f3ff", "#7c3aed"],
    ["#ecfeff", "#0e7490"],
    ["#ecfdf5", "#065f46"],
    ["#fffbeb", "#92400e"],
    ["#fff1f2", "#9f1239"],
    ["#fdf4ff", "#86198f"],
    ["#f0fdf4", "#166534"],
  ];
  const initials = name
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
        className="w-9 h-9 rounded-xl object-contain border border-gray-100 shrink-0 bg-white p-0.5"
        onError={(e) => {
          e.target.style.display = "none";
        }}
      />
    );
  }

  return (
    <span
      className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0"
      style={{ background: bg, color }}
    >
      {initials}
    </span>
  );
}

function IndustryBadge({ industry }) {
  if (!industry) return <span className="text-xs text-gray-400">—</span>;
  return (
    <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
      {industry}
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
      {[48, 180, 170, 90, 80, 100, 70].map((w, i) => (
        <td key={i} className="px-5 py-4">
          <div className="skeleton h-3 rounded" style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

function ConfirmModal({ company, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm anim-fade-in">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xl p-6 w-full max-w-sm mx-4 anim-fade-up">
        <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center mb-4">
          <span className="text-lg">🗑</span>
        </div>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">
          Delete company?
        </h3>
        <p className="text-xs text-gray-500 mb-5">
          This will permanently delete{" "}
          <span className="font-semibold text-gray-700">
            {company?.companyName}
          </span>{" "}
          and all associated data. This cannot be undone.
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

function DetailDrawer({ company, onClose }) {
  if (!company) return null;

  const formatDate = (d) =>
    new Date(d).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

  const fields = [
    { label: "Company Mail", value: company.companyMail },
    { label: "Mobile", value: company.companyMobile },
    { label: "Industry", value: company.industry },
    { label: "Size", value: company.companySize },
    { label: "Location", value: company.companyLocation },
    { label: "Address", value: company.companyAddress },
    { label: "Website", value: company.companySite, link: true },
    { label: "Reg. Number", value: company.companyRegisterNumber },
    {
      label: "Joined",
      value: company.created_at ? formatDate(company.created_at) : null,
    },
  ];

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div
        className="detail-drawer bg-white w-full max-w-sm h-full shadow-2xl border-l border-gray-100 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-50">
          <div className="flex items-start justify-between mb-4">
            <CompanyAvatar name={company.companyName} logo={company.logo} />
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors text-sm"
            >
              ✕
            </button>
          </div>
          <h2 className="display-font text-xl text-gray-900">
            {company.companyName}
          </h2>
          <p className="text-xs text-gray-400 mt-1">#{company.id}</p>
        </div>

        <div className="p-6 space-y-4">
          {fields.map(({ label, value, link }) =>
            value ? (
              <div key={label}>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">
                  {label}
                </p>
                {link ? (
                  <a
                    href={value.startsWith("http") ? value : `https://${value}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-indigo-600 hover:text-indigo-800 underline underline-offset-2"
                  >
                    {value}
                  </a>
                ) : (
                  <p className="text-xs text-gray-700">{value}</p>
                )}
              </div>
            ) : null,
          )}
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
        of <span className="font-semibold text-gray-600">{total}</span>{" "}
        companies
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

const AdminCompanyManagement = () => {
  const {
    companies,
    pagination,
    loading,
    actionLoading,
    error,
    filters,
    handleSearch,
    handleSort,
    handlePageChange,
    handleDelete,
    handleClearError,
  } = useAdminCompanies();

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
    setToast({ message: `${confirm.companyName} deleted.`, type: "success" });
    setConfirm(null);
    if (drawer?.id === confirm.id) setDrawer(null);
  };

  const formatDate = (d) =>
    new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const COLS = [
    { key: null, label: "Company" },
    { key: "companyMail", label: "Email" },
    { key: "industry", label: "Industry" },
    { key: null, label: "Size" },
    { key: null, label: "Location" },
    { key: "created_at", label: "Joined" },
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
          company={confirm}
          onConfirm={onConfirmDelete}
          onCancel={() => setConfirm(null)}
        />
      )}
      <DetailDrawer company={drawer} onClose={() => setDrawer(null)} />

      <div className="anim-fade-up mb-8">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-1">
          Company Management
        </p>
        <h1 className="display-font text-3xl sm:text-4xl text-gray-900 leading-none">
          All Companies
        </h1>
        <p className="text-sm text-gray-500 mt-2">
          {pagination
            ? `${pagination.total.toLocaleString()} registered companies`
            : "Loading..."}
        </p>
      </div>

      <div
        className="anim-fade-up bg-white rounded-2xl border border-gray-100 overflow-hidden"
        style={{ animationDelay: "60ms" }}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-5 border-b border-gray-50">
          <div className="relative w-full sm:w-72">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
              🔍
            </span>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search name, email or industry…"
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

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Per page:</span>
            {[10, 25, 50].map((n) => (
              <button
                key={n}
                onClick={() => handleSearch(filters.search)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  filters.limit === n
                    ? "bg-gray-900 text-white"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {n}
              </button>
            ))}
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
              ) : companies.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-3xl">🏢</span>
                      <p className="text-sm font-medium text-gray-400">
                        No companies found
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
                companies.map((company, i) => (
                  <tr
                    key={company.id}
                    className="row-hover cursor-pointer"
                    style={{ animation: `slideIn 0.3s ease ${i * 30}ms both` }}
                    onClick={() => setDrawer(company)}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <CompanyAvatar
                          name={company.companyName}
                          logo={company.logo}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate max-w-40">
                            {company.companyName}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            #{company.id}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs text-gray-600">
                        {company.companyMail}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <IndustryBadge industry={company.industry} />
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs text-gray-500">
                        {company.companySize || "—"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs text-gray-500 max-w-30 truncate block">
                        {company.companyLocation || "—"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs text-gray-500">
                        {formatDate(company.created_at)}
                      </span>
                    </td>
                    <td
                      className="px-5 py-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setDrawer(company)}
                          className="action-btn px-3 py-1.5 rounded-lg text-[10px] font-semibold border bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100 transition-all"
                        >
                          View
                        </button>
                        <button
                          onClick={() => setConfirm(company)}
                          disabled={actionLoading === company.id}
                          className="action-btn w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 text-red-500 border border-red-100 hover:bg-red-100 disabled:opacity-50 text-xs transition-all"
                        >
                          {actionLoading === company.id ? "…" : "🗑"}
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

export default AdminCompanyManagement;

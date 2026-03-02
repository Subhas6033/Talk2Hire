import {
  Search,
  MapPin,
  Briefcase,
  Clock,
  ChevronRight,
  Building2,
  X,
  DollarSign,
  GraduationCap,
  Tag,
  ChevronLeft,
  ArrowUpRight,
  Sparkles,
  Filter,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { usePublicJobs } from "../Hooks/useJobHook";

// ─── Constants ────────────────────────────────────────────────
const DEPARTMENTS = [
  "Engineering",
  "Design",
  "Product",
  "Marketing",
  "Sales",
  "HR",
  "Finance",
  "Operations",
];
const JOB_TYPES = [
  "Full-time",
  "Part-time",
  "Contract",
  "Internship",
  "Remote",
];
const EXPERIENCES = [
  "0-1 years",
  "1-2 years",
  "2-4 years",
  "3-5 years",
  "4-6 years",
  "5+ years",
  "7+ years",
];

const JOBS_PER_PAGE = 9;

// ─── Helpers ──────────────────────────────────────────────────
const parseSkills = (skills) => {
  if (Array.isArray(skills)) return skills;
  if (typeof skills === "string") {
    if (!skills.trim()) return [];
    try {
      const parsed = JSON.parse(skills);
      return Array.isArray(parsed) ? parsed : [String(parsed)];
    } catch {
      return skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return [];
};

const timeAgo = (dateStr) => {
  if (!dateStr) return "Recently";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
};

// ─── Animated counter ─────────────────────────────────────────
const useCountUp = (target, duration = 800) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!target) return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return count;
};

// ─── Company Avatar ───────────────────────────────────────────
const PALETTES = [
  { bg: "#EEF2FF", text: "#4F46E5", border: "#C7D2FE" },
  { bg: "#F0FDF4", text: "#16A34A", border: "#BBF7D0" },
  { bg: "#FFF7ED", text: "#EA580C", border: "#FED7AA" },
  { bg: "#FDF4FF", text: "#9333EA", border: "#E9D5FF" },
  { bg: "#F0F9FF", text: "#0284C7", border: "#BAE6FD" },
  { bg: "#FFF1F2", text: "#E11D48", border: "#FECDD3" },
];

// ─── Single CompanyAvatar — logo if available, else first letter ──
const CompanyAvatar = ({ name, logo, index, size = 48 }) => {
  const pal = PALETTES[index % PALETTES.length];
  const initial = name ? name.trim()[0].toUpperCase() : "C";
  const [imgError, setImgError] = useState(false);

  if (logo && !imgError) {
    return (
      <div
        className="shrink-0 rounded-2xl overflow-hidden border"
        style={{
          width: size,
          height: size,
          borderColor: pal.border,
          background: "#fff",
          flexShrink: 0,
        }}
      >
        <img
          src={logo}
          alt={name}
          className="w-full h-full object-contain p-1"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-center font-bold shrink-0 rounded-2xl"
      style={{
        width: size,
        height: size,
        background: pal.bg,
        color: pal.text,
        border: `1.5px solid ${pal.border}`,
        fontSize: size * 0.35,
        letterSpacing: "0.02em",
        flexShrink: 0,
      }}
    >
      {initial}
    </div>
  );
};

// ─── Type badge config ────────────────────────────────────────
const TYPE_STYLES = {
  "Full-time": { bg: "#F0FDF4", text: "#15803D", border: "#BBF7D0" },
  "Part-time": { bg: "#EFF6FF", text: "#2563EB", border: "#BFDBFE" },
  Contract: { bg: "#FFFBEB", text: "#D97706", border: "#FDE68A" },
  Internship: { bg: "#FAF5FF", text: "#7C3AED", border: "#DDD6FE" },
  Remote: { bg: "#F0FDFA", text: "#0D9488", border: "#99F6E4" },
};

// ─── Job Card ─────────────────────────────────────────────────
const JobCard = ({ job, index, onClick, animDelay }) => {
  const [hovered, setHovered] = useState(false);
  const skills = parseSkills(job.skills);
  const typeSty = TYPE_STYLES[job.type] || {
    bg: "#F9FAFB",
    text: "#6B7280",
    border: "#E5E7EB",
  };

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="bg-white rounded-2xl p-6 cursor-pointer flex flex-col gap-4 relative overflow-hidden"
      style={{
        border: hovered ? "1.5px solid #6366F1" : "1.5px solid #E5E7EB",
        boxShadow: hovered
          ? "0 20px 60px -10px rgba(99,102,241,0.18), 0 4px 16px -2px rgba(0,0,0,0.08)"
          : "0 1px 4px rgba(0,0,0,0.04)",
        transform: hovered ? "translateY(-4px)" : "translateY(0)",
        transition: "all 0.25s cubic-bezier(0.34,1.56,0.64,1)",
        animation: `fadeUp 0.4s ease ${animDelay}ms both`,
      }}
    >
      {/* Hover top accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-0.75 rounded-t-2xl"
        style={{
          background: "linear-gradient(90deg, #6366F1, #8B5CF6, #06B6D4)",
          opacity: hovered ? 1 : 0,
          transition: "opacity 0.2s",
        }}
      />

      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <CompanyAvatar
            name={job.companyName}
            logo={job.companyLogo}
            index={index}
          />
          <div className="min-w-0 flex-1">
            <h3
              className="font-bold text-sm m-0 leading-tight truncate"
              style={{
                fontFamily: "'Fraunces', serif",
                fontSize: 15,
                color: hovered ? "#4F46E5" : "#111827",
                transition: "color 0.2s",
              }}
            >
              {job.title}
            </h3>
            <p className="m-0 mt-0.5 text-xs text-gray-400 font-medium">
              {job.companyName || "Unknown Company"}
            </p>
          </div>
        </div>
        <div
          className="flex items-center justify-center shrink-0 rounded-lg"
          style={{
            width: 28,
            height: 28,
            background: hovered ? "#EEF2FF" : "#F9FAFB",
            border: hovered ? "1px solid #C7D2FE" : "1px solid #E5E7EB",
            transform: hovered ? "rotate(-45deg)" : "rotate(0deg)",
            transition: "all 0.2s",
          }}
        >
          <ArrowUpRight size={14} color={hovered ? "#4F46E5" : "#9CA3AF"} />
        </div>
      </div>

      {/* Description */}
      {job.description && (
        <p
          className="text-xs text-gray-500 m-0"
          style={{
            lineHeight: 1.6,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {job.description}
        </p>
      )}

      {/* Type + dept badges */}
      <div className="flex flex-wrap gap-1.5">
        <span
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border"
          style={{
            background: typeSty.bg,
            color: typeSty.text,
            borderColor: typeSty.border,
          }}
        >
          {job.type || "Full-time"}
        </span>
        {job.department && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200">
            {job.department}
          </span>
        )}
        {job.experience && (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-500 border border-gray-200">
            <GraduationCap size={10} /> {job.experience}
          </span>
        )}
      </div>

      {/* Skills */}
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {skills.slice(0, 4).map((sk) => (
            <span
              key={sk}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md font-semibold bg-indigo-50 text-indigo-600 border border-indigo-200"
            >
              <Tag size={8} /> {sk}
            </span>
          ))}
          {skills.length > 4 && (
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-gray-50 text-gray-400 border border-gray-200">
              +{skills.length - 4}
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-400 pt-3.5 border-t border-gray-100 mt-0.5">
        <div className="flex items-center gap-3">
          {job.location && (
            <span className="flex items-center gap-1">
              <MapPin size={11} color="#D1D5DB" /> {job.location}
            </span>
          )}
          {job.salary && (
            <span className="flex items-center gap-1 text-emerald-600 font-semibold">
              <DollarSign size={11} /> {job.salary}
            </span>
          )}
        </div>
        <span className="flex items-center gap-1">
          <Clock size={11} color="#D1D5DB" /> {timeAgo(job.posted)}
        </span>
      </div>
    </div>
  );
};

// ─── Filter Pill ──────────────────────────────────────────────
const FilterPill = ({ label, value, onChange, options, placeholder }) => {
  const active = !!value;
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 rounded-xl text-sm font-medium outline-none cursor-pointer transition-all duration-150"
        style={{
          background: active ? "#EEF2FF" : "#F9FAFB",
          border: active ? "1.5px solid #C7D2FE" : "1.5px solid #E5E7EB",
          color: active ? "#4F46E5" : "#374151",
          appearance: "none",
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 10px center",
          paddingRight: 30,
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
};

// ─── Pagination ───────────────────────────────────────────────
const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  const getPages = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="flex items-center justify-center gap-1.5 mt-12 flex-wrap">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="w-9 h-9 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-sm font-semibold transition-all duration-150 disabled:opacity-35 disabled:cursor-not-allowed hover:bg-gray-50 cursor-pointer"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
        title="Previous"
      >
        <ChevronLeft size={16} color="#6B7280" />
      </button>

      {getPages().map((p, i) =>
        p === "..." ? (
          <span
            key={`dot-${i}`}
            className="w-9 text-center text-gray-400 text-sm"
          >
            ···
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className="w-9 h-9 rounded-xl border text-sm font-semibold transition-all duration-150 flex items-center justify-center cursor-pointer"
            style={{
              fontFamily: "'DM Sans', sans-serif",
              background: currentPage === p ? "#4F46E5" : "#fff",
              border:
                currentPage === p
                  ? "1.5px solid #4F46E5"
                  : "1.5px solid #E5E7EB",
              color: currentPage === p ? "#fff" : "#374151",
              boxShadow:
                currentPage === p ? "0 4px 12px rgba(79,70,229,0.3)" : "none",
              transform: currentPage === p ? "scale(1.05)" : "scale(1)",
            }}
          >
            {p}
          </button>
        ),
      )}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="w-9 h-9 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-sm font-semibold transition-all duration-150 disabled:opacity-35 disabled:cursor-not-allowed hover:bg-gray-50 cursor-pointer"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
        title="Next"
      >
        <ChevronRight size={16} color="#6B7280" />
      </button>
    </div>
  );
};

// ─── Skeleton Card ────────────────────────────────────────────
const SkeletonCard = ({ delay = 0 }) => (
  <div
    className="bg-white border border-gray-100 rounded-2xl p-6 flex flex-col gap-4"
    style={{ animation: `pulse 1.8s ease-in-out ${delay}ms infinite` }}
  >
    <div className="flex gap-3">
      <div className="w-12 h-12 rounded-2xl bg-gray-100 shrink-0" />
      <div className="flex-1 flex flex-col gap-2">
        <div className="h-3.5 bg-gray-100 rounded-md w-[70%]" />
        <div className="h-2.5 bg-gray-50 rounded-md w-[45%]" />
      </div>
    </div>
    <div className="h-2.5 bg-gray-50 rounded-md" />
    <div className="h-2.5 bg-gray-50 rounded-md w-4/5" />
    <div className="flex gap-1.5">
      {[60, 80, 70].map((w, i) => (
        <div
          key={i}
          className="h-5 bg-gray-100 rounded-full"
          style={{ width: w }}
        />
      ))}
    </div>
  </div>
);

// ─── Main Page ────────────────────────────────────────────────
const UserJob = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [mounted, setMounted] = useState(false);
  const gridRef = useRef(null);

  const {
    jobs,
    total,
    isFetching,
    error,
    q,
    setQ,
    department,
    setDepartment,
    location,
    setLocation,
    type,
    setType,
    experience,
    setExperience,
    resetFilters,
    hasActiveFilters,
  } = usePublicJobs();

  const totalCount = useCountUp(total, 600);

  // Sync URL params into hook on first mount
  useEffect(() => {
    const urlQ = searchParams.get("q");
    const urlLocation = searchParams.get("location");
    if (urlQ) setQ(urlQ);
    if (urlLocation) setLocation(urlLocation);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setCurrentPage(1);
  }, [q, department, location, type, experience]);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const handlePageChange = useCallback((page) => {
    setCurrentPage(page);
    gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const totalPages = Math.ceil(jobs.length / JOBS_PER_PAGE);
  const paginatedJobs = jobs.slice(
    (currentPage - 1) * JOBS_PER_PAGE,
    currentPage * JOBS_PER_PAGE,
  );

  const activeFilterCount = [department, location, type, experience].filter(
    Boolean,
  ).length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,400&family=DM+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        input:focus, select:focus {
          outline: none !important;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.12) !important;
          border-color: #6366F1 !important;
        }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #F9FAFB; }
        ::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 99px; }
        ::-webkit-scrollbar-thumb:hover { background: #D1D5DB; }
      `}</style>

      <div
        className="min-h-screen bg-gray-50"
        style={{
          fontFamily: "'DM Sans', sans-serif",
          opacity: mounted ? 1 : 0,
          transition: "opacity 0.3s",
        }}
      >
        {/* ── Decorative background ── */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div
            className="absolute -top-28 -right-28 w-150 h-150 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)",
            }}
          />
          <div
            className="absolute -bottom-20 -left-20 w-100 h-100 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(rgba(0,0,0,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.025) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />
        </div>

        {/* ── Header ── */}
        <header
          className="sticky top-0 z-50 border-b border-black/6"
          style={{
            background: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(16px)",
            boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
          }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            {/* Title row */}
            <div
              className="flex items-center justify-between py-4 sm:py-5"
              style={{ animation: "fadeUp 0.5s ease both" }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0"
                  style={{
                    background: "linear-gradient(135deg, #4F46E5, #7C3AED)",
                    boxShadow: "0 4px 12px rgba(79,70,229,0.3)",
                  }}
                >
                  <Briefcase size={16} color="#fff" />
                </div>
                <div>
                  <h1
                    className="font-bold text-gray-900 m-0 leading-tight text-lg sm:text-xl"
                    style={{ fontFamily: "'Fraunces', serif" }}
                  >
                    Job Openings
                  </h1>
                  <p className="m-0 text-xs text-gray-400 font-medium">
                    {isFetching ? (
                      "Finding opportunities…"
                    ) : (
                      <>
                        <span className="text-indigo-600 font-bold">
                          {totalCount}
                        </span>{" "}
                        position{total !== 1 ? "s" : ""} available
                      </>
                    )}
                  </p>
                </div>
              </div>

              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-semibold cursor-pointer transition-all duration-150 hover:bg-red-100"
                  style={{ animation: "fadeIn 0.2s ease" }}
                >
                  <X size={13} />
                  <span className="hidden sm:inline">Clear filters</span>
                </button>
              )}
            </div>

            {/* Search + filter toggle */}
            <div
              className="flex gap-2 sm:gap-2.5 pb-4"
              style={{ animation: "fadeUp 0.5s ease 0.08s both" }}
            >
              <div className="relative flex-1">
                <Search
                  size={15}
                  color="#9CA3AF"
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                />
                <input
                  type="text"
                  placeholder="Search by title, department, location…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="w-full pl-10 pr-9 py-2.5 sm:py-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 font-normal transition-all duration-200"
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  }}
                />
                {q && (
                  <button
                    onClick={() => setQ("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 bg-gray-100 border-none rounded-md flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors"
                  >
                    <X size={12} color="#6B7280" />
                  </button>
                )}
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-200 whitespace-nowrap border"
                style={{
                  background: showFilters ? "#4F46E5" : "#fff",
                  borderColor: showFilters ? "#4F46E5" : "#E5E7EB",
                  color: showFilters ? "#fff" : "#374151",
                  boxShadow: showFilters
                    ? "0 4px 12px rgba(79,70,229,0.25)"
                    : "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                <Filter size={14} />
                <span className="hidden xs:inline sm:inline">Filters</span>
                {activeFilterCount > 0 && (
                  <span
                    className="w-4 h-4 rounded-full text-white text-[10px] font-bold flex items-center justify-center"
                    style={{
                      background: showFilters
                        ? "rgba(255,255,255,0.25)"
                        : "#4F46E5",
                    }}
                  >
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>

            {/* Filter panel */}
            {showFilters && (
              <div
                className="px-4 sm:px-5 pt-4 pb-5 bg-gray-50 border border-gray-200 rounded-2xl mb-4"
                style={{ animation: "slideDown 0.2s ease" }}
              >
                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5">
                  <FilterPill
                    label="Department"
                    value={department}
                    onChange={setDepartment}
                    options={DEPARTMENTS}
                    placeholder="All Departments"
                  />
                  <FilterPill
                    label="Job Type"
                    value={type}
                    onChange={setType}
                    options={JOB_TYPES}
                    placeholder="All Types"
                  />
                  <FilterPill
                    label="Experience"
                    value={experience}
                    onChange={setExperience}
                    options={EXPERIENCES}
                    placeholder="Any Level"
                  />
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                      Location
                    </label>
                    <input
                      type="text"
                      placeholder="City or Remote"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150"
                      style={{
                        background: location ? "#EEF2FF" : "#fff",
                        border: location
                          ? "1.5px solid #C7D2FE"
                          : "1.5px solid #E5E7EB",
                        color: location ? "#4F46E5" : "#374151",
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* ── Main content ── */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-16 relative z-10">
          {/* Results meta */}
          {!isFetching && !error && jobs.length > 0 && (
            <div
              className="flex flex-wrap items-center justify-between gap-2 mb-5 sm:mb-6"
              style={{ animation: "fadeIn 0.4s ease" }}
            >
              <p className="m-0 text-sm text-gray-500 font-medium">
                Showing{" "}
                <strong className="text-gray-900">
                  {(currentPage - 1) * JOBS_PER_PAGE + 1}–
                  {Math.min(currentPage * JOBS_PER_PAGE, jobs.length)}
                </strong>{" "}
                of <strong className="text-gray-900">{jobs.length}</strong> jobs
                {hasActiveFilters && (
                  <span className="text-indigo-500"> (filtered)</span>
                )}
              </p>
              {totalPages > 1 && (
                <p className="m-0 text-sm text-gray-400">
                  Page {currentPage} of {totalPages}
                </p>
              )}
            </div>
          )}

          {/* Grid scroll anchor */}
          <div ref={gridRef} style={{ scrollMarginTop: 120 }} />

          {/* States */}
          {isFetching ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {[...Array(JOBS_PER_PAGE)].map((_, i) => (
                <SkeletonCard key={i} delay={i * 60} />
              ))}
            </div>
          ) : error ? (
            <div
              className="text-center py-20 px-6"
              style={{ animation: "fadeUp 0.4s ease" }}
            >
              <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-4">
                <X size={24} color="#DC2626" />
              </div>
              <p className="font-semibold text-red-600 text-sm m-0 mb-2">
                Something went wrong
              </p>
              <p className="text-gray-400 text-xs m-0 mb-5">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-5 py-2 rounded-xl bg-indigo-600 border-none text-white text-sm font-semibold cursor-pointer hover:bg-indigo-700 transition-colors"
              >
                Try again
              </button>
            </div>
          ) : jobs.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-24 px-6 gap-4"
              style={{ animation: "fadeUp 0.4s ease" }}
            >
              <div className="w-16 h-16 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center mb-1">
                <Building2 size={32} color="#D1D5DB" />
              </div>
              <div className="text-center">
                <p
                  className="font-bold text-gray-700 text-base m-0 mb-1.5"
                  style={{ fontFamily: "'Fraunces', serif", fontSize: 17 }}
                >
                  No positions found
                </p>
                <p className="text-gray-400 text-sm m-0">
                  Try adjusting your search or clearing filters
                </p>
              </div>
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="mt-1 px-4 py-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 text-sm font-semibold cursor-pointer flex items-center gap-1.5 hover:bg-indigo-100 transition-colors"
                >
                  <Sparkles size={13} /> Clear all filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {paginatedJobs.map((job, i) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    index={(currentPage - 1) * JOBS_PER_PAGE + i}
                    onClick={() => navigate(`/jobs/${job.id}`)}
                    animDelay={Math.min(i * 55, 350)}
                  />
                ))}
              </div>

              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />

              {totalPages > 1 && (
                <p className="text-center mt-5 text-xs text-gray-300 font-medium">
                  {jobs.length} total positions · {JOBS_PER_PAGE} per page
                </p>
              )}
            </>
          )}
        </main>
      </div>
    </>
  );
};

export default UserJob;

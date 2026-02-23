import {
  Search,
  MapPin,
  Briefcase,
  Clock,
  ChevronRight,
  Building2,
  SlidersHorizontal,
  X,
  DollarSign,
  GraduationCap,
  Tag,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
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

// ─── Helper: always parse skills safely ──────────────────────
const parseSkills = (skills) => {
  if (Array.isArray(skills)) return skills;
  if (typeof skills === "string") {
    try {
      return JSON.parse(skills);
    } catch {
      return skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return [];
};

// ─── Company avatar initials ──────────────────────────────────
const CompanyAvatar = ({ name, index }) => {
  const GRADIENTS = [
    "from-violet-500 to-indigo-600",
    "from-blue-500 to-cyan-600",
    "from-emerald-500 to-teal-600",
    "from-orange-500 to-amber-600",
    "from-pink-500 to-rose-600",
    "from-indigo-500 to-purple-600",
  ];
  const initials = name
    ? name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "CO";
  const grad = GRADIENTS[index % GRADIENTS.length];
  return (
    <div
      className={`w-12 h-12 rounded-2xl bg-linear-to-br ${grad} flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm`}
    >
      {initials}
    </div>
  );
};

// ─── Job Card ─────────────────────────────────────────────────
const JobCard = ({ job, index, onClick }) => {
  const skills = parseSkills(job.skills);
  const posted = job.posted || "Recently";
  const typeColors = {
    "Full-time": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    "Part-time": "bg-blue-500/10 text-blue-400 border-blue-500/20",
    Contract: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    Internship: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    Remote: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  };
  const typeCls =
    typeColors[job.type] || "bg-white/5 text-textLight/60 border-white/10";

  return (
    <div
      onClick={onClick}
      className="group bg-white/5 border border-white/10 backdrop-blur-sm rounded-2xl p-6 cursor-pointer hover:border-indigo-500/50 hover:bg-white/10 hover:shadow-xl hover:shadow-indigo-900/20 transition-all duration-200 flex flex-col gap-4"
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <CompanyAvatar name={job.companyName} index={index} />
          <div className="min-w-0">
            <h3 className="font-semibold text-textLight group-hover:text-indigo-400 transition-colors leading-tight truncate">
              {job.title}
            </h3>
            <p className="text-sm text-textLight/50 mt-0.5 truncate">
              {job.companyName || "Company"}
            </p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
      </div>

      {/* Description */}
      {job.description && (
        <p className="text-sm text-textLight/40 line-clamp-2 leading-relaxed">
          {job.description}
        </p>
      )}

      {/* Badges */}
      <div className="flex flex-wrap gap-2">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${typeCls}`}
        >
          {job.type || "Full-time"}
        </span>
        {job.department && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-violet-500/10 text-violet-400 border-violet-500/20">
            {job.department}
          </span>
        )}
        {job.experience && (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-white/5 text-textLight/50 border-white/10">
            <GraduationCap size={11} /> {job.experience}
          </span>
        )}
      </div>

      {/* Skills */}
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {skills.slice(0, 4).map((sk) => (
            <span
              key={sk}
              className="flex items-center gap-1 text-[11px] px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded-md font-medium border border-indigo-500/20"
            >
              <Tag size={9} /> {sk}
            </span>
          ))}
          {skills.length > 4 && (
            <span className="text-[11px] px-2 py-0.5 bg-white/5 text-textLight/40 rounded-md border border-white/10">
              +{skills.length - 4} more
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-textLight/40 pt-3 border-t border-white/10">
        <div className="flex items-center gap-3">
          {job.location && (
            <span className="flex items-center gap-1">
              <MapPin size={11} /> {job.location}
            </span>
          )}
          {job.salary && (
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <DollarSign size={11} /> {job.salary}
            </span>
          )}
        </div>
        <span className="flex items-center gap-1">
          <Clock size={11} /> {posted}
        </span>
      </div>
    </div>
  );
};

// ─── Filter Select ────────────────────────────────────────────
const FilterSelect = ({ label, value, onChange, options, placeholder }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-semibold text-textLight/50 uppercase tracking-wide">
      {label}
    </label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-textLight focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
    >
      <option value="" className="bg-bgDark">
        {placeholder}
      </option>
      {options.map((o) => (
        <option key={o} value={o} className="bg-bgDark">
          {o}
        </option>
      ))}
    </select>
  </div>
);

// ─── Main Page ────────────────────────────────────────────────
const UserJob = () => {
  const navigate = useNavigate();
  const [showFilters, setShowFilters] = useState(false);

  const {
    jobs,
    total,
    isFetching,
    error,
    search,
    setSearch,
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

  return (
    <div className="min-h-screen">
      {/* ── Header ── */}
      <div className="border-b border-white/10 bg-white/5 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-textLight flex items-center gap-2">
              <Briefcase className="text-indigo-400" size={24} />
              Job Openings
            </h1>
            <p className="text-textLight/50 mt-1 text-sm">
              {isFetching
                ? "Loading opportunities..."
                : `${total} position${total !== 1 ? "s" : ""} available across companies`}
            </p>
          </div>

          {/* Search bar */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-textLight/30" />
              <input
                type="text"
                placeholder="Search by title, company, or keyword..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-10 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-textLight placeholder-textLight/30 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white/10 transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-textLight/30 hover:text-textLight/60 transition-colors"
                >
                  <X size={15} />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                showFilters || hasActiveFilters
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-900/30"
                  : "bg-white/5 text-textLight/70 border-white/10 hover:border-indigo-500/50 hover:bg-white/10"
              }`}
            >
              <SlidersHorizontal size={15} />
              Filters
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-white opacity-80" />
              )}
            </button>
          </div>

          {/* Filters panel */}
          {showFilters && (
            <div className="mt-4 p-5 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <FilterSelect
                  label="Department"
                  value={department}
                  onChange={setDepartment}
                  options={DEPARTMENTS}
                  placeholder="All Departments"
                />
                <FilterSelect
                  label="Job Type"
                  value={type}
                  onChange={setType}
                  options={JOB_TYPES}
                  placeholder="All Types"
                />
                <FilterSelect
                  label="Experience"
                  value={experience}
                  onChange={setExperience}
                  options={EXPERIENCES}
                  placeholder="Any Experience"
                />
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-textLight/50 uppercase tracking-wide">
                    Location
                  </label>
                  <input
                    type="text"
                    placeholder="City or Remote"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-textLight placeholder-textLight/30 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="mt-4 flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 font-medium transition-colors"
                >
                  <X size={13} /> Clear all filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {isFetching ? (
          /* Loading skeletons */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="bg-white/5 border border-white/10 rounded-2xl p-6 animate-pulse space-y-4"
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/10" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-white/10 rounded w-3/4" />
                    <div className="h-3 bg-white/10 rounded w-1/2" />
                  </div>
                </div>
                <div className="h-3 bg-white/10 rounded w-full" />
                <div className="h-3 bg-white/10 rounded w-5/6" />
                <div className="flex gap-2">
                  <div className="h-5 w-16 bg-white/10 rounded-full" />
                  <div className="h-5 w-20 bg-white/10 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-24">
            <p className="text-red-400 font-medium">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 text-sm text-indigo-400 hover:underline"
            >
              Try again
            </button>
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Building2 className="w-8 h-8 text-white/20" />
            </div>
            <div className="text-center">
              <p className="text-textLight/70 font-semibold">No jobs found</p>
              <p className="text-textLight/40 text-sm mt-1">
                Try adjusting your filters or search term
              </p>
            </div>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="text-sm text-indigo-400 hover:underline font-medium"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {jobs.map((job, i) => (
              <JobCard
                key={job.id}
                job={job}
                index={i}
                onClick={() => navigate(`/jobs/${job.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserJob;

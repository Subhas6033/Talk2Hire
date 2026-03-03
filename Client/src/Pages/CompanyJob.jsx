import {
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Eye,
  MapPin,
  Clock,
  Users,
  Briefcase,
  X,
  ChevronDown,
  Save,
  AlertCircle,
  CheckCircle,
  ToggleLeft,
  ToggleRight,
  DollarSign,
} from "lucide-react";
import { useState } from "react";
import useJobs from "../Hooks/useJobHook";

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
const EXPERIENCE_LEVELS = [
  "0-1 years",
  "1-2 years",
  "2-4 years",
  "3-5 years",
  "4-6 years",
  "5+ years",
  "7+ years",
];
const STATUS_OPTIONS = ["active", "closed", "draft"];

const statusConfig = {
  active: {
    label: "Active",
    cls: "bg-emerald-50 text-emerald-600 border border-emerald-200",
  },
  closed: {
    label: "Closed",
    cls: "bg-gray-100 text-gray-500 border border-gray-200",
  },
  draft: {
    label: "Draft",
    cls: "bg-amber-50 text-amber-600 border border-amber-200",
  },
};

const EMPTY_JOB = {
  title: "",
  department: "",
  location: "",
  type: "Full-time",
  experience: "",
  salary: "",
  status: "active",
  description: "",
  skills: [],
  responsibilities: "",
  requirements: "",
};

// ─── Helper: always returns an array from skills ──────────────
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

// ─── Field wrapper ────────────────────────────────────────────
const Field = ({ label, error, required, children }) => (
  <div>
    <label className="block text-xs font-semibold text-gray-600 mb-1.5 tracking-wide uppercase">
      {label} {required && <span className="text-red-400">*</span>}
    </label>
    {children}
    {error && (
      <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
        <AlertCircle size={11} /> {error}
      </p>
    )}
  </div>
);

const inputCls = (err) =>
  `w-full px-3.5 py-2.5 rounded-xl border text-sm text-gray-800 outline-none transition-all bg-white ${
    err
      ? "border-red-300 focus:ring-2 focus:ring-red-100"
      : "border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50"
  }`;

const selectCls = inputCls(false) + " cursor-pointer appearance-none";

// ─── Job Form Modal ───────────────────────────────────────────
const JobFormModal = ({ job, onClose, onSave, isSaving }) => {
  const isEdit = !!job?.id;
  const [form, setForm] = useState(job || EMPTY_JOB);
  const [skillInput, setSkillInput] = useState("");
  const [errors, setErrors] = useState({});
  const [saved, setSaved] = useState(false);

  const set = (key, val) => {
    setForm((p) => ({ ...p, [key]: val }));
    if (errors[key]) setErrors((p) => ({ ...p, [key]: "" }));
  };

  const addSkill = (e) => {
    if ((e.key === "Enter" || e.key === ",") && skillInput.trim()) {
      e.preventDefault();
      if (!form.skills.includes(skillInput.trim()))
        set("skills", [...form.skills, skillInput.trim()]);
      setSkillInput("");
    }
  };

  const removeSkill = (s) =>
    set(
      "skills",
      form.skills.filter((k) => k !== s),
    );

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = "Job title is required";
    if (!form.department) e.department = "Department is required";
    if (!form.location.trim()) e.location = "Location is required";
    if (!form.experience) e.experience = "Experience level is required";
    if (!form.description.trim()) e.description = "Description is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    const result = await onSave(form);
    if (!result?.error) setSaved(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {isEdit ? "Edit Job Post" : "Create New Job"}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {isEdit
                ? "Update the job details below"
                : "Fill in the details to post a new job"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
          >
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-7 py-6 space-y-5">
          <Field label="Job Title" required error={errors.title}>
            <input
              className={inputCls(errors.title)}
              placeholder="e.g. Senior Frontend Developer"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Department" required error={errors.department}>
              <div className="relative">
                <select
                  className={selectCls + " pr-8"}
                  value={form.department}
                  onChange={(e) => set("department", e.target.value)}
                >
                  <option value="">Select...</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
                <ChevronDown
                  size={13}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
              </div>
            </Field>
            <Field label="Job Type">
              <div className="relative">
                <select
                  className={selectCls + " pr-8"}
                  value={form.type}
                  onChange={(e) => set("type", e.target.value)}
                >
                  {JOB_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <ChevronDown
                  size={13}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Location" required error={errors.location}>
              <input
                className={inputCls(errors.location)}
                placeholder="e.g. Remote or New York, NY"
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
              />
            </Field>
            <Field label="Experience" required error={errors.experience}>
              <div className="relative">
                <select
                  className={selectCls + " pr-8"}
                  value={form.experience}
                  onChange={(e) => set("experience", e.target.value)}
                >
                  <option value="">Select...</option>
                  {EXPERIENCE_LEVELS.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
                <ChevronDown
                  size={13}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Salary Range">
              <div className="relative">
                <DollarSign
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  className={inputCls(false) + " pl-8"}
                  placeholder="e.g. $80,000 - $120,000"
                  value={form.salary}
                  onChange={(e) => set("salary", e.target.value)}
                />
              </div>
            </Field>
            <Field label="Status">
              <div className="relative">
                <select
                  className={selectCls + " pr-8"}
                  value={form.status}
                  onChange={(e) => set("status", e.target.value)}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={13}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
              </div>
            </Field>
          </div>

          <Field label="Job Description" required error={errors.description}>
            <textarea
              rows={3}
              className={inputCls(errors.description) + " resize-none"}
              placeholder="Describe the role..."
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </Field>

          <Field label="Responsibilities">
            <textarea
              rows={3}
              className={inputCls(false) + " resize-none"}
              placeholder="List key responsibilities (one per line)..."
              value={form.responsibilities}
              onChange={(e) => set("responsibilities", e.target.value)}
            />
          </Field>

          <Field label="Requirements">
            <textarea
              rows={3}
              className={inputCls(false) + " resize-none"}
              placeholder="List requirements (one per line)..."
              value={form.requirements}
              onChange={(e) => set("requirements", e.target.value)}
            />
          </Field>

          <Field label="Required Skills">
            <div
              className={`${inputCls(false)} min-h-11 flex flex-wrap gap-2 items-center cursor-text`}
              onClick={() => document.getElementById("skill-input")?.focus()}
            >
              {form.skills.map((s) => (
                <span
                  key={s}
                  className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-600 text-xs font-medium rounded-lg border border-indigo-100"
                >
                  {s}
                  <button type="button" onClick={() => removeSkill(s)}>
                    <X
                      size={11}
                      className="hover:text-red-500 transition-colors"
                    />
                  </button>
                </span>
              ))}
              <input
                id="skill-input"
                className="outline-none text-sm flex-1 min-w-30 bg-transparent"
                placeholder={
                  form.skills.length === 0
                    ? "Type skill and press Enter..."
                    : "Add more..."
                }
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={addSkill}
              />
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              Press Enter or comma to add a skill
            </p>
          </Field>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-7 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-200 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || saved}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md hover:shadow-lg transition-all disabled:opacity-70"
            style={{
              background: saved
                ? "linear-gradient(135deg, #10b981, #059669)"
                : "linear-gradient(135deg, #6366f1, #4f46e5)",
            }}
          >
            {saved ? (
              <>
                <CheckCircle size={15} /> Saved!
              </>
            ) : isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{" "}
                Saving...
              </>
            ) : (
              <>
                <Save size={15} /> {isEdit ? "Update Job" : "Post Job"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Job Card ─────────────────────────────────────────────────
const JobCard = ({
  job,
  onEdit,
  onDelete,
  onToggleStatus,
  isDeleting,
  isToggling,
}) => {
  const s = statusConfig[job.status] || statusConfig.closed;
  const skills = parseSkills(job.skills); // ← FIXED: always an array

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all group overflow-hidden">
      <div
        className="h-1"
        style={{
          background:
            job.status === "active"
              ? "linear-gradient(90deg, #6366f1, #4f46e5)"
              : job.status === "draft"
                ? "linear-gradient(90deg, #f59e0b, #d97706)"
                : "linear-gradient(90deg, #d1d5db, #9ca3af)",
        }}
      />

      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-indigo-50 border border-indigo-100">
              <Briefcase size={17} className="text-indigo-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 group-hover:text-indigo-600 transition-colors leading-tight">
                {job.title}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">{job.department}</p>
            </div>
          </div>
          <span
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${s.cls}`}
          >
            {s.label}
          </span>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-4">
          {[
            { icon: MapPin, text: job.location },
            { icon: Clock, text: job.type },
            { icon: Users, text: `${job.applicants ?? 0} applicants` },
          ].map(({ icon: Icon, text }) => (
            <span
              key={text}
              className="flex items-center gap-1.5 text-xs text-gray-400"
            >
              <Icon size={12} className="text-gray-300" /> {text}
            </span>
          ))}
        </div>

        {/* ← FIXED: using parsed skills array */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {skills.slice(0, 4).map((sk) => (
            <span
              key={sk}
              className="text-[11px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-md font-medium"
            >
              {sk}
            </span>
          ))}
          {skills.length > 4 && (
            <span className="text-[11px] px-2 py-0.5 bg-gray-100 text-gray-400 rounded-md">
              +{skills.length - 4}
            </span>
          )}
        </div>

        {job.salary && (
          <div className="flex items-center gap-1.5 mb-4">
            <DollarSign size={12} className="text-emerald-500" />
            <span className="text-xs text-emerald-600 font-medium">
              {job.salary}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <span className="text-[11px] text-gray-400 flex items-center gap-1">
            <Clock size={10} /> Posted {job.posted}
          </span>
          <div className="flex items-center gap-1">
            {/* Toggle */}
            <button
              onClick={() => onToggleStatus(job.id)}
              disabled={isToggling}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
              title={job.status === "active" ? "Deactivate" : "Activate"}
            >
              {isToggling ? (
                <div className="w-3 h-3 border border-gray-300 border-t-gray-500 rounded-full animate-spin" />
              ) : job.status === "active" ? (
                <ToggleRight size={16} className="text-emerald-500" />
              ) : (
                <ToggleLeft size={16} className="text-gray-400" />
              )}
            </button>

            {/* View */}
            <button
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-indigo-50 transition-colors"
              title="View applicants"
            >
              <Eye size={14} className="text-gray-400 hover:text-indigo-500" />
            </button>

            {/* Edit */}
            <button
              onClick={() => onEdit(job)}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-indigo-50 transition-colors"
              title="Edit job"
            >
              <Edit2
                size={14}
                className="text-gray-400 hover:text-indigo-500"
              />
            </button>

            {/* Delete */}
            <button
              onClick={() => onDelete(job.id)}
              disabled={isDeleting}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors"
              title="Delete job"
            >
              {isDeleting ? (
                <div className="w-3 h-3 border border-red-300 border-t-red-500 rounded-full animate-spin" />
              ) : (
                <Trash2
                  size={14}
                  className="text-gray-400 hover:text-red-500"
                />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────
const CompanyJob = () => {
  const {
    jobs,
    counts,
    uniqueDepts,
    search,
    setSearch,
    filterStatus,
    setFilterStatus,
    filterDept,
    setFilterDept,
    modal,
    openCreate,
    openEdit,
    closeModal,
    handleSave,
    handleDelete,
    handleToggleStatus,
    isFetching,
    isSaving,
    isDeleting,
    isToggling,
    error,
    successMessage,
  } = useJobs();

  return (
    <>
      {/* Basic SEO */}
      <title>Manage Job Posts | Talk2Hire Business Portal</title>

      <meta
        name="description"
        content="Create, edit, and manage your company job postings, track applicants, and control listing status inside the Talk2Hire employer dashboard."
      />

      {/* Critical: Prevent indexing */}
      <meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />

      <link rel="canonical" href="https://talk2hire.com/company/jobs" />

      {/* Optional Open Graph (internal sharing only) */}
      <meta
        property="og:title"
        content="Manage Job Posts | Talk2Hire Business Portal"
      />
      <meta
        property="og:description"
        content="Post new roles, update job listings, and manage applicants."
      />
      <meta property="og:type" content="website" />
      <meta property="og:url" content="https://talk2hire.com/company/jobs" />

      {/* Main components starts from here */}
      <div className="min-h-screen bg-gray-50">
        {/* ── Toast Notifications ── */}
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
          {successMessage && (
            <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl shadow-md">
              <CheckCircle size={15} /> {successMessage}
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl shadow-md">
              <AlertCircle size={15} /> {error}
            </div>
          )}
        </div>

        {/* ── Header ── */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Job Posts</h1>
                <p className="text-sm text-gray-400 mt-0.5">
                  Manage your open positions and track applicants
                </p>
              </div>
              <button
                onClick={openCreate}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md hover:shadow-lg transition-all"
                style={{
                  background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                }}
              >
                <Plus size={16} /> Post New Job
              </button>
            </div>

            {/* Status tabs */}
            <div className="flex items-center gap-1 mt-5">
              {["all", "active", "closed", "draft"].map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                    filterStatus === s
                      ? "bg-indigo-50 text-indigo-600"
                      : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                  }`}
                >
                  {s === "all"
                    ? "All Jobs"
                    : s.charAt(0).toUpperCase() + s.slice(1)}
                  <span
                    className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold ${
                      filterStatus === s
                        ? "bg-indigo-100 text-indigo-600"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {counts[s]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-6">
          {/* ── Search + Filter ── */}
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <div className="relative flex-1 min-w-55">
              <Search
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all"
                placeholder="Search jobs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="relative">
              <Filter
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <select
                className="pl-8 pr-8 py-2.5 rounded-xl border border-gray-200 text-sm bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all appearance-none cursor-pointer text-gray-600"
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
              >
                <option value="all">All Departments</option>
                {uniqueDepts.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
              <ChevronDown
                size={13}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>
          </div>

          {/* ── Loading skeleton ── */}
          {isFetching && jobs.length === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl border border-gray-200 h-64 animate-pulse"
                >
                  <div className="h-1 bg-gray-200 rounded-t-2xl" />
                  <div className="p-5 space-y-3">
                    <div className="h-4 bg-gray-100 rounded w-3/4" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                    <div className="h-3 bg-gray-100 rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Jobs Grid ── */}
          {!isFetching || jobs.length > 0 ? (
            jobs.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {jobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                    onToggleStatus={handleToggleStatus}
                    isDeleting={isDeleting(job.id)}
                    isToggling={isToggling(job.id)}
                  />
                ))}
                <button
                  onClick={openCreate}
                  className="bg-white rounded-2xl border-2 border-dashed border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all flex flex-col items-center justify-center gap-3 p-8 min-h-50 group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-gray-100 group-hover:bg-indigo-100 flex items-center justify-center transition-colors">
                    <Plus
                      size={22}
                      className="text-gray-400 group-hover:text-indigo-500 transition-colors"
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-500 group-hover:text-indigo-600 transition-colors">
                      Post New Job
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Click to create a new listing
                    </p>
                  </div>
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
                  <Briefcase size={28} className="text-indigo-300" />
                </div>
                <h3 className="text-base font-bold text-gray-700 mb-1">
                  No jobs found
                </h3>
                <p className="text-sm text-gray-400 mb-6 max-w-xs">
                  {search || filterStatus !== "all" || filterDept !== "all"
                    ? "Try adjusting your filters or search terms."
                    : "You haven't posted any jobs yet. Create your first listing!"}
                </p>
                <button
                  onClick={openCreate}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md"
                  style={{
                    background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                  }}
                >
                  <Plus size={15} /> Post Your First Job
                </button>
              </div>
            )
          ) : null}
        </div>

        {/* ── Modal ── */}
        {modal && (
          <JobFormModal
            job={modal === "create" ? null : modal}
            onClose={closeModal}
            onSave={handleSave}
            isSaving={isSaving}
          />
        )}
      </div>
    </>
  );
};

export default CompanyJob;

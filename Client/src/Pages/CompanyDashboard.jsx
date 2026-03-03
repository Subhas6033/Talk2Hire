import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCompany } from "../Hooks/useCompanyAuthHook";
import useDashboard from "../Hooks/useCompanyDashboardHook";
import {
  Briefcase,
  Users,
  Video,
  TrendingUp,
  Plus,
  ArrowRight,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Star,
  MapPin,
  Building2,
  BarChart3,
  Zap,
  Target,
  ChevronRight,
  AlertCircle,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────
const STAT_ICONS = {
  indigo: Briefcase,
  violet: Users,
  blue: Video,
  emerald: TrendingUp,
};

const HOW_IT_WORKS = [
  {
    step: "01",
    icon: Briefcase,
    title: "Post a Job",
    desc: "Create a detailed job listing with required skills, experience, and role description. Our AI will optimize it for the best candidates.",
  },
  {
    step: "02",
    icon: Users,
    title: "Candidates Apply",
    desc: "Qualified candidates discover your listing, upload their resume, and our AI matches them to your requirements automatically.",
  },
  {
    step: "03",
    icon: Video,
    title: "Interviews",
    desc: "Candidates take a fully automated AI-powered interview tailored to the skills you need. No scheduling hassle.",
  },
  {
    step: "04",
    icon: Target,
    title: "You Decide",
    desc: "Review scored interview results, watch recordings, and make confident hiring decisions from your dashboard.",
  },
];

const colorMap = {
  indigo: {
    bg: "bg-indigo-50",
    text: "text-indigo-600",
    icon: "text-indigo-500",
    border: "border-indigo-100",
  },
  violet: {
    bg: "bg-violet-50",
    text: "text-violet-600",
    icon: "text-violet-500",
    border: "border-violet-100",
  },
  blue: {
    bg: "bg-blue-50",
    text: "text-blue-600",
    icon: "text-blue-500",
    border: "border-blue-100",
  },
  emerald: {
    bg: "bg-emerald-50",
    text: "text-emerald-600",
    icon: "text-emerald-500",
    border: "border-emerald-100",
  },
};

const statusConfig = {
  pending: {
    label: "Review",
    cls: "bg-amber-50 text-amber-600 border border-amber-200",
  },
  hired: {
    label: "Hired",
    cls: "bg-emerald-50 text-emerald-600 border border-emerald-200",
  },
  rejected: {
    label: "Rejected",
    cls: "bg-red-50 text-red-500 border border-red-200",
  },
  active: {
    label: "Active",
    cls: "bg-indigo-50 text-indigo-600 border border-indigo-200",
  },
  closed: {
    label: "Closed",
    cls: "bg-gray-100 text-gray-500 border border-gray-200",
  },
};

/**
 * Safe status lookup — never crashes on unexpected/undefined status
 * values returned from the API (e.g. "completed", null, etc.)
 */
const getStatus = (status) =>
  statusConfig[status] ?? {
    label: status ? status.charAt(0).toUpperCase() + status.slice(1) : "—",
    cls: "bg-gray-100 text-gray-500 border border-gray-200",
  };

const scoreColor = (s) =>
  s >= 85 ? "text-emerald-600" : s >= 70 ? "text-amber-500" : "text-red-500";

// ─── Skeleton ─────────────────────────────────────────────────
const Skeleton = ({ className }) => (
  <div className={`animate-pulse bg-gray-100 rounded-xl ${className}`} />
);

// ─── Component ────────────────────────────────────────────────
const CompanyDashboard = () => {
  const { company } = useCompany();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");

  const {
    statCards,
    pipelineBars,
    recentJobs,
    recentInterviews,
    isLoading,
    error,
    refetch,
  } = useDashboard();

  const firstName = company?.companyName?.split(" ")[0] ?? "there";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <>
      {/* Basic SEO */}
      <title>Company Dashboard | Talk2Hire Business Portal</title>

      <meta
        name="description"
        content="Manage your job postings, interviews, and hiring pipeline inside the Talk2Hire company dashboard."
      />

      {/* IMPORTANT: Prevent search engines from indexing */}
      <meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />

      <link rel="canonical" href="https://talk2hire.com/company/dashboard" />

      {/* Open Graph (optional – useful for internal sharing only) */}
      <meta
        property="og:title"
        content="Company Dashboard | Talk2Hire Business Portal"
      />
      <meta
        property="og:description"
        content="Access your hiring analytics, post jobs, and review AI-powered interview results."
      />
      <meta property="og:type" content="website" />
      <meta
        property="og:url"
        content="https://talk2hire.com/company/dashboard"
      />

      {/* Main Page Starts from here  */}
      <div className="min-h-screen bg-gray-50">
        {/* ── Error Banner ── */}
        {error && (
          <div className="bg-red-50 border-b border-red-200 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle size={15} /> {error}
            </div>
            <button
              onClick={refetch}
              className="text-xs font-semibold text-red-600 hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Hero Banner ── */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-sm text-gray-400 font-medium mb-1">
                  {greeting} 👋
                </p>
                <h1 className="text-2xl font-bold text-gray-900">
                  Welcome back,{" "}
                  <span className="text-indigo-600">{firstName}</span>
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  Here's what's happening with your hiring pipeline today.
                </p>
              </div>
              <button
                onClick={() => navigate("/company/jobs")}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md hover:shadow-lg transition-all"
                style={{
                  background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                }}
              >
                <Plus size={16} /> Post a New Job
              </button>
            </div>

            <div className="flex items-center gap-1 mt-6">
              {["overview", "how it works"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                    activeTab === tab
                      ? "bg-indigo-50 text-indigo-600"
                      : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
          {activeTab === "overview" && (
            <>
              {/* ── Stats Grid ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {isLoading
                  ? [...Array(4)].map((_, i) => (
                      <div
                        key={i}
                        className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-3"
                      >
                        <div className="flex justify-between">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-9 w-9" />
                        </div>
                        <Skeleton className="h-8 w-16" />
                        <Skeleton className="h-3 w-28" />
                      </div>
                    ))
                  : statCards.map(({ label, value, change, color }) => {
                      const c = colorMap[color] ?? colorMap.indigo;
                      const Icon = STAT_ICONS[color] ?? Briefcase;
                      return (
                        <div
                          key={label}
                          className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <p className="text-sm font-medium text-gray-500">
                              {label}
                            </p>
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center ${c.bg} ${c.border} border`}
                            >
                              <Icon size={17} className={c.icon} />
                            </div>
                          </div>
                          <p className={`text-3xl font-bold ${c.text} mb-1`}>
                            {value}
                          </p>
                          <p className="text-xs text-gray-400">{change}</p>
                        </div>
                      );
                    })}
              </div>

              {/* ── Main Content Grid ── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Jobs */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <Briefcase size={16} className="text-indigo-500" />
                      <h2 className="text-sm font-semibold text-gray-800">
                        Recent Job Posts
                      </h2>
                    </div>
                    <button
                      onClick={() => navigate("/company/jobs")}
                      className="flex items-center gap-1 text-xs text-indigo-600 font-medium hover:underline"
                    >
                      View all <ChevronRight size={13} />
                    </button>
                  </div>

                  <div className="divide-y divide-gray-50">
                    {isLoading ? (
                      [...Array(3)].map((_, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-4 px-6 py-4"
                        >
                          <Skeleton className="w-10 h-10 shrink-0" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-48" />
                            <Skeleton className="h-3 w-32" />
                          </div>
                          <Skeleton className="h-6 w-16" />
                        </div>
                      ))
                    ) : recentJobs.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-10">
                        No jobs posted yet.
                      </p>
                    ) : (
                      recentJobs.map((job) => {
                        // ✅ Use getStatus — safe against undefined
                        const s = getStatus(job.status);
                        return (
                          <div
                            key={job.id}
                            className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors group"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                                <Briefcase
                                  size={16}
                                  className="text-indigo-500"
                                />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-800 group-hover:text-indigo-600 transition-colors">
                                  {job.title}
                                </p>
                                <div className="flex items-center gap-3 mt-0.5">
                                  <span className="text-xs text-gray-400">
                                    {job.dept}
                                  </span>
                                  <span className="w-1 h-1 rounded-full bg-gray-300" />
                                  <span className="flex items-center gap-1 text-xs text-gray-400">
                                    <MapPin size={10} /> {job.location}
                                  </span>
                                  <span className="w-1 h-1 rounded-full bg-gray-300" />
                                  <span className="flex items-center gap-1 text-xs text-gray-400">
                                    <Clock size={10} /> {job.posted}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right hidden sm:block">
                                <p className="text-sm font-semibold text-gray-700">
                                  {job.applicants}
                                </p>
                                <p className="text-xs text-gray-400">
                                  applicants
                                </p>
                              </div>
                              <span
                                className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${s.cls}`}
                              >
                                {s.label}
                              </span>
                              <button className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-indigo-50 transition-colors">
                                <Eye
                                  size={14}
                                  className="text-gray-400 hover:text-indigo-500"
                                />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
                    <button
                      onClick={() => navigate("/company/jobs")}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-indigo-200 text-sm text-indigo-500 font-medium hover:border-indigo-400 hover:bg-indigo-50 transition-all"
                    >
                      <Plus size={15} /> Post a New Job
                    </button>
                  </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-4">
                  {/* Pipeline */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <BarChart3 size={16} className="text-indigo-500" />
                      <h2 className="text-sm font-semibold text-gray-800">
                        Hiring Pipeline
                      </h2>
                    </div>
                    {isLoading
                      ? [...Array(4)].map((_, i) => (
                          <div key={i} className="mb-3 space-y-1">
                            <div className="flex justify-between">
                              <Skeleton className="h-3 w-20" />
                              <Skeleton className="h-3 w-8" />
                            </div>
                            <Skeleton className="h-1.5 w-full" />
                          </div>
                        ))
                      : pipelineBars.map(({ label, count, pct, color }) => (
                          <div key={label} className="mb-3">
                            <div className="flex justify-between text-xs text-gray-500 mb-1">
                              <span>{label}</span>
                              <span className="font-semibold text-gray-700">
                                {count}
                              </span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${color}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        ))}
                  </div>

                  {/* Quick Actions */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Zap size={16} className="text-indigo-500" />
                      <h2 className="text-sm font-semibold text-gray-800">
                        Quick Actions
                      </h2>
                    </div>
                    <div className="space-y-2">
                      {[
                        {
                          label: "Post a Job",
                          icon: Plus,
                          path: "/company/jobs",
                        },
                        {
                          label: "View Interviews",
                          icon: Video,
                          path: "/company/interviews",
                        },
                        {
                          label: "Company Profile",
                          icon: Building2,
                          path: "/company/profile",
                        },
                      ].map(({ label, icon: Icon, path }) => (
                        <button
                          key={label}
                          onClick={() => navigate(path)}
                          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 transition-all group"
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon
                              size={15}
                              className="text-gray-400 group-hover:text-indigo-500"
                            />
                            {label}
                          </div>
                          <ArrowRight
                            size={14}
                            className="text-gray-300 group-hover:text-indigo-400"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Recent Interviews ── */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <Video size={16} className="text-indigo-500" />
                    <h2 className="text-sm font-semibold text-gray-800">
                      Recent Interviews
                    </h2>
                  </div>
                  <button
                    onClick={() => navigate("/company/interviews")}
                    className="flex items-center gap-1 text-xs text-indigo-600 font-medium hover:underline"
                  >
                    View all <ChevronRight size={13} />
                  </button>
                </div>

                <div className="divide-y divide-gray-50">
                  {isLoading ? (
                    [...Array(3)].map((_, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between px-6 py-4"
                      >
                        <div className="flex items-center gap-4">
                          <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-24" />
                          </div>
                        </div>
                        <Skeleton className="h-6 w-16" />
                      </div>
                    ))
                  ) : recentInterviews.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-10">
                      No interviews yet.
                    </p>
                  ) : (
                    recentInterviews.map((iv) => {
                      // ✅ Use getStatus — safe against undefined
                      const s = getStatus(iv.status);
                      return (
                        <div
                          key={iv.id}
                          className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                              style={{
                                background:
                                  "linear-gradient(135deg, #6366f1, #4f46e5)",
                              }}
                            >
                              {iv.avatar}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-800">
                                {iv.candidate}
                              </p>
                              <p className="text-xs text-gray-400">{iv.role}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 shrink-0">
                            <div className="text-center hidden sm:block">
                              <div className="flex items-center gap-1">
                                <Star
                                  size={12}
                                  className="text-amber-400 fill-amber-400"
                                />
                                <span
                                  className={`text-sm font-bold ${scoreColor(iv.score ?? 0)}`}
                                >
                                  {iv.score ?? "—"}
                                </span>
                              </div>
                              <p className="text-[10px] text-gray-400">
                                Candidate Score
                              </p>
                            </div>
                            <div className="text-right hidden md:block">
                              <p className="text-xs text-gray-400">{iv.date}</p>
                            </div>
                            <span
                              className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${s.cls}`}
                            >
                              {s.label}
                            </span>
                            {iv.status === "pending" && (
                              <div className="flex items-center gap-1">
                                <button className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-50 hover:bg-emerald-100 transition-colors">
                                  <CheckCircle
                                    size={14}
                                    className="text-emerald-500"
                                  />
                                </button>
                                <button className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-100 transition-colors">
                                  <XCircle size={14} className="text-red-400" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === "how it works" && (
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 mb-4">
                  <Zap size={13} className="text-indigo-500" />
                  <span className="text-xs font-semibold text-indigo-600 tracking-wide uppercase">
                    How It Works
                  </span>
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-3">
                  Hire smarter with{" "}
                  <span className="text-indigo-600">AI-powered</span> interviews
                </h2>
                <p className="text-gray-500 text-base max-w-xl mx-auto leading-relaxed">
                  From posting a job to making a hire — our platform automates
                  the entire interview process so you can focus on choosing the
                  right person.
                </p>
              </div>

              <div className="space-y-4">
                {HOW_IT_WORKS.map(({ step, icon: Icon, title, desc }, i) => (
                  <div
                    key={step}
                    className="flex items-start gap-6 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:border-indigo-200 hover:shadow-md transition-all group"
                  >
                    <div className="shrink-0 flex flex-col items-center gap-2">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center group-hover:shadow-md transition-all"
                        style={{
                          background:
                            "linear-gradient(135deg, #6366f1, #4f46e5)",
                        }}
                      >
                        <Icon size={20} className="text-white" />
                      </div>
                      <span className="text-xs font-bold text-gray-300">
                        {step}
                      </span>
                    </div>
                    <div className="flex-1 pt-1">
                      <h3 className="text-base font-bold text-gray-900 mb-1.5 group-hover:text-indigo-600 transition-colors">
                        {title}
                      </h3>
                      <p className="text-sm text-gray-500 leading-relaxed">
                        {desc}
                      </p>
                    </div>
                    {i < HOW_IT_WORKS.length - 1 && (
                      <div className="shrink-0 self-center">
                        <ArrowRight
                          size={18}
                          className="text-gray-300 group-hover:text-indigo-400 transition-colors"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div
                className="mt-10 rounded-2xl border border-indigo-200 shadow-sm p-8 text-center"
                style={{
                  background:
                    "linear-gradient(135deg, #f0f0ff 0%, #fafaff 100%)",
                }}
              >
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Ready to find your next hire?
                </h3>
                <p className="text-sm text-gray-500 mb-6">
                  Post your first job and let AI handle the interviews.
                </p>
                <button
                  onClick={() => navigate("/company/jobs")}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white shadow-md hover:shadow-lg transition-all"
                  style={{
                    background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                  }}
                >
                  <Plus size={16} /> Post Your First Job{" "}
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default CompanyDashboard;

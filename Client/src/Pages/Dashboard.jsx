import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useInView } from "motion/react";
import { useProfile } from "../Hooks/userProfileHook";

const Icon = ({ d, size = 20, className = "", strokeWidth = 1.8 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {Array.isArray(d) ? (
      d.map((p, i) => <path key={i} d={p} />)
    ) : (
      <path d={d} />
    )}
  </svg>
);

const Icons = {
  Trophy: (p) => (
    <Icon
      {...p}
      d={[
        "M6 9H4.5a2.5 2.5 0 0 1 0-5H6",
        "M18 9h1.5a2.5 2.5 0 0 0 0-5H18",
        "M4 22h16",
        "M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.23 7 22",
        "M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.23 17 22",
        "M18 2H6v7a6 6 0 0 0 12 0V2z",
      ]}
    />
  ),
  Target: (p) => (
    <Icon
      {...p}
      d={[
        "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z",
        "M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z",
        "M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
      ]}
    />
  ),
  TrendingUp: (p) => <Icon {...p} d="m23 6-9.5 9.5-5-5L1 18" />,
  Clock: (p) => (
    <Icon
      {...p}
      d={["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M12 6v6l4 2"]}
    />
  ),
  Brain: (p) => (
    <Icon
      {...p}
      d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"
    />
  ),
  BarChart: (p) => <Icon {...p} d={["M12 20V10", "M18 20V4", "M6 20v-4"]} />,
  Calendar: (p) => (
    <Icon
      {...p}
      d={[
        "M8 2v4",
        "M16 2v4",
        "M3 10h18",
        "M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z",
      ]}
    />
  ),
  MessageSquare: (p) => (
    <Icon
      {...p}
      d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
    />
  ),
  Download: (p) => (
    <Icon
      {...p}
      d={[
        "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",
        "M7 10l5 5 5-5",
        "M12 15V3",
      ]}
    />
  ),
  Share: (p) => (
    <Icon
      {...p}
      d={[
        "M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8",
        "M16 6l-4-4-4 4",
        "M12 2v13",
      ]}
    />
  ),
  ChevronRight: (p) => <Icon {...p} d="m9 18 6-6-6-6" />,
  Check: (p) => (
    <Icon {...p} strokeWidth={2} d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
  ),
  Alert: (p) => (
    <Icon
      {...p}
      d={["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M12 8v4", "M12 16h.01"]}
    />
  ),
  Award: (p) => (
    <Icon
      {...p}
      d={[
        "M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14z",
        "M8.21 13.89 7 23l5-3 5 3-1.21-9.12",
      ]}
    />
  ),
  X: (p) => <Icon {...p} d="M18 6 6 18M6 6l12 12" />,
  User: (p) => (
    <Icon
      {...p}
      d={[
        "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2",
        "M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
      ]}
    />
  ),
};

const AnimatedNumber = ({ value, suffix = "", prefix = "" }) => {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    const num = parseFloat(value);
    if (isNaN(num)) return;
    let startTime = null;
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / 1200, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.floor(eased * num));
      if (progress < 1) requestAnimationFrame(step);
      else setDisplay(num);
    };
    requestAnimationFrame(step);
  }, [inView, value]);

  return (
    <span ref={ref}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
};

const ScoreRing = ({ score, size = 60 }) => {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#f1f5f9"
        strokeWidth={5}
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ - (score / 100) * circ }}
        transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
        strokeLinecap="round"
      />
      <text
        x={size / 2}
        y={size / 2 + 5}
        textAnchor="middle"
        fontSize={size * 0.22}
        fontWeight="700"
        fill={color}
        style={{
          transform: "rotate(90deg)",
          transformOrigin: `${size / 2}px ${size / 2}px`,
        }}
      >
        {score}%
      </text>
    </svg>
  );
};

const SkillTag = ({ skill, index }) => (
  <motion.span
    initial={{ opacity: 0, scale: 0.85 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay: index * 0.05, duration: 0.35 }}
    className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold"
  >
    {skill}
  </motion.span>
);

const StatCard = ({
  label,
  value,
  suffix,
  prefix,
  colorClass,
  iconBgClass,
  IconComp,
  delay = 0,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 24 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay, ease: "easeOut" }}
    whileHover={{ y: -3 }}
    className="bg-white rounded-2xl px-7 py-6 flex items-center justify-between shadow-sm border border-slate-100 cursor-default"
  >
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
        {label}
      </p>
      <p
        className="text-4xl font-extrabold leading-none"
        style={{
          fontFamily: "'Syne', sans-serif",
          color: colorClass.replace("text-", ""),
        }}
      >
        {typeof value === "number" ? (
          <AnimatedNumber value={value} suffix={suffix} prefix={prefix} />
        ) : (
          <span className={colorClass}>{value ?? "—"}</span>
        )}
      </p>
    </div>
    <div
      className={`rounded-2xl ${iconBgClass} flex items-center justify-center`}
      style={{ width: 52, height: 52 }}
    >
      <IconComp size={24} className={colorClass} />
    </div>
  </motion.div>
);

const ScoreBadge = ({ score }) => {
  if (score == null)
    return (
      <span className="px-3.5 py-1.5 rounded-xl border-2 text-slate-400 bg-slate-50 border-slate-200 text-base font-extrabold">
        —
      </span>
    );
  const cls =
    score >= 80
      ? "text-green-500 bg-green-50 border-green-200"
      : score >= 60
        ? "text-amber-500 bg-amber-50 border-amber-200"
        : "text-red-400 bg-red-50 border-red-200";
  return (
    <div className={`px-3.5 py-1.5 rounded-xl border-2 ${cls}`}>
      <span
        className="text-base font-extrabold"
        style={{ fontFamily: "'Roboto Mono', monospace" }}
      >
        {score}%
      </span>
    </div>
  );
};

const PageSkeleton = () => (
  <div
    className="min-h-screen bg-linear-to-br from-slate-50 to-indigo-50/60 px-6 py-10"
    style={{ fontFamily: "'DM Sans', sans-serif" }}
  >
    <div className="max-w-7xl mx-auto flex flex-col gap-7">
      <div className="h-10 bg-slate-200 rounded-xl w-48 animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white rounded-2xl px-7 py-6 h-28 animate-pulse border border-slate-100"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-3xl p-7 h-72 animate-pulse border border-slate-100" />
        <div className="bg-white rounded-3xl p-7 h-72 animate-pulse border border-slate-100" />
      </div>
    </div>
  </div>
);

const formatDuration = (seconds) => {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

const Dashboard = () => {
  const [selectedInterview, setSelectedInterview] = useState(null);
  const [hoveredRow, setHoveredRow] = useState(null);
  const navigate = useNavigate();

  const {
    profile,
    loading,
    interviews,
    interviewsLoading,
    loadProfile,
    loadInterviews,
  } = useProfile();

  useEffect(() => {
    loadProfile();
    loadInterviews({ page: 1, limit: 10 });
  }, []);

  if (loading && !profile) return <PageSkeleton />;

  const cvSkills = profile?.cvSkills || [];

  const stats = [
    {
      label: "Total Interviews",
      value: profile?.totalInterview ?? 0,
      colorClass: "text-indigo-500",
      iconBgClass: "bg-indigo-50",
      IconComp: Icons.MessageSquare,
    },
    {
      label: "Last Score",
      value: profile?.interviewScore ?? null,
      suffix: profile?.interviewScore != null ? "%" : "",
      colorClass: "text-green-500",
      iconBgClass: "bg-green-50",
      IconComp: Icons.Trophy,
    },
    {
      label: "Performance",
      value: profile?.performance ?? "—",
      colorClass: "text-amber-500",
      iconBgClass: "bg-amber-50",
      IconComp: Icons.TrendingUp,
    },
    {
      label: "Avg. Time",
      value: profile?.averageTime ?? "—",
      colorClass: "text-blue-500",
      iconBgClass: "bg-blue-50",
      IconComp: Icons.Clock,
    },
  ];

  return (
    <>
      <title>Your Interview Dashboard | Talk2Hire</title>
      <meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100..900;1,100..900&family=Roboto+Mono:ital,wght@0,100..700;1,100..700&family=Sour+Gummy:ital,wght@0,100..900;1,100..900&display=swap');
      `}</style>

      <div
        className="min-h-screen bg-linear-to-br from-slate-50 to-indigo-50/60 px-6 py-10"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        <div className="max-w-7xl mx-auto flex flex-col gap-7">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col sm:flex-row sm:items-start justify-between gap-5 flex-wrap"
          >
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-9 h-9 rounded-xl bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-200">
                  <Icons.Brain size={18} className="text-white" />
                </div>
                <span
                  className="text-xs font-bold tracking-widest uppercase text-indigo-500"
                  style={{ fontFamily: "'Roboto Mono', monospace" }}
                >
                  Interview Prep
                </span>
              </div>
              <h1
                className="text-4xl font-extrabold text-slate-900 leading-tight"
                style={{ fontFamily: "'Syne', sans-serif" }}
              >
                {profile?.fullName
                  ? `Hey, ${profile.fullName.split(" ")[0]}`
                  : "Your Dashboard"}
              </h1>
              <p className="text-slate-500 text-sm mt-1.5">
                Track your progress and sharpen your interview edge
              </p>
            </div>
            <div className="flex gap-2.5 flex-wrap">
              <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-indigo-500 bg-white border-2 border-indigo-100 hover:bg-indigo-50 transition-colors">
                <Icons.Download size={14} /> Export
              </button>
              <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-indigo-500 bg-white border-2 border-indigo-100 hover:bg-indigo-50 transition-colors">
                <Icons.Share size={14} /> Share
              </button>
              <button
                onClick={() => navigate("/jobs")}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-linear-to-r from-indigo-500 to-violet-600 hover:opacity-90 hover:-translate-y-0.5 transition-all shadow-lg shadow-indigo-200"
              >
                <Icons.Target size={16} /> New Interview
              </button>
            </div>
          </motion.div>

          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((s, i) => (
              <StatCard key={i} {...s} delay={i * 0.08} />
            ))}
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Recent Interviews */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.5 }}
              className="lg:col-span-2 bg-white rounded-3xl p-7 shadow-sm border border-slate-100"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                    <Icons.Calendar size={18} className="text-indigo-500" />
                  </div>
                  <span
                    className="text-lg font-bold text-slate-900"
                    style={{ fontFamily: "'Syne', sans-serif" }}
                  >
                    Recent Interviews
                  </span>
                </div>
                <button className="flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-bold text-indigo-500 bg-slate-50 border-2 border-indigo-100 hover:bg-indigo-50 transition-colors">
                  View All <Icons.ChevronRight size={13} />
                </button>
              </div>

              {interviewsLoading ? (
                <div className="flex flex-col gap-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-20 rounded-2xl bg-slate-50 animate-pulse"
                    />
                  ))}
                </div>
              ) : interviews.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
                  <Icons.MessageSquare size={36} className="text-slate-200" />
                  <p className="text-sm font-semibold">No interviews yet</p>
                  <button
                    onClick={() => navigate("/jobs")}
                    className="text-xs font-bold text-indigo-500 hover:underline"
                  >
                    Start your first interview →
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {interviews.slice(0, 5).map((iv, i) => (
                    <motion.div
                      key={iv.id}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + i * 0.1, duration: 0.45 }}
                      whileHover={{ x: 3 }}
                      onHoverStart={() => setHoveredRow(iv.id)}
                      onHoverEnd={() => setHoveredRow(null)}
                      onClick={() => setSelectedInterview(iv)}
                      className={`flex items-center justify-between px-5 py-4 rounded-2xl cursor-pointer transition-colors border-2 ${hoveredRow === iv.id ? "bg-slate-50 border-indigo-100" : "bg-slate-50/50 border-slate-100"}`}
                    >
                      <div className="flex-1 min-w-0">
                        <h3
                          className="font-bold text-slate-900 text-sm mb-1.5 truncate"
                          style={{ fontFamily: "'Syne', sans-serif" }}
                        >
                          {iv.jobTitle || "Interview"}
                        </h3>
                        <div className="flex items-center gap-4 flex-wrap">
                          {[
                            {
                              Icon: Icons.Calendar,
                              label: formatDate(iv.createdAt),
                            },
                            {
                              Icon: Icons.Clock,
                              label: formatDuration(iv.duration),
                            },
                            { Icon: Icons.User, label: iv.companyName || "—" },
                          ].map(({ Icon, label }, j) => (
                            <span
                              key={j}
                              className="flex items-center gap-1 text-xs text-slate-400 font-medium"
                            >
                              <Icon size={11} /> {label}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 ml-4 shrink-0">
                        <ScoreBadge score={iv.score} />
                        <motion.div
                          animate={{ x: hoveredRow === iv.id ? 3 : 0 }}
                          className="text-slate-300"
                        >
                          <Icons.ChevronRight size={18} />
                        </motion.div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Skill Progress */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.5 }}
              className="bg-white rounded-3xl p-7 shadow-sm border border-slate-100"
            >
              <div className="flex items-center gap-2.5 mb-6">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <Icons.BarChart size={18} className="text-indigo-500" />
                </div>
                <span
                  className="text-lg font-bold text-slate-900"
                  style={{ fontFamily: "'Syne', sans-serif" }}
                >
                  Your Skills
                </span>
              </div>

              {cvSkills.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-400">
                  <Icons.BarChart size={32} className="text-slate-200" />
                  <p className="text-sm font-semibold text-center">
                    Upload your resume to see skill breakdown
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {cvSkills.map((skill, i) => (
                    <SkillTag key={skill} skill={skill} index={i} />
                  ))}
                </div>
              )}
            </motion.div>
          </div>

          {/* CTA Banner */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.5 }}
            className="relative overflow-hidden rounded-3xl bg-linear-to-br from-indigo-500 via-violet-600 to-purple-600 px-10 py-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xl shadow-indigo-200"
          >
            <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-white/10 pointer-events-none" />
            <div className="absolute right-20 -bottom-14 w-28 h-28 rounded-full bg-white/6 pointer-events-none" />

            <div className="flex items-center gap-5 relative z-10">
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0"
              >
                <Icons.Brain size={28} className="text-white" />
              </motion.div>
              <div>
                <h3
                  className="text-xl font-extrabold text-white mb-1"
                  style={{ fontFamily: "'Syne', sans-serif" }}
                >
                  Ready for your next challenge?
                </h3>
                <p className="text-white/75 text-sm">
                  Practice makes perfect — start a new interview session now.
                </p>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-white text-indigo-600 font-extrabold text-sm shadow-xl shadow-black/20 relative z-10 shrink-0 cursor-pointer border-0 hover:shadow-2xl transition-shadow"
              onClick={() => navigate("/jobs")}
            >
              <Icons.Target size={18} /> Start New Interview
            </motion.button>
          </motion.div>
        </div>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedInterview && (
          <motion.div
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-md z-50 flex items-center justify-center p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedInterview(null)}
          >
            <motion.div
              className="bg-white rounded-3xl p-9 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
              initial={{ opacity: 0, scale: 0.92, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 24 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {/* Modal Header */}
              <div className="flex justify-between items-start mb-7">
                <div>
                  <span
                    className="text-xs font-bold tracking-widest uppercase text-indigo-500 mb-2 block"
                    style={{ fontFamily: "'Roboto Mono', monospace" }}
                  >
                    Interview Details
                  </span>
                  <h2
                    className="text-xl font-extrabold text-slate-900"
                    style={{ fontFamily: "'Syne', sans-serif" }}
                  >
                    {selectedInterview.jobTitle || "Interview"}
                  </h2>
                  <div className="flex gap-4 mt-1.5 flex-wrap">
                    {[
                      {
                        Icon: Icons.Calendar,
                        v: formatDate(selectedInterview.createdAt),
                      },
                      {
                        Icon: Icons.Clock,
                        v: formatDuration(selectedInterview.duration),
                      },
                      {
                        Icon: Icons.User,
                        v: selectedInterview.companyName || "—",
                      },
                    ].map(({ Icon, v }, i) => (
                      <span
                        key={i}
                        className="flex items-center gap-1.5 text-xs text-slate-400"
                      >
                        <Icon size={12} /> {v}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4 shrink-0">
                  {selectedInterview.score != null && (
                    <ScoreRing score={selectedInterview.score} size={60} />
                  )}
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setSelectedInterview(null)}
                    className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors border-0 cursor-pointer"
                  >
                    <Icons.X size={14} />
                  </motion.button>
                </div>
              </div>

              {/* Skills used */}
              {selectedInterview.skills?.length > 0 && (
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Icons.Award size={16} className="text-indigo-500" />
                    <span className="font-bold text-slate-900 text-sm">
                      Skills Assessed
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedInterview.skills.map((s, i) => (
                      <motion.span
                        key={i}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.07 }}
                        className="px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold"
                      >
                        {s}
                      </motion.span>
                    ))}
                  </div>
                </div>
              )}

              {/* Strengths */}
              {selectedInterview.strengths && (
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Icons.Check size={16} className="text-green-500" />
                    <span className="font-bold text-slate-900 text-sm">
                      Strengths
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {selectedInterview.strengths}
                  </p>
                </div>
              )}

              {/* Improvements */}
              {selectedInterview.improvements && (
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Icons.Alert size={16} className="text-amber-500" />
                    <span className="font-bold text-slate-900 text-sm">
                      Areas to Improve
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {selectedInterview.improvements}
                  </p>
                </div>
              )}

              {/* AI Summary */}
              {selectedInterview.summary && (
                <div className="p-5 rounded-2xl bg-linear-to-br from-indigo-50 to-violet-50 border-2 border-indigo-100">
                  <div className="flex items-center gap-2 mb-2.5">
                    <Icons.Brain size={16} className="text-indigo-500" />
                    <span className="font-bold text-indigo-700 text-sm">
                      AI Summary
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {selectedInterview.summary}
                  </p>
                </div>
              )}

              {!selectedInterview.strengths &&
                !selectedInterview.improvements &&
                !selectedInterview.summary && (
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 text-center text-slate-400 text-sm">
                    No detailed feedback available for this interview.
                  </div>
                )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Dashboard;

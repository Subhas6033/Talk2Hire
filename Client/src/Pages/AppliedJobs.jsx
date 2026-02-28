import { useState, useRef } from "react";
import { motion, AnimatePresence, useInView } from "motion/react";

// ─── Tiny SVG Icon primitive ─────────────────────────────────────────────────
const Icon = ({
  d,
  size = 18,
  className = "",
  strokeWidth = 1.75,
  fill = "none",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={fill}
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

const Ic = {
  Briefcase: (p) => (
    <Icon
      {...p}
      d={[
        "M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16",
        "M2 9h20",
        "M22 20H2",
        "M2 9a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9z",
      ]}
    />
  ),
  MapPin: (p) => (
    <Icon
      {...p}
      d={[
        "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z",
        "M12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
      ]}
    />
  ),
  Clock: (p) => (
    <Icon
      {...p}
      d={["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M12 6v6l4 2"]}
    />
  ),
  DollarSign: (p) => (
    <Icon
      {...p}
      d={["M12 1v22", "M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"]}
    />
  ),
  Link: (p) => (
    <Icon
      {...p}
      d={[
        "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71",
        "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
      ]}
    />
  ),
  Plus: (p) => <Icon {...p} d={["M12 5v14", "M5 12h14"]} />,
  Search: (p) => (
    <Icon
      {...p}
      d={["M21 21l-4.35-4.35", "M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"]}
    />
  ),
  Filter: (p) => <Icon {...p} d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />,
  Star: (p) => (
    <Icon
      {...p}
      fill="currentColor"
      d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
    />
  ),
  ChevronRight: (p) => <Icon {...p} d="m9 18 6-6-6-6" />,
  ChevronDown: (p) => <Icon {...p} d="m6 9 6 6 6-6" />,
  X: (p) => <Icon {...p} d="M18 6 6 18M6 6l12 12" />,
  Building: (p) => (
    <Icon
      {...p}
      d={["M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M9 22V12h6v10"]}
    />
  ),
  Check: (p) => <Icon {...p} strokeWidth={2.5} d="M20 6 9 17l-5-5" />,
  Sparkle: (p) => (
    <Icon
      {...p}
      d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
    />
  ),
  Trash: (p) => (
    <Icon
      {...p}
      d={["M3 6h18", "M19 6l-1 14H6L5 6", "M8 6V4h8v2", "M10 11v6", "M14 11v6"]}
    />
  ),
  Bell: (p) => (
    <Icon
      {...p}
      d={[
        "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9",
        "M13.73 21a2 2 0 0 1-3.46 0",
      ]}
    />
  ),
  TrendingUp: (p) => <Icon {...p} d="m23 6-9.5 9.5-5-5L1 18" />,
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
  Eye: (p) => (
    <Icon
      {...p}
      d={[
        "M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z",
        "M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
      ]}
    />
  ),
  Send: (p) => (
    <Icon {...p} d={["M22 2L11 13", "M22 2L15 22l-4-9-9-4 20-7z"]} />
  ),
  AlertCircle: (p) => (
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
};

// ─── Status config ────────────────────────────────────────────────────────────
const STATUSES = [
  {
    key: "applied",
    label: "Applied",
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
    dot: "bg-blue-500",
    pill: "bg-blue-100 text-blue-700",
  },
  {
    key: "screening",
    label: "Screening",
    color: "text-violet-600",
    bg: "bg-violet-50",
    border: "border-violet-200",
    dot: "bg-violet-500",
    pill: "bg-violet-100 text-violet-700",
  },
  {
    key: "interviewing",
    label: "Interviewing",
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    dot: "bg-amber-500",
    pill: "bg-amber-100 text-amber-700",
  },
  {
    key: "offer",
    label: "Offer",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
    pill: "bg-emerald-100 text-emerald-700",
  },
  {
    key: "rejected",
    label: "Rejected",
    color: "text-rose-500",
    bg: "bg-rose-50",
    border: "border-rose-200",
    dot: "bg-rose-400",
    pill: "bg-rose-100 text-rose-600",
  },
];

const statusOf = (key) => STATUSES.find((s) => s.key === key) || STATUSES[0];

// ─── Sample data ──────────────────────────────────────────────────────────────
const INITIAL_JOBS = [
  {
    id: 1,
    company: "Stripe",
    role: "Senior Frontend Engineer",
    location: "San Francisco, CA",
    type: "Full-time",
    salary: "$160k–$200k",
    status: "interviewing",
    date: "Jan 28",
    logo: "S",
    logoColor: "bg-[#635BFF]",
    starred: true,
    notes: "3rd round — system design",
    tags: ["React", "TypeScript"],
  },
  {
    id: 2,
    company: "Linear",
    role: "Product Engineer",
    location: "Remote",
    type: "Full-time",
    salary: "$140k–$170k",
    status: "screening",
    date: "Feb 01",
    logo: "L",
    logoColor: "bg-slate-900",
    starred: true,
    notes: "Async take-home received",
    tags: ["React", "GraphQL"],
  },
  {
    id: 3,
    company: "Vercel",
    role: "UI Engineer",
    location: "Remote",
    type: "Full-time",
    salary: "$130k–$160k",
    status: "applied",
    date: "Feb 05",
    logo: "V",
    logoColor: "bg-black",
    starred: false,
    notes: "",
    tags: ["Next.js", "CSS"],
  },
  {
    id: 4,
    company: "Figma",
    role: "Frontend Software Engineer",
    location: "New York, NY",
    type: "Full-time",
    salary: "$150k–$185k",
    status: "offer",
    date: "Jan 20",
    logo: "F",
    logoColor: "bg-[#F24E1E]",
    starred: true,
    notes: "Offer expires Feb 20",
    tags: ["React", "WebGL"],
  },
  {
    id: 5,
    company: "Notion",
    role: "Software Engineer, Web",
    location: "San Francisco, CA",
    type: "Full-time",
    salary: "$140k–$165k",
    status: "rejected",
    date: "Jan 15",
    logo: "N",
    logoColor: "bg-slate-800",
    starred: false,
    notes: "Went with another candidate",
    tags: ["React"],
  },
  {
    id: 6,
    company: "Loom",
    role: "React Native Developer",
    location: "Remote",
    type: "Contract",
    salary: "$95/hr",
    status: "applied",
    date: "Feb 06",
    logo: "L",
    logoColor: "bg-[#625DF5]",
    starred: false,
    notes: "",
    tags: ["React Native"],
  },
  {
    id: 7,
    company: "Retool",
    role: "Staff Frontend Engineer",
    location: "San Francisco, CA",
    type: "Full-time",
    salary: "$170k–$210k",
    status: "screening",
    date: "Feb 02",
    logo: "R",
    logoColor: "bg-[#3D5AFE]",
    starred: true,
    notes: "Recruiter call Feb 10",
    tags: ["React", "TypeScript", "SQL"],
  },
  {
    id: 8,
    company: "Craft.io",
    role: "Frontend Developer",
    location: "Remote",
    type: "Full-time",
    salary: "$100k–$130k",
    status: "applied",
    date: "Feb 07",
    logo: "C",
    logoColor: "bg-teal-600",
    starred: false,
    notes: "",
    tags: ["Vue", "TypeScript"],
  },
];

// ─── Logo avatar ──────────────────────────────────────────────────────────────
const CompanyLogo = ({ logo, logoColor, size = "w-11 h-11" }) => (
  <div
    className={`${size} ${logoColor} rounded-2xl flex items-center justify-center text-white font-black text-lg shrink-0 shadow-sm`}
    style={{ fontFamily: "'Fraunces', serif" }}
  >
    {logo}
  </div>
);

// ─── Status pill ──────────────────────────────────────────────────────────────
const StatusPill = ({ statusKey }) => {
  const s = statusOf(statusKey);
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.pill}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
};

// ─── Job Card ─────────────────────────────────────────────────────────────────
const JobCard = ({ job, index, onSelect, onStar, onDelete }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{
        duration: 0.45,
        delay: index * 0.06,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{ y: -2, boxShadow: "0 12px 40px rgba(0,0,0,0.09)" }}
      onClick={() => onSelect(job)}
      className="bg-white rounded-2xl border border-slate-100 p-5 cursor-pointer group relative overflow-hidden transition-shadow"
    >
      {/* Subtle left accent line */}
      <div
        className={`absolute left-0 top-4 bottom-4 w-0.5 rounded-full ${statusOf(job.status).dot}`}
      />

      <div className="flex items-start gap-4">
        <CompanyLogo logo={job.logo} logoColor={job.logoColor} />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3
                className="font-bold text-slate-900 text-sm leading-snug truncate"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                {job.role}
              </h3>
              <p className="text-slate-500 text-xs font-semibold mt-0.5">
                {job.company}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onStar(job.id);
                }}
                className={`p-1.5 rounded-lg transition-colors ${job.starred ? "text-amber-400" : "text-slate-200 hover:text-slate-300"}`}
              >
                <Ic.Star size={13} />
              </motion.button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 mt-2.5">
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Ic.MapPin size={11} /> {job.location}
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Ic.DollarSign size={11} /> {job.salary}
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Ic.Calendar size={11} /> {job.date}
            </span>
          </div>

          <div className="flex items-center justify-between mt-3 gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <StatusPill statusKey={job.status} />
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs font-medium">
                {job.type}
              </span>
            </div>
            {job.notes && (
              <p className="text-xs text-slate-400 italic truncate max-w-35">
                "{job.notes}"
              </p>
            )}
          </div>

          {job.tags.length > 0 && (
            <div className="flex gap-1.5 mt-2.5 flex-wrap">
              {job.tags.map((t) => (
                <span
                  key={t}
                  className="px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-slate-500 text-xs font-medium"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete button on hover */}
      <motion.button
        initial={{ opacity: 0 }}
        whileHover={{ opacity: 1 }}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg bg-rose-50 text-rose-400 hover:bg-rose-100"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(job.id);
        }}
      >
        <Ic.Trash size={12} />
      </motion.button>
    </motion.div>
  );
};

// ─── Pipeline step ────────────────────────────────────────────────────────────
const PipelineStep = ({ status, count, total, isActive, onClick }) => {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`flex-1 flex flex-col items-center gap-1.5 px-3 py-3 rounded-2xl transition-all border-2 ${
        isActive
          ? `${status.bg} ${status.border}`
          : "bg-white border-slate-100 hover:border-slate-200"
      }`}
    >
      <span
        className={`text-2xl font-black ${isActive ? status.color : "text-slate-700"}`}
        style={{ fontFamily: "'Fraunces', serif" }}
      >
        {count}
      </span>
      <span
        className={`text-xs font-bold ${isActive ? status.color : "text-slate-400"}`}
      >
        {status.label}
      </span>
      <div className="w-full h-1 rounded-full bg-slate-100 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
          className={`h-full rounded-full ${status.dot}`}
        />
      </div>
    </motion.button>
  );
};

// ─── Detail Modal ─────────────────────────────────────────────────────────────
const DetailModal = ({ job, onClose, onStatusChange, onStar }) => {
  const s = statusOf(job.status);
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/20 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
        initial={{ opacity: 0, scale: 0.93, y: 28 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.93, y: 28 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header band */}
        <div className={`${s.bg} px-8 pt-7 pb-5 border-b ${s.border}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <CompanyLogo
                logo={job.logo}
                logoColor={job.logoColor}
                size="w-14 h-14"
              />
              <div>
                <h2
                  className="text-xl font-black text-slate-900"
                  style={{ fontFamily: "'Fraunces', serif" }}
                >
                  {job.role}
                </h2>
                <p className="text-sm font-semibold text-slate-500 mt-0.5">
                  {job.company}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={() => onStar(job.id)}
                className={`p-2 rounded-xl transition-colors ${job.starred ? "text-amber-400 bg-amber-50" : "text-slate-300 bg-white"}`}
              >
                <Ic.Star size={16} />
              </motion.button>
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-white text-slate-400 hover:text-slate-600 transition-colors"
              >
                <Ic.X size={16} />
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mt-4">
            {[
              { Icon: Ic.MapPin, v: job.location },
              { Icon: Ic.Briefcase, v: job.type },
              { Icon: Ic.DollarSign, v: job.salary },
              { Icon: Ic.Calendar, v: `Applied ${job.date}` },
            ].map(({ Icon, v }, i) => (
              <span
                key={i}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-white/70 px-2.5 py-1 rounded-full"
              >
                <Icon size={11} /> {v}
              </span>
            ))}
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* Status changer */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
              Update Status
            </p>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((st) => (
                <motion.button
                  key={st.key}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onStatusChange(job.id, st.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all ${
                    job.status === st.key
                      ? `${st.bg} ${st.border} ${st.color}`
                      : "bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-200"
                  }`}
                >
                  {job.status === st.key && <Ic.Check size={11} />}
                  {st.label}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
              Tech Stack
            </p>
            <div className="flex flex-wrap gap-2">
              {job.tags.map((t) => (
                <span
                  key={t}
                  className="px-3 py-1 rounded-xl bg-slate-100 text-slate-600 text-xs font-semibold"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Notes */}
          {job.notes && (
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                Notes
              </p>
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100">
                <p className="text-sm text-amber-800 leading-relaxed">
                  {job.notes}
                </p>
              </div>
            </div>
          )}

          {/* Action row */}
          <div className="flex gap-2.5 pt-1">
            <button className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-colors">
              <Ic.Send size={14} /> Follow Up
            </button>
            <button className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-100 text-slate-600 text-sm font-bold hover:bg-slate-200 transition-colors">
              <Ic.Link size={14} /> Open JD
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─── Add Job Modal ────────────────────────────────────────────────────────────
const AddJobModal = ({ onClose, onAdd }) => {
  const [form, setForm] = useState({
    company: "",
    role: "",
    location: "Remote",
    salary: "",
    type: "Full-time",
    status: "applied",
    tags: "",
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = () => {
    if (!form.company || !form.role) return;
    onAdd({
      id: Date.now(),
      ...form,
      tags: form.tags
        ? form.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
      date: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      logo: form.company[0].toUpperCase(),
      logoColor: [
        "bg-indigo-600",
        "bg-teal-600",
        "bg-rose-600",
        "bg-amber-600",
        "bg-blue-700",
        "bg-slate-800",
      ][Math.floor(Math.random() * 6)],
      starred: false,
      notes: "",
    });
    onClose();
  };

  const inputCls =
    "w-full px-4 py-2.5 rounded-xl border-2 border-slate-100 bg-slate-50 text-sm text-slate-800 font-medium placeholder-slate-300 focus:outline-none focus:border-indigo-300 focus:bg-white transition-colors";
  const labelCls =
    "block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5";

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/20 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
        initial={{ opacity: 0, scale: 0.93, y: 28 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.93, y: 28 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-8 pt-7 pb-5 border-b border-slate-100 flex items-center justify-between">
          <h2
            className="text-xl font-black text-slate-900"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            Track New Job
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Ic.X size={16} />
          </button>
        </div>

        <div className="px-8 py-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Company *</label>
              <input
                className={inputCls}
                placeholder="Stripe"
                value={form.company}
                onChange={(e) => set("company", e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Role *</label>
              <input
                className={inputCls}
                placeholder="Senior Engineer"
                value={form.role}
                onChange={(e) => set("role", e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Location</label>
              <input
                className={inputCls}
                placeholder="Remote"
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Salary</label>
              <input
                className={inputCls}
                placeholder="$120k–$150k"
                value={form.salary}
                onChange={(e) => set("salary", e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Type</label>
              <select
                className={inputCls}
                value={form.type}
                onChange={(e) => set("type", e.target.value)}
              >
                {["Full-time", "Part-time", "Contract", "Freelance"].map(
                  (t) => (
                    <option key={t}>{t}</option>
                  ),
                )}
              </select>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select
                className={inputCls}
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
              >
                {STATUSES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>
              Tech Tags{" "}
              <span className="normal-case font-normal">(comma separated)</span>
            </label>
            <input
              className={inputCls}
              placeholder="React, TypeScript, Node.js"
              value={form.tags}
              onChange={(e) => set("tags", e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSubmit}
              className="flex-1 py-3 rounded-2xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-colors"
            >
              Add Job
            </button>
            <button
              onClick={onClose}
              className="px-5 py-3 rounded-2xl bg-slate-100 text-slate-500 text-sm font-bold hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const AppliedJobs = () => {
  const [jobs, setJobs] = useState(INITIAL_JOBS);
  const [selectedJob, setSelectedJob] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("date");

  const updateStatus = (id, status) => {
    setJobs((j) => j.map((job) => (job.id === id ? { ...job, status } : job)));
    if (selectedJob?.id === id) setSelectedJob((j) => ({ ...j, status }));
  };
  const toggleStar = (id) => {
    setJobs((j) =>
      j.map((job) => (job.id === id ? { ...job, starred: !job.starred } : job)),
    );
    if (selectedJob?.id === id)
      setSelectedJob((j) => ({ ...j, starred: !j.starred }));
  };
  const deleteJob = (id) => {
    setJobs((j) => j.filter((job) => job.id !== id));
    if (selectedJob?.id === id) setSelectedJob(null);
  };
  const addJob = (job) => setJobs((j) => [job, ...j]);

  const counts = STATUSES.reduce((acc, s) => {
    acc[s.key] = jobs.filter((j) => j.status === s.key).length;
    return acc;
  }, {});

  const filtered = jobs
    .filter((j) => activeFilter === "all" || j.status === activeFilter)
    .filter(
      (j) =>
        !searchQuery ||
        [j.company, j.role, j.location, ...j.tags].some((v) =>
          v.toLowerCase().includes(searchQuery.toLowerCase()),
        ),
    )
    .sort((a, b) => {
      if (sortBy === "starred")
        return (b.starred ? 1 : 0) - (a.starred ? 1 : 0);
      if (sortBy === "company") return a.company.localeCompare(b.company);
      return 0; // date = insertion order
    });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,700;0,9..144,900;1,9..144,400&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        select { appearance: none; }
      `}</style>

      <div
        className="min-h-screen bg-[#F7F6F3]"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        {/* ── Sidebar-style top header ── */}
        <div className="bg-white border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-6 py-5">
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex items-center justify-between flex-wrap gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-slate-900 flex items-center justify-center shadow-md">
                  <Ic.Briefcase size={16} className="text-white" />
                </div>
                <div>
                  <h1
                    className="text-xl font-black text-slate-900"
                    style={{ fontFamily: "'Fraunces', serif" }}
                  >
                    Job Tracker
                  </h1>
                  <p className="text-xs text-slate-400 font-medium">
                    {jobs.length} applications tracked
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <Ic.Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300"
                  />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search jobs…"
                    className="pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 border-2 border-slate-100 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:border-indigo-200 w-52 transition-colors"
                  />
                </div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-2.5 rounded-xl bg-slate-50 border-2 border-slate-100 text-sm font-semibold text-slate-500 focus:outline-none focus:border-indigo-200 transition-colors cursor-pointer"
                >
                  <option value="date">Latest</option>
                  <option value="starred">Starred</option>
                  <option value="company">A–Z</option>
                </select>
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold shadow-md hover:bg-slate-800 transition-colors"
                >
                  <Ic.Plus size={15} /> Track Job
                </motion.button>
              </div>
            </motion.div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8 space-y-7">
          {/* ── Pipeline strip ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className="flex items-center gap-1.5 mb-3">
              <Ic.TrendingUp size={14} className="text-slate-400" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Pipeline Overview
              </span>
            </div>
            <div className="flex gap-2">
              <motion.button
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setActiveFilter("all")}
                className={`flex-none flex flex-col items-center gap-1 px-5 py-3 rounded-2xl border-2 transition-all ${
                  activeFilter === "all"
                    ? "bg-slate-900 border-slate-900 text-white"
                    : "bg-white border-slate-100 text-slate-500 hover:border-slate-200"
                }`}
              >
                <span
                  className="text-2xl font-black"
                  style={{ fontFamily: "'Fraunces', serif" }}
                >
                  {jobs.length}
                </span>
                <span className="text-xs font-bold">All</span>
              </motion.button>
              {STATUSES.map((s) => (
                <PipelineStep
                  key={s.key}
                  status={s}
                  count={counts[s.key] || 0}
                  total={jobs.length}
                  isActive={activeFilter === s.key}
                  onClick={() =>
                    setActiveFilter((f) => (f === s.key ? "all" : s.key))
                  }
                />
              ))}
            </div>
          </motion.div>

          {/* ── Active filter label ── */}
          <AnimatePresence>
            {activeFilter !== "all" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl ${statusOf(activeFilter).bg} ${statusOf(activeFilter).border} border w-fit`}
                >
                  <span
                    className={`text-sm font-bold ${statusOf(activeFilter).color}`}
                  >
                    Showing: {statusOf(activeFilter).label}
                  </span>
                  <button
                    onClick={() => setActiveFilter("all")}
                    className={`${statusOf(activeFilter).color} opacity-60 hover:opacity-100`}
                  >
                    <Ic.X size={13} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Job grid ── */}
          {filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-24 text-center"
            >
              <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center mb-4">
                <Ic.Briefcase size={28} className="text-slate-300" />
              </div>
              <h3
                className="text-lg font-black text-slate-400"
                style={{ fontFamily: "'Fraunces', serif" }}
              >
                No jobs found
              </h3>
              <p className="text-sm text-slate-300 mt-1">
                Try adjusting your filters or add a new application.
              </p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((job, i) => (
                <JobCard
                  key={job.id}
                  job={job}
                  index={i}
                  onSelect={setSelectedJob}
                  onStar={toggleStar}
                  onDelete={deleteJob}
                />
              ))}
            </div>
          )}

          {/* ── Footer stats row ── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex items-center gap-4 pt-2 flex-wrap"
          >
            {[
              {
                Icon: Ic.Award,
                label: "Offer rate",
                value: `${jobs.length ? Math.round(((counts.offer || 0) / jobs.length) * 100) : 0}%`,
                color: "text-emerald-500",
              },
              {
                Icon: Ic.Bell,
                label: "Active",
                value: `${(counts.screening || 0) + (counts.interviewing || 0)}`,
                color: "text-violet-500",
              },
              {
                Icon: Ic.Star,
                label: "Starred",
                value: `${jobs.filter((j) => j.starred).length}`,
                color: "text-amber-400",
              },
              {
                Icon: Ic.AlertCircle,
                label: "Rejected",
                value: `${counts.rejected || 0}`,
                color: "text-rose-400",
              },
            ].map(({ Icon, label, value, color }, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl border border-slate-100 text-sm"
              >
                <Icon size={14} className={color} />
                <span className="text-slate-400 font-medium">{label}</span>
                <span
                  className={`font-black ${color}`}
                  style={{ fontFamily: "'Fraunces', serif" }}
                >
                  {value}
                </span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {selectedJob && (
          <DetailModal
            job={selectedJob}
            onClose={() => setSelectedJob(null)}
            onStatusChange={updateStatus}
            onStar={toggleStar}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showAddModal && (
          <AddJobModal onClose={() => setShowAddModal(false)} onAdd={addJob} />
        )}
      </AnimatePresence>
    </>
  );
};

export default AppliedJobs;

import { useState, useRef } from "react";
import { motion, AnimatePresence, useInView } from "motion/react";

// ─── Icon primitive ───────────────────────────────────────────────────────────
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
  Bookmark: (p) => (
    <Icon {...p} d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  ),
  BookmarkFill: (p) => (
    <Icon
      {...p}
      fill="currentColor"
      strokeWidth={0}
      d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
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
  Search: (p) => (
    <Icon
      {...p}
      d={["M21 21l-4.35-4.35", "M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"]}
    />
  ),
  Filter: (p) => <Icon {...p} d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />,
  X: (p) => <Icon {...p} d="M18 6 6 18M6 6l12 12" />,
  ChevronDown: (p) => <Icon {...p} d="m6 9 6 6 6-6" />,
  Send: (p) => (
    <Icon {...p} d={["M22 2L11 13", "M22 2L15 22l-4-9-9-4 20-7z"]} />
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
  Sparkles: (p) => (
    <Icon
      {...p}
      d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
    />
  ),
  Building: (p) => (
    <Icon
      {...p}
      d={["M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M9 22V12h6v10"]}
    />
  ),
  Grid: (p) => (
    <Icon
      {...p}
      d={["M3 3h7v7H3z", "M14 3h7v7h-7z", "M14 14h7v7h-7z", "M3 14h7v7H3z"]}
    />
  ),
  List: (p) => (
    <Icon
      {...p}
      d={[
        "M8 6h13",
        "M8 12h13",
        "M8 18h13",
        "M3 6h.01",
        "M3 12h.01",
        "M3 18h.01",
      ]}
    />
  ),
  TrendingUp: (p) => <Icon {...p} d="m23 6-9.5 9.5-5-5L1 18" />,
  Award: (p) => (
    <Icon
      {...p}
      d={[
        "M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14z",
        "M8.21 13.89 7 23l5-3 5 3-1.21-9.12",
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
  Zap: (p) => <Icon {...p} d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />,
  Check: (p) => <Icon {...p} strokeWidth={2.5} d="M20 6 9 17l-5-5" />,
  ArrowRight: (p) => <Icon {...p} d={["M5 12h14", "M12 5l7 7-7 7"]} />,
  Users: (p) => (
    <Icon
      {...p}
      d={[
        "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2",
        "M23 21v-2a4 4 0 0 0-3-3.87",
        "M16 3.13a4 4 0 0 1 0 7.75",
        "M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
      ]}
    />
  ),
};

// ─── Data ─────────────────────────────────────────────────────────────────────
const JOBS = [
  {
    id: 1,
    company: "Stripe",
    role: "Senior Frontend Engineer",
    location: "San Francisco, CA",
    type: "Full-time",
    salary: "$160k–$200k",
    remote: true,
    logo: "S",
    logoColor: "from-[#635BFF] to-[#7B73FF]",
    savedDate: "2 days ago",
    match: 97,
    applicants: "142",
    tags: ["React", "TypeScript", "GraphQL"],
    desc: "Build and maintain Stripe's web infrastructure. Work on high-impact, user-facing products.",
  },
  {
    id: 2,
    company: "Linear",
    role: "Product Engineer",
    location: "Remote",
    type: "Full-time",
    salary: "$140k–$170k",
    remote: true,
    logo: "L",
    logoColor: "from-slate-800 to-slate-700",
    savedDate: "3 days ago",
    match: 92,
    applicants: "89",
    tags: ["React", "GraphQL", "Electron"],
    desc: "Shape the future of project management tools. Work closely with design and ship fast.",
  },
  {
    id: 3,
    company: "Vercel",
    role: "UI Engineer",
    location: "Remote",
    type: "Full-time",
    salary: "$130k–$160k",
    remote: true,
    logo: "V",
    logoColor: "from-black to-slate-800",
    savedDate: "4 days ago",
    match: 88,
    applicants: "203",
    tags: ["Next.js", "CSS", "TypeScript"],
    desc: "Design and implement beautiful, performant UI components used by millions of developers.",
  },
  {
    id: 4,
    company: "Figma",
    role: "Frontend Software Engineer",
    location: "New York, NY",
    type: "Full-time",
    salary: "$150k–$185k",
    remote: false,
    logo: "F",
    logoColor: "from-[#F24E1E] to-[#FF7262]",
    savedDate: "5 days ago",
    match: 85,
    applicants: "317",
    tags: ["React", "WebGL", "Canvas"],
    desc: "Work on Figma's core canvas engine and plugin ecosystem powering modern design workflows.",
  },
  {
    id: 5,
    company: "Retool",
    role: "Staff Frontend Engineer",
    location: "San Francisco, CA",
    type: "Full-time",
    salary: "$170k–$210k",
    remote: true,
    logo: "R",
    logoColor: "from-[#3D5AFE] to-[#536DFE]",
    savedDate: "1 week ago",
    match: 82,
    applicants: "61",
    tags: ["React", "TypeScript", "SQL"],
    desc: "Lead frontend architecture for Retool's internal tools platform used by 100k+ companies.",
  },
  {
    id: 6,
    company: "Notion",
    role: "Software Engineer, Web",
    location: "San Francisco, CA",
    type: "Full-time",
    salary: "$140k–$165k",
    remote: false,
    logo: "N",
    logoColor: "from-slate-900 to-slate-700",
    savedDate: "1 week ago",
    match: 79,
    applicants: "445",
    tags: ["React", "TypeScript"],
    desc: "Build collaborative editing experiences for Notion's web app, serving millions of users.",
  },
  {
    id: 7,
    company: "Craft.io",
    role: "Frontend Developer",
    location: "Remote",
    type: "Full-time",
    salary: "$100k–$130k",
    remote: true,
    logo: "C",
    logoColor: "from-teal-600 to-teal-500",
    savedDate: "1 week ago",
    match: 74,
    applicants: "58",
    tags: ["Vue", "TypeScript"],
    desc: "Join Craft.io's frontend team and help build the next generation of product planning tools.",
  },
  {
    id: 8,
    company: "Loom",
    role: "React Native Developer",
    location: "Remote",
    type: "Contract",
    salary: "$95/hr",
    remote: true,
    logo: "L",
    logoColor: "from-[#625DF5] to-[#8B5CF6]",
    savedDate: "2 weeks ago",
    match: 71,
    applicants: "74",
    tags: ["React Native", "Mobile"],
    desc: "Build Loom's mobile apps, enabling async video communication for teams worldwide.",
  },
  {
    id: 9,
    company: "Planetscale",
    role: "Developer Advocate",
    location: "Remote",
    type: "Full-time",
    salary: "$120k–$145k",
    remote: true,
    logo: "P",
    logoColor: "from-rose-600 to-rose-500",
    savedDate: "2 weeks ago",
    match: 68,
    applicants: "39",
    tags: ["MySQL", "Next.js", "Writing"],
    desc: "Educate and inspire developers with content, demos, and community engagement.",
  },
];

const FILTERS = ["All", "Full-time", "Contract", "Remote", "On-site"];

// ─── Match badge ──────────────────────────────────────────────────────────────
const MatchBadge = ({ pct }) => {
  const color =
    pct >= 90
      ? "text-emerald-600 bg-emerald-50 border-emerald-200"
      : pct >= 75
        ? "text-blue-600 bg-blue-50 border-blue-200"
        : "text-slate-500 bg-slate-50 border-slate-200";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-bold ${color}`}
    >
      <Ic.Zap size={10} /> {pct}% match
    </span>
  );
};

// ─── Company logo ─────────────────────────────────────────────────────────────
const Logo = ({ logo, logoColor, size = "w-12 h-12", text = "text-xl" }) => (
  <div
    className={`${size} rounded-2xl bg-linear-to-br ${logoColor} flex items-center justify-center text-white font-black ${text} shrink-0 shadow-sm`}
    style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
  >
    {logo}
  </div>
);

// ─── Grid Card ────────────────────────────────────────────────────────────────
const GridCard = ({ job, index, onUnsave, onSelect }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-30px" });
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{
        duration: 0.5,
        delay: index * 0.07,
        ease: [0.22, 1, 0.36, 1],
      }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className="group relative bg-white rounded-3xl border border-slate-100 p-6 flex flex-col gap-5 cursor-pointer overflow-hidden"
      style={{
        boxShadow: hovered
          ? "0 16px 48px rgba(0,0,0,0.09)"
          : "0 2px 12px rgba(0,0,0,0.04)",
        transition: "box-shadow 0.3s ease, transform 0.2s ease",
        transform: hovered ? "translateY(-3px)" : "translateY(0)",
      }}
      onClick={() => onSelect(job)}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <Logo logo={job.logo} logoColor={job.logoColor} />
        <div className="flex items-center gap-1.5">
          <MatchBadge pct={job.match} />
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={(e) => {
              e.stopPropagation();
              onUnsave(job.id);
            }}
            className="p-2 rounded-xl text-indigo-400 hover:text-rose-400 hover:bg-rose-50 transition-all"
          >
            <Ic.BookmarkFill size={16} />
          </motion.button>
        </div>
      </div>

      {/* Role info */}
      <div className="flex-1">
        <h3
          className="font-bold text-slate-900 text-base leading-snug mb-1"
          style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
        >
          {job.role}
        </h3>
        <p className="text-sm font-semibold text-slate-500 mb-3">
          {job.company}
        </p>
        <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
          {job.desc}
        </p>
      </div>

      {/* Meta chips */}
      <div className="flex flex-wrap gap-1.5">
        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-100 text-xs font-medium text-slate-500">
          <Ic.MapPin size={10} /> {job.location}
        </span>
        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-100 text-xs font-medium text-slate-500">
          <Ic.DollarSign size={10} /> {job.salary}
        </span>
        {job.remote && (
          <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-xs font-semibold text-emerald-600">
            Remote
          </span>
        )}
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5">
        {job.tags.slice(0, 3).map((t) => (
          <span
            key={t}
            className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-semibold"
          >
            {t}
          </span>
        ))}
        {job.tags.length > 3 && (
          <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-400 text-xs font-semibold">
            +{job.tags.length - 3}
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-50">
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <Ic.Clock size={11} /> {job.savedDate}
          </span>
          <span className="flex items-center gap-1">
            <Ic.Users size={11} /> {job.applicants}
          </span>
        </div>
        <motion.div
          animate={{ x: hovered ? 3 : 0 }}
          className="flex items-center gap-1 text-xs font-bold text-indigo-500"
        >
          View <Ic.ArrowRight size={13} />
        </motion.div>
      </div>
    </motion.div>
  );
};

// ─── List Row ─────────────────────────────────────────────────────────────────
const ListRow = ({ job, index, onUnsave, onSelect }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-20px" });
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: -16 }}
      animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{
        duration: 0.45,
        delay: index * 0.05,
        ease: [0.22, 1, 0.36, 1],
      }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onClick={() => onSelect(job)}
      className={`group flex items-center gap-5 p-5 bg-white rounded-2xl border cursor-pointer transition-all ${
        hovered ? "border-indigo-200 shadow-md" : "border-slate-100 shadow-sm"
      }`}
    >
      <Logo
        logo={job.logo}
        logoColor={job.logoColor}
        size="w-11 h-11"
        text="text-lg"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3
            className="font-bold text-slate-900 text-sm truncate"
            style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
          >
            {job.role}
          </h3>
          <span className="text-slate-300 hidden sm:inline">·</span>
          <span className="text-sm font-semibold text-slate-500 hidden sm:inline">
            {job.company}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Ic.MapPin size={10} /> {job.location}
          </span>
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Ic.DollarSign size={10} /> {job.salary}
          </span>
          {job.remote && (
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              Remote
            </span>
          )}
        </div>
      </div>

      <div className="hidden md:flex items-center gap-1.5 flex-wrap">
        {job.tags.slice(0, 2).map((t) => (
          <span
            key={t}
            className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-semibold"
          >
            {t}
          </span>
        ))}
      </div>

      <div className="hidden sm:block">
        <MatchBadge pct={job.match} />
      </div>

      <div className="text-xs text-slate-400 hidden lg:block whitespace-nowrap">
        {job.savedDate}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={(e) => {
            e.stopPropagation();
            onUnsave(job.id);
          }}
          className="p-2 rounded-xl text-indigo-400 hover:text-rose-400 hover:bg-rose-50 transition-all"
        >
          <Ic.BookmarkFill size={15} />
        </motion.button>
        <motion.div animate={{ x: hovered ? 2 : 0 }} className="text-slate-300">
          <Ic.ArrowRight size={16} />
        </motion.div>
      </div>
    </motion.div>
  );
};

// ─── Detail Modal ─────────────────────────────────────────────────────────────
const DetailModal = ({ job, onClose, onUnsave }) => (
  <motion.div
    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6 bg-slate-900/20 backdrop-blur-md"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    onClick={onClose}
  >
    <motion.div
      className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
      initial={{ opacity: 0, y: 60 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 60 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Handle for mobile */}
      <div className="flex justify-center pt-3 pb-1 sm:hidden">
        <div className="w-10 h-1 rounded-full bg-slate-200" />
      </div>

      {/* Header */}
      <div className="px-7 pt-5 pb-6 border-b border-slate-100">
        <div className="flex items-start justify-between gap-3 mb-5">
          <Logo
            logo={job.logo}
            logoColor={job.logoColor}
            size="w-14 h-14"
            text="text-2xl"
          />
          <div className="flex items-center gap-2">
            <MatchBadge pct={job.match} />
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
            >
              <Ic.X size={16} />
            </button>
          </div>
        </div>
        <h2
          className="text-2xl font-black text-slate-900 leading-tight mb-1"
          style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
        >
          {job.role}
        </h2>
        <p className="text-base font-semibold text-slate-500">{job.company}</p>

        <div className="flex flex-wrap gap-2 mt-4">
          {[
            { Icon: Ic.MapPin, v: job.location },
            { Icon: Ic.Briefcase, v: job.type },
            { Icon: Ic.DollarSign, v: job.salary },
            { Icon: Ic.Clock, v: `Saved ${job.savedDate}` },
            { Icon: Ic.Users, v: `${job.applicants} applicants` },
          ].map(({ Icon, v }, i) => (
            <span
              key={i}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-full"
            >
              <Icon size={11} /> {v}
            </span>
          ))}
        </div>
      </div>

      <div className="px-7 py-6 space-y-6">
        {/* Description */}
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
            About the Role
          </p>
          <p className="text-sm text-slate-600 leading-relaxed">
            {job.desc} This is a unique opportunity to join a world-class team
            and make a significant impact on a product used by millions. You'll
            collaborate with talented engineers, designers, and product
            managers.
          </p>
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
                className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 text-sm font-semibold"
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Why it matches */}
        <div className="p-4 rounded-2xl bg-linear-to-br from-indigo-50 to-violet-50 border border-indigo-100">
          <div className="flex items-center gap-2 mb-2.5">
            <Ic.Sparkles size={14} className="text-indigo-500" />
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">
              Why it matches you
            </span>
          </div>
          <div className="space-y-2">
            {[
              "Your React & TypeScript skills align with requirements",
              "Remote-friendly matches your preferences",
              "Salary range fits your expectations",
            ].map((r, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-xs text-indigo-700"
              >
                <Ic.Check
                  size={12}
                  className="text-indigo-400 mt-0.5 shrink-0"
                />
                {r}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-colors shadow-sm">
            <Ic.Send size={14} /> Apply Now
          </button>
          <button className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-white border-2 border-slate-200 text-slate-600 text-sm font-bold hover:border-slate-300 hover:bg-slate-50 transition-colors">
            <Ic.Share size={14} />
          </button>
          <button
            onClick={() => {
              onUnsave(job.id);
              onClose();
            }}
            className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-white border-2 border-rose-200 text-rose-400 text-sm font-bold hover:bg-rose-50 transition-colors"
          >
            <Ic.Trash size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  </motion.div>
);

// ─── Empty state ──────────────────────────────────────────────────────────────
const EmptyState = () => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-col items-center justify-center py-32 text-center col-span-full"
  >
    <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center mb-5">
      <Ic.Bookmark size={32} className="text-slate-300" />
    </div>
    <h3
      className="text-xl font-black text-slate-400 mb-2"
      style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
    >
      No saved jobs
    </h3>
    <p className="text-sm text-slate-300 max-w-xs">
      Bookmark jobs you're interested in and they'll appear here for easy
      access.
    </p>
  </motion.div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────
const SavedJobs = () => {
  const [jobs, setJobs] = useState(JOBS);
  const [view, setView] = useState("grid");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [selectedJob, setSelectedJob] = useState(null);
  const [sortBy, setSortBy] = useState("match");

  const unsave = (id) => {
    setJobs((j) => j.filter((j) => j.id !== id));
    if (selectedJob?.id === id) setSelectedJob(null);
  };

  const filtered = jobs
    .filter((j) => {
      if (activeFilter === "Remote") return j.remote;
      if (activeFilter === "On-site") return !j.remote;
      if (activeFilter !== "All") return j.type === activeFilter;
      return true;
    })
    .filter(
      (j) =>
        !search ||
        [j.role, j.company, j.location, ...j.tags].some((v) =>
          v.toLowerCase().includes(search.toLowerCase()),
        ),
    )
    .sort((a, b) => {
      if (sortBy === "match") return b.match - a.match;
      if (sortBy === "recent") return 0;
      if (sortBy === "salary") return parseInt(b.salary) - parseInt(a.salary);
      return 0;
    });

  const remoteCount = jobs.filter((j) => j.remote).length;
  const avgMatch = jobs.length
    ? Math.round(jobs.reduce((s, j) => s + j.match, 0) / jobs.length)
    : 0;

  return (
    <>
      <title>Saved Jobs | Talk2Hire Careers Portal</title>

      {/* Description */}
      <meta
        name="description"
        content="View and manage your saved job opportunities on Talk2Hire. Track AI match scores, review job details, and apply quickly."
      />

      {/* Private Dashboard Page */}
      <meta name="robots" content="noindex, nofollow, noarchive" />

      {/* Canonical */}
      <link rel="canonical" href="https://talk2hire.com/saved" />

      {/* Theme Color */}
      <meta name="theme-color" content="#7C3AED" />

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Talk2Hire" />
      <meta property="og:title" content="Saved Jobs | Talk2Hire" />
      <meta
        property="og:description"
        content="Access your saved job listings, AI match scores, and application insights within Talk2Hire."
      />
      <meta property="og:url" content="https://talk2hire.com/saved" />
      <meta
        property="og:image"
        content="https://talk2hire.com/talk2hirelogo.png"
      />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="Saved Jobs | Talk2Hire" />
      <meta
        name="twitter:description"
        content="Track and manage your saved job opportunities with AI-powered insights."
      />
      <meta
        name="twitter:image"
        content="https://talk2hire.com/talk2hirelogo.png"
      />

      {/* Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "Talk2Hire Saved Jobs Dashboard",
          url: "https://talk2hire.com/saved",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          isPartOf: {
            "@type": "WebApplication",
            name: "Talk2Hire",
            url: "https://talk2hire.com/",
          },
          publisher: {
            "@type": "Organization",
            name: "QuantamHash Corporation",
            address: {
              "@type": "PostalAddress",
              streetAddress: "800 N King Street, Suite 304",
              addressLocality: "Wilmington",
              addressRegion: "DE",
              postalCode: "19801",
              addressCountry: "US",
            },
          },
          description:
            "Private dashboard page where users manage saved jobs, review AI match scores, and apply to opportunities within Talk2Hire.",
          featureList: [
            "View saved job listings",
            "AI-powered job match scoring",
            "Filter by remote or job type",
            "Search saved jobs",
            "Quick apply functionality",
          ],
        })}
      </script>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cabinet+Grotesk:wght@400;500;700;800;900&family=Satoshi:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        select { -webkit-appearance: none; appearance: none; }
        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      `}</style>

      <div
        className="min-h-screen bg-linear-to-b from-white to-slate-50/80"
        style={{ fontFamily: "'Satoshi', sans-serif" }}
      >
        {/* ══ Header ══ */}
        <div className="bg-white border-b border-slate-100 sticky top-0 z-40 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16 gap-4">
              {/* Brand */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="w-8 h-8 rounded-xl bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm shadow-indigo-200">
                  <Ic.Bookmark size={14} className="text-white" fill="white" />
                </div>
                <span
                  className="text-base font-black text-slate-900 hidden sm:block"
                  style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
                >
                  Saved Jobs
                </span>
              </div>

              {/* Search */}
              <div className="relative flex-1 max-w-xs sm:max-w-sm">
                <Ic.Search
                  size={14}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search saved jobs…"
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border-2 border-slate-100 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:border-indigo-200 focus:bg-white transition-all"
                />
                <AnimatePresence>
                  {search && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.7 }}
                      onClick={() => setSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                    >
                      <Ic.X size={13} />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>

              {/* Right controls */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="relative hidden sm:block">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="pl-3 pr-7 py-2 rounded-xl bg-slate-50 border-2 border-slate-100 text-sm font-semibold text-slate-500 focus:outline-none focus:border-indigo-200 cursor-pointer"
                  >
                    <option value="match">Best match</option>
                    <option value="recent">Most recent</option>
                    <option value="salary">Salary</option>
                  </select>
                  <Ic.ChevronDown
                    size={13}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />
                </div>
                <div className="flex items-center rounded-xl border-2 border-slate-100 bg-slate-50 p-1 gap-0.5">
                  {[
                    ["grid", Ic.Grid],
                    ["list", Ic.List],
                  ].map(([v, Comp]) => (
                    <button
                      key={v}
                      onClick={() => setView(v)}
                      className={`p-1.5 rounded-lg transition-all ${view === v ? "bg-white text-slate-700 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                    >
                      <Comp size={15} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          {/* ══ Hero stats row ══ */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  label: "Saved",
                  value: jobs.length,
                  Icon: Ic.Bookmark,
                  color: "text-indigo-600",
                  bg: "bg-indigo-50",
                  border: "border-indigo-100",
                },
                {
                  label: "Remote",
                  value: remoteCount,
                  Icon: Ic.Building,
                  color: "text-emerald-600",
                  bg: "bg-emerald-50",
                  border: "border-emerald-100",
                },
                {
                  label: "Avg Match",
                  value: `${avgMatch}%`,
                  Icon: Ic.Sparkles,
                  color: "text-violet-600",
                  bg: "bg-violet-50",
                  border: "border-violet-100",
                },
                {
                  label: "New Today",
                  value: 3,
                  Icon: Ic.Bell,
                  color: "text-amber-600",
                  bg: "bg-amber-50",
                  border: "border-amber-100",
                },
              ].map(({ label, value, Icon, color, bg, border }, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07, duration: 0.45 }}
                  className={`flex items-center gap-3 px-5 py-4 bg-white rounded-2xl border ${border} shadow-sm`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center shrink-0`}
                  >
                    <Icon size={16} className={color} />
                  </div>
                  <div>
                    <p
                      className="text-xl font-black text-slate-900 leading-none"
                      style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
                    >
                      {value}
                    </p>
                    <p className="text-xs font-semibold text-slate-400 mt-0.5">
                      {label}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* ══ Filter bar ══ */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-2 flex-wrap"
          >
            {FILTERS.map((f) => (
              <motion.button
                key={f}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveFilter(f)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border-2 ${
                  activeFilter === f
                    ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                    : "bg-white border-slate-100 text-slate-500 hover:border-slate-200 hover:text-slate-700"
                }`}
              >
                {f}
                {f !== "All" && (
                  <span
                    className={`ml-1.5 text-xs ${activeFilter === f ? "opacity-60" : "text-slate-400"}`}
                  >
                    {f === "Remote"
                      ? jobs.filter((j) => j.remote).length
                      : f === "On-site"
                        ? jobs.filter((j) => !j.remote).length
                        : jobs.filter((j) => j.type === f).length}
                  </span>
                )}
              </motion.button>
            ))}
            <span className="ml-auto text-xs font-semibold text-slate-400">
              {filtered.length} {filtered.length === 1 ? "job" : "jobs"}
            </span>
          </motion.div>

          {/* ══ Job listings ══ */}
          <AnimatePresence mode="wait">
            {filtered.length === 0 ? (
              <EmptyState key="empty" />
            ) : view === "grid" ? (
              <motion.div
                key="grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5"
              >
                {filtered.map((job, i) => (
                  <GridCard
                    key={job.id}
                    job={job}
                    index={i}
                    onUnsave={unsave}
                    onSelect={setSelectedJob}
                  />
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-3"
              >
                {filtered.map((job, i) => (
                  <ListRow
                    key={job.id}
                    job={job}
                    index={i}
                    onUnsave={unsave}
                    onSelect={setSelectedJob}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ══ Bottom CTA ══ */}
          {jobs.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="relative overflow-hidden rounded-3xl bg-slate-900 px-8 sm:px-12 py-10 flex flex-col sm:flex-row items-center justify-between gap-6"
            >
              {/* Decorative */}
              <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
              <div className="absolute right-24 -bottom-10 w-24 h-24 rounded-full bg-white/3 pointer-events-none" />
              <div className="absolute left-0 top-0 w-1 h-full bg-linear-to-b from-indigo-500 to-violet-600 rounded-full" />

              <div className="relative z-10 text-center sm:text-left">
                <div className="flex items-center gap-2 justify-center sm:justify-start mb-2">
                  <Ic.Sparkles size={14} className="text-indigo-400" />
                  <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">
                    AI Recommendation
                  </span>
                </div>
                <h3
                  className="text-xl sm:text-2xl font-black text-white mb-1"
                  style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
                >
                  You're a strong fit for {filtered[0]?.company || "Stripe"}
                </h3>
                <p className="text-slate-400 text-sm">
                  Your profile matches {filtered[0]?.match || 97}% of the
                  requirements. Apply before the deadline.
                </p>
              </div>
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                className="relative z-10 flex items-center gap-2.5 px-7 py-4 rounded-2xl bg-white text-slate-900 font-black text-sm shadow-xl hover:shadow-2xl transition-shadow shrink-0"
                style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
                onClick={() => setSelectedJob(filtered[0])}
              >
                <Ic.Zap size={16} /> Quick Apply
              </motion.button>
            </motion.div>
          )}
        </div>
      </div>

      {/* ══ Detail Modal ══ */}
      <AnimatePresence>
        {selectedJob && (
          <DetailModal
            key={selectedJob.id}
            job={selectedJob}
            onClose={() => setSelectedJob(null)}
            onUnsave={unsave}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default SavedJobs;

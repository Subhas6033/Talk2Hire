import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useInView } from "motion/react";
import { useSavedJobs } from "../Hooks/useJobHook";

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
  Award: (p) => (
    <Icon
      {...p}
      d={[
        "M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14z",
        "M8.21 13.89 7 23l5-3 5 3-1.21-9.12",
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
  ChevronLeft: (p) => <Icon {...p} d="m15 18-6-6 6-6" />,
  ChevronRight: (p) => <Icon {...p} d="m9 18 6-6-6-6" />,
};

const FILTERS = [
  "All",
  "Full-time",
  "Contract",
  "Part-time",
  "Remote",
  "On-site",
];

const typeColor = (type) => {
  if (!type) return "bg-slate-50 border-slate-100 text-slate-500";
  const t = type.toLowerCase();
  if (t.includes("remote"))
    return "bg-emerald-50 border-emerald-100 text-emerald-600";
  if (t.includes("full")) return "bg-blue-50 border-blue-100 text-blue-600";
  if (t.includes("contract"))
    return "bg-amber-50 border-amber-100 text-amber-600";
  if (t.includes("part"))
    return "bg-purple-50 border-purple-100 text-purple-600";
  return "bg-slate-50 border-slate-100 text-slate-500";
};

const logoLetter = (name) => (name ? name.charAt(0).toUpperCase() : "?");

const logoGradients = [
  "from-[#635BFF] to-[#7B73FF]",
  "from-slate-800 to-slate-700",
  "from-black to-slate-800",
  "from-[#F24E1E] to-[#FF7262]",
  "from-[#3D5AFE] to-[#536DFE]",
  "from-teal-600 to-teal-500",
  "from-rose-600 to-rose-500",
  "from-[#625DF5] to-[#8B5CF6]",
];

const getGradient = (name) => {
  if (!name) return logoGradients[0];
  const code = name.charCodeAt(0) % logoGradients.length;
  return logoGradients[code];
};

const Logo = ({
  companyName,
  companyLogo,
  size = "w-12 h-12",
  text = "text-xl",
}) => {
  if (companyLogo) {
    return (
      <div
        className={`${size} rounded-2xl overflow-hidden shrink-0 shadow-sm bg-white border border-slate-100 flex items-center justify-center`}
      >
        <img
          src={companyLogo}
          alt={companyName}
          className="w-full h-full object-contain p-1"
        />
      </div>
    );
  }
  return (
    <div
      className={`${size} rounded-2xl bg-linear-to-br ${getGradient(companyName)} flex items-center justify-center text-white font-black ${text} shrink-0 shadow-sm`}
      style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
    >
      {logoLetter(companyName)}
    </div>
  );
};

const SkeletonCard = () => (
  <div className="bg-white rounded-3xl border border-slate-100 p-6 flex flex-col gap-5 animate-pulse">
    <div className="flex items-start justify-between gap-3">
      <div className="w-12 h-12 rounded-2xl bg-slate-100" />
      <div className="w-20 h-6 rounded-full bg-slate-100" />
    </div>
    <div className="flex flex-col gap-2">
      <div className="h-4 bg-slate-100 rounded w-3/4" />
      <div className="h-3 bg-slate-100 rounded w-1/2" />
    </div>
    <div className="flex gap-2">
      <div className="h-6 w-24 rounded-full bg-slate-100" />
      <div className="h-6 w-20 rounded-full bg-slate-100" />
    </div>
  </div>
);

const GridCard = ({ job, index, onUnsave, onSelect }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-30px" });
  const [hovered, setHovered] = useState(false);
  const skills = Array.isArray(job.skills) ? job.skills : [];

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
      <div className="flex items-start justify-between gap-3">
        <Logo companyName={job.companyName} companyLogo={job.companyLogo} />
        <div className="flex items-center gap-1.5">
          {job.type && (
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-bold ${typeColor(job.type)}`}
            >
              {job.type}
            </span>
          )}
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

      <div className="flex-1">
        <h3
          className="font-bold text-slate-900 text-base leading-snug mb-1"
          style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
        >
          {job.title}
        </h3>
        <p className="text-sm font-semibold text-slate-500 mb-3">
          {job.companyName || "—"}
        </p>
        <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
          {job.description || ""}
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {job.location && (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-100 text-xs font-medium text-slate-500">
            <Ic.MapPin size={10} /> {job.location}
          </span>
        )}
        {job.salary && (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-100 text-xs font-medium text-slate-500">
            <Ic.DollarSign size={10} /> {job.salary}
          </span>
        )}
        {job.experience && (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-100 text-xs font-medium text-slate-500">
            <Ic.Award size={10} /> {job.experience}
          </span>
        )}
      </div>

      {skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {skills.slice(0, 3).map((t) => (
            <span
              key={t}
              className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-semibold"
            >
              {t}
            </span>
          ))}
          {skills.length > 3 && (
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-400 text-xs font-semibold">
              +{skills.length - 3}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-slate-50">
        <div className="flex items-center gap-3 text-xs text-slate-400">
          {job.department && (
            <span className="flex items-center gap-1">
              <Ic.Briefcase size={11} /> {job.department}
            </span>
          )}
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

const ListRow = ({ job, index, onUnsave, onSelect }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-20px" });
  const [hovered, setHovered] = useState(false);
  const skills = Array.isArray(job.skills) ? job.skills : [];

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
      className={`group flex items-center gap-4 p-4 sm:p-5 bg-white rounded-2xl border cursor-pointer transition-all ${hovered ? "border-indigo-200 shadow-md" : "border-slate-100 shadow-sm"}`}
    >
      <Logo
        companyName={job.companyName}
        companyLogo={job.companyLogo}
        size="w-11 h-11"
        text="text-lg"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <h3
            className="font-bold text-slate-900 text-sm truncate"
            style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
          >
            {job.title}
          </h3>
          {job.companyName && (
            <span className="text-slate-300 hidden sm:inline shrink-0">·</span>
          )}
          {job.companyName && (
            <span className="text-sm font-semibold text-slate-400 hidden sm:inline truncate shrink-0 max-w-30">
              {job.companyName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1.5 flex-nowrap overflow-hidden">
          {job.location && (
            <span className="text-xs text-slate-400 flex items-center gap-1 shrink-0">
              <Ic.MapPin size={10} />{" "}
              <span className="truncate max-w-20">{job.location}</span>
            </span>
          )}
          {job.salary && (
            <span className="text-xs text-slate-400 flex items-center gap-1 shrink-0">
              <Ic.DollarSign size={10} />{" "}
              <span className="truncate max-w-20">{job.salary}</span>
            </span>
          )}
          {job.experience && (
            <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap">
              {job.experience}
            </span>
          )}
        </div>
      </div>

      <div className="hidden lg:flex items-center gap-1.5 shrink-0">
        {skills.slice(0, 2).map((t) => (
          <span
            key={t}
            className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-semibold whitespace-nowrap"
          >
            {t}
          </span>
        ))}
        {skills.length > 2 && (
          <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-400 text-xs font-semibold">
            +{skills.length - 2}
          </span>
        )}
      </div>

      {job.type && (
        <div className="hidden sm:block shrink-0">
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-bold whitespace-nowrap ${typeColor(job.type)}`}
          >
            {job.type}
          </span>
        </div>
      )}

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

const DetailModal = ({ job, onClose, onUnsave }) => {
  const skills = Array.isArray(job.skills) ? job.skills : [];
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleApply = () => {
    window.location.href = `/interview?jobId=${job.id}`;
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/jobs/${job.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      if (navigator.share)
        navigator.share({
          title: job.title,
          text: `${job.title} at ${job.companyName}`,
          url,
        });
    }
  };

  const handleDelete = async () => {
    await onUnsave(job.id);
    onClose();
  };

  const meta = [
    job.location && { Icon: Ic.MapPin, label: "Location", v: job.location },
    job.type && { Icon: Ic.Briefcase, label: "Type", v: job.type },
    job.salary && { Icon: Ic.DollarSign, label: "Salary", v: job.salary },
    job.experience && {
      Icon: Ic.Award,
      label: "Experience",
      v: job.experience,
    },
    job.department && {
      Icon: Ic.Building,
      label: "Department",
      v: job.department,
    },
  ].filter(Boolean);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-white w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row"
        style={{ maxWidth: 1100, maxHeight: "78vh" }}
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 20 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Left sidebar ── */}
        <div className="md:w-64 shrink-0 bg-linear-to-b from-slate-900 to-indigo-950 p-6 flex flex-col gap-5 relative overflow-hidden">
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
          <div className="absolute bottom-16 -left-6 w-24 h-24 rounded-full bg-indigo-500/10 pointer-events-none" />

          {/* Logo + title */}
          <div className="relative z-10 flex flex-col gap-3">
            <Logo
              companyName={job.companyName}
              companyLogo={job.companyLogo}
              size="w-14 h-14"
              text="text-xl"
            />
            <div>
              <h2
                className="text-lg font-black text-white leading-snug"
                style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
              >
                {job.title}
              </h2>
              <p className="text-indigo-300 text-xs font-semibold mt-0.5">
                {job.companyName}
              </p>
            </div>
            {job.type && (
              <span
                className={`self-start inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-bold ${typeColor(job.type)}`}
              >
                {job.type}
              </span>
            )}
          </div>

          {/* Meta list */}
          <div className="relative z-10 flex flex-col gap-2.5 flex-1">
            {meta.map(({ Icon, v }, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center shrink-0">
                  <Icon size={11} className="text-slate-300" />
                </div>
                <span className="text-xs text-slate-300 font-medium truncate">
                  {v}
                </span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="relative z-10 flex flex-col gap-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleApply}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-bold transition-colors"
            >
              <Ic.Send size={13} /> Apply Now
            </motion.button>
            <div className="flex gap-2">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleShare}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors border border-white/10"
              >
                {copied ? (
                  <>
                    <Ic.Check size={12} /> Copied!
                  </>
                ) : (
                  <>
                    <Ic.Share size={12} /> Share
                  </>
                )}
              </motion.button>
              {!showDeleteConfirm ? (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-bold transition-colors border border-rose-500/20"
                >
                  <Ic.Trash size={12} /> Remove
                </motion.button>
              ) : (
                <motion.button
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  onClick={handleDelete}
                  className="flex-1 flex items-center justify-center py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold transition-colors"
                >
                  Confirm?
                </motion.button>
              )}
            </div>
          </div>
        </div>

        {/* ── Right content panel ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Header bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Job Details
            </span>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
            >
              <Ic.X size={14} />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {job.description && (
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                  About the Role
                </p>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {job.description}
                </p>
              </div>
            )}

            {skills.length > 0 && (
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                  Skills Required
                </p>
                <div className="flex flex-wrap gap-2">
                  {skills.map((t, i) => (
                    <motion.span
                      key={t}
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.04 }}
                      className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold"
                    >
                      {t}
                    </motion.span>
                  ))}
                </div>
              </div>
            )}

            <div className="p-4 rounded-xl bg-linear-to-br from-indigo-50 to-violet-50 border border-indigo-100">
              <div className="flex items-center gap-2 mb-1.5">
                <Ic.Sparkles size={12} className="text-indigo-500" />
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">
                  AI Interview Available
                </span>
              </div>
              <p className="text-xs text-indigo-700 leading-relaxed">
                Practice with an AI-powered mock interview for this role before
                applying.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

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

const SavedJobs = () => {
  const [view, setView] = useState("grid");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [selectedJob, setSelectedJob] = useState(null);
  const [sortBy, setSortBy] = useState("recent");
  const [localJobs, setLocalJobs] = useState([]);

  const {
    savedJobs,
    savedPagination,
    loadingList,
    loadSavedJobs,
    removeSavedJob,
  } = useSavedJobs();

  useEffect(() => {
    loadSavedJobs({ page: 1, limit: 50 });
  }, []);

  useEffect(() => {
    setLocalJobs(savedJobs);
  }, [savedJobs]);

  const unsave = async (id) => {
    setLocalJobs((prev) => prev.filter((j) => j.id !== id));
    if (selectedJob?.id === id) setSelectedJob(null);
    await removeSavedJob(id);
  };

  const filtered = localJobs
    .filter((j) => {
      if (activeFilter === "Remote")
        return (
          j.location?.toLowerCase().includes("remote") ||
          j.type?.toLowerCase().includes("remote")
        );
      if (activeFilter === "On-site")
        return (
          !j.location?.toLowerCase().includes("remote") &&
          !j.type?.toLowerCase().includes("remote")
        );
      if (activeFilter !== "All") return j.type === activeFilter;
      return true;
    })
    .filter(
      (j) =>
        !search ||
        [
          j.title,
          j.companyName,
          j.location,
          j.department,
          ...(Array.isArray(j.skills) ? j.skills : []),
        ]
          .filter(Boolean)
          .some((v) => v.toLowerCase().includes(search.toLowerCase())),
    )
    .sort((a, b) => {
      if (sortBy === "recent")
        return new Date(b.posted || 0) - new Date(a.posted || 0);
      if (sortBy === "title")
        return (a.title || "").localeCompare(b.title || "");
      return 0;
    });

  const remoteCount = localJobs.filter(
    (j) =>
      j.location?.toLowerCase().includes("remote") ||
      j.type?.toLowerCase().includes("remote"),
  ).length;

  const uniqueDepts = [
    ...new Set(localJobs.map((j) => j.department).filter(Boolean)),
  ].length;

  return (
    <>
      <title>Saved Jobs | Talk2Hire Careers Portal</title>
      <meta name="robots" content="noindex, nofollow, noarchive" />

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
        {/* Header */}
        <div className="bg-white border-b border-slate-100 sticky top-0 z-40 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16 gap-4">
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

              <div className="flex items-center gap-2 shrink-0">
                <div className="relative hidden sm:block">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="pl-3 pr-7 py-2 rounded-xl bg-slate-50 border-2 border-slate-100 text-sm font-semibold text-slate-500 focus:outline-none focus:border-indigo-200 cursor-pointer"
                  >
                    <option value="recent">Most recent</option>
                    <option value="title">Title A–Z</option>
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
          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  label: "Saved",
                  value: localJobs.length,
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
                  label: "Departments",
                  value: uniqueDepts,
                  Icon: Ic.Sparkles,
                  color: "text-violet-600",
                  bg: "bg-violet-50",
                  border: "border-violet-100",
                },
                {
                  label: "Showing",
                  value: filtered.length,
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
                      {loadingList ? "—" : value}
                    </p>
                    <p className="text-xs font-semibold text-slate-400 mt-0.5">
                      {label}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Filter bar */}
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
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border-2 ${activeFilter === f ? "bg-slate-900 border-slate-900 text-white shadow-sm" : "bg-white border-slate-100 text-slate-500 hover:border-slate-200 hover:text-slate-700"}`}
              >
                {f}
              </motion.button>
            ))}
            <span className="ml-auto text-xs font-semibold text-slate-400">
              {filtered.length} {filtered.length === 1 ? "job" : "jobs"}
            </span>
          </motion.div>

          {/* Job listings */}
          <AnimatePresence mode="wait">
            {loadingList ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : filtered.length === 0 ? (
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

          {/* Bottom CTA */}
          {filtered.length > 0 && filtered[0] && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="relative overflow-hidden rounded-3xl bg-slate-900 px-8 sm:px-12 py-10 flex flex-col sm:flex-row items-center justify-between gap-6"
            >
              <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
              <div className="absolute right-24 -bottom-10 w-24 h-24 rounded-full bg-white/3 pointer-events-none" />
              <div className="absolute left-0 top-0 w-1 h-full bg-linear-to-b from-indigo-500 to-violet-600 rounded-full" />

              <div className="relative z-10 text-center sm:text-left">
                <div className="flex items-center gap-2 justify-center sm:justify-start mb-2">
                  <Ic.Sparkles size={14} className="text-indigo-400" />
                  <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">
                    Top Pick
                  </span>
                </div>
                <h3
                  className="text-xl sm:text-2xl font-black text-white mb-1"
                  style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
                >
                  {filtered[0].title} at {filtered[0].companyName}
                </h3>
                <p className="text-slate-400 text-sm">
                  {filtered[0].location || "—"}
                  {filtered[0].type ? ` · ${filtered[0].type}` : ""}
                </p>
              </div>
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                className="relative z-10 flex items-center gap-2.5 px-7 py-4 rounded-2xl bg-white text-slate-900 font-black text-sm shadow-xl hover:shadow-2xl transition-shadow shrink-0"
                style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
                onClick={() => setSelectedJob(filtered[0])}
              >
                <Ic.Zap size={16} /> View Details
              </motion.button>
            </motion.div>
          )}
        </div>
      </div>

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

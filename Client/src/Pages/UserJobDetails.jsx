import {
  MapPin,
  Briefcase,
  Clock,
  DollarSign,
  GraduationCap,
  Tag,
  ArrowLeft,
  Building2,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  Users,
  BookOpen,
  Award,
} from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchJobById } from "../API/jobApi";

// ─── Responsive hook ──────────────────────────────────────────
const useBreakpoint = () => {
  const [width, setWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1200,
  );
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return {
    isMobile: width < 640,
    isTablet: width >= 640 && width < 1024,
    isDesktop: width >= 1024,
    width,
  };
};

// ─── Helpers ──────────────────────────────────────────────────
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

const timeAgo = (dateStr) => {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Posted today";
  if (days === 1) return "Posted yesterday";
  if (days < 7) return `Posted ${days}d ago`;
  if (days < 30) return `Posted ${Math.floor(days / 7)}w ago`;
  return `Posted ${Math.floor(days / 30)}mo ago`;
};

const PALETTES = [
  {
    bg: "linear-gradient(135deg,#4F46E5,#7C3AED)",
    shadow: "rgba(79,70,229,0.35)",
  },
  {
    bg: "linear-gradient(135deg,#0284C7,#0891B2)",
    shadow: "rgba(2,132,199,0.35)",
  },
  {
    bg: "linear-gradient(135deg,#16A34A,#059669)",
    shadow: "rgba(22,163,74,0.35)",
  },
  {
    bg: "linear-gradient(135deg,#EA580C,#D97706)",
    shadow: "rgba(234,88,12,0.35)",
  },
  {
    bg: "linear-gradient(135deg,#9333EA,#C026D3)",
    shadow: "rgba(147,51,234,0.35)",
  },
  {
    bg: "linear-gradient(135deg,#E11D48,#BE185D)",
    shadow: "rgba(225,29,72,0.35)",
  },
];

const getPalette = (name) => {
  if (!name || typeof name !== "string" || name.length === 0)
    return PALETTES[0];
  const code = name.charCodeAt(0);
  if (isNaN(code)) return PALETTES[0];
  return PALETTES[code % PALETTES.length] ?? PALETTES[0];
};

// Tailwind classes for type badge
const TYPE_STYLES = {
  "Full-time": {
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
  },
  "Part-time": {
    bg: "bg-blue-50",
    text: "text-blue-600",
    border: "border-blue-200",
  },
  Contract: {
    bg: "bg-amber-50",
    text: "text-amber-600",
    border: "border-amber-200",
  },
  Internship: {
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
  },
  Remote: {
    bg: "bg-teal-50",
    text: "text-teal-600",
    border: "border-teal-200",
  },
};
const TYPE_FALLBACK = {
  bg: "bg-gray-50",
  text: "text-gray-500",
  border: "border-gray-200",
};

// Hex accent for DetailRow (dynamic, must stay inline)
const TYPE_ACCENT_HEX = {
  "Full-time": "#15803D",
  "Part-time": "#2563EB",
  Contract: "#D97706",
  Internship: "#7C3AED",
  Remote: "#0D9488",
};

const getTypeSty = (raw) => {
  if (!raw) return TYPE_FALLBACK;
  const t = raw.trim();
  return (
    TYPE_STYLES[t] ??
    TYPE_STYLES[t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()] ??
    Object.entries(TYPE_STYLES).find(
      ([k]) => k.toLowerCase() === t.toLowerCase(),
    )?.[1] ??
    TYPE_FALLBACK
  );
};

const getTypeAccentHex = (raw) => {
  if (!raw) return "#6B7280";
  const t = raw.trim();
  return (
    TYPE_ACCENT_HEX[t] ??
    TYPE_ACCENT_HEX[t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()] ??
    Object.entries(TYPE_ACCENT_HEX).find(
      ([k]) => k.toLowerCase() === t.toLowerCase(),
    )?.[1] ??
    "#6B7280"
  );
};

// ─── useInView ────────────────────────────────────────────────
const useInView = (threshold = 0.1, once = true) => {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          if (once) obs.disconnect();
        }
      },
      { threshold },
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold, once]);
  return [ref, inView];
};

// ─── Reveal wrapper ───────────────────────────────────────────
const Reveal = ({ children, delay = 0 }) => {
  const [ref, inView] = useInView(0.08);
  return (
    <div
      ref={ref}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(18px)",
        transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
};

// ─── Section card ─────────────────────────────────────────────
const SectionCard = ({ title, icon: Icon, children, delay = 0 }) => (
  <Reveal delay={delay}>
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        {Icon && (
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
            <Icon size={15} color="#4F46E5" />
          </div>
        )}
        <h2
          className="font-bold text-gray-900 text-base m-0"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          {title}
        </h2>
      </div>
      {children}
    </div>
  </Reveal>
);

// ─── Prose renderer ───────────────────────────────────────────
const ProseContent = ({ text }) => {
  if (!text) return null;
  const lines = text.split("\n").filter(Boolean);
  const isBullet = (l) =>
    /^[-•*]\s/.test(l.trim()) || /^\d+\.\s/.test(l.trim());
  return (
    <div className="flex flex-col gap-1.5">
      {lines.map((line, i) => {
        const clean = line
          .trim()
          .replace(/^[-•*]\s/, "")
          .replace(/^\d+\.\s/, "");
        if (isBullet(line))
          return (
            <div key={i} className="flex gap-2.5 items-start">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 mt-2" />
              <p className="m-0 text-sm text-gray-700 leading-relaxed">
                {clean}
              </p>
            </div>
          );
        return (
          <p key={i} className="m-0 text-sm text-gray-700 leading-relaxed">
            {line}
          </p>
        );
      })}
    </div>
  );
};

// ─── Detail row ───────────────────────────────────────────────
const DetailRow = ({ label, value, accent }) => (
  <div className="flex items-center justify-between gap-3 py-2.5 border-b border-gray-100">
    <span className="text-xs text-gray-400 font-medium">{label}</span>
    <span
      className="text-xs font-semibold text-right"
      style={{ color: accent || "#374151" }}
    >
      {value}
    </span>
  </div>
);

// ─── Skeleton ─────────────────────────────────────────────────
const Skeleton = ({ w = "100%", h = 14, r = 8, mb = 0 }) => (
  <div
    style={{
      width: w,
      height: h,
      borderRadius: r,
      marginBottom: mb,
      background: "linear-gradient(90deg,#F3F4F6 25%,#E5E7EB 50%,#F3F4F6 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.6s infinite",
    }}
  />
);

const PageSkeleton = () => (
  <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
    <Skeleton w={100} h={14} r={6} mb={28} />
    <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-7 mb-6">
      <div className="flex gap-4 items-center mb-6 flex-wrap sm:flex-nowrap">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gray-100 shrink-0" />
        <div className="flex-1 min-w-0">
          <Skeleton w="55%" h={22} r={8} mb={10} />
          <Skeleton w="30%" h={14} r={6} />
        </div>
      </div>
      <div className="flex gap-3 flex-wrap">
        {[80, 100, 90, 70].map((w, i) => (
          <Skeleton key={i} w={w} h={24} r={99} />
        ))}
      </div>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 flex flex-col gap-5">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white border border-gray-200 rounded-2xl p-6"
          >
            <Skeleton w="30%" h={16} r={6} mb={16} />
            {[100, 90, 95, 80, 85].map((w, j) => (
              <Skeleton key={j} w={`${w}%`} h={12} r={6} mb={8} />
            ))}
          </div>
        ))}
      </div>
      <div className="hidden lg:flex flex-col gap-5">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="bg-white border border-gray-200 rounded-2xl p-6"
          >
            <Skeleton w="40%" h={16} r={6} mb={16} />
            <div className="flex flex-wrap gap-2">
              {[60, 80, 70, 90, 65].map((w, j) => (
                <Skeleton key={j} w={w} h={26} r={8} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ─── Apply button ─────────────────────────────────────────────
const ApplyButton = ({ onClick, fullWidth = false }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`inline-flex items-center justify-center gap-2 px-7 py-3 rounded-xl border-none text-white font-bold text-sm cursor-pointer relative overflow-hidden whitespace-nowrap ${fullWidth ? "w-full" : ""}`}
      style={{
        fontFamily: "'DM Sans', sans-serif",
        background: hovered
          ? "linear-gradient(135deg,#4338CA,#6D28D9)"
          : "linear-gradient(135deg,#4F46E5,#7C3AED)",
        boxShadow: hovered
          ? "0 8px 30px rgba(79,70,229,0.45)"
          : "0 4px 16px rgba(79,70,229,0.3)",
        transform: hovered
          ? "translateY(-2px) scale(1.02)"
          : "translateY(0) scale(1)",
        transition: "all 0.2s cubic-bezier(0.34,1.56,0.64,1)",
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(105deg,transparent 30%,rgba(255,255,255,0.15) 50%,transparent 70%)",
          transform: hovered ? "translateX(100%)" : "translateX(-100%)",
          transition: "transform 0.5s ease",
        }}
      />
      <Sparkles size={15} />
      Apply Now
      <ChevronRight
        size={15}
        style={{
          transition: "transform 0.2s",
          transform: hovered ? "translateX(3px)" : "translateX(0)",
        }}
      />
    </button>
  );
};

// ─── Sticky bottom bar ────────────────────────────────────────
const StickyApplyBar = ({ job, visible, onApply }) => {
  const { isMobile } = useBreakpoint();
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-gray-200 px-4 sm:px-6 py-3 sm:py-3.5"
      style={{
        boxShadow: "0 -8px 40px rgba(0,0,0,0.08)",
        transform: visible ? "translateY(0)" : "translateY(100%)",
        transition: "transform 0.35s cubic-bezier(0.34,1.56,0.64,1)",
      }}
    >
      <div
        className={`max-w-6xl mx-auto flex items-center gap-3 ${
          isMobile ? "flex-col justify-center" : "flex-row justify-between"
        }`}
      >
        {!isMobile && (
          <div>
            <p
              className="m-0 font-bold text-sm text-gray-900"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              {job?.title}
            </p>
            <p className="m-0 text-xs text-gray-400">
              {job?.companyName}
              {job?.location ? ` · ${job.location}` : ""}
            </p>
          </div>
        )}
        <ApplyButton onClick={onApply} fullWidth={isMobile} />
      </div>
    </div>
  );
};

// ─── Shared sidebar content ───────────────────────────────────
const SidebarContent = ({ job, skills, handleApply }) => (
  <div className="flex flex-col gap-5">
    {skills.length > 0 && (
      <SectionCard title="Required Skills" icon={Tag} delay={100}>
        <div className="flex flex-wrap gap-1.5">
          {skills.map((sk, i) => (
            <span
              key={sk}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-semibold bg-indigo-50 text-indigo-600 border border-indigo-200"
              style={{ animation: `fadeIn 0.3s ease ${100 + i * 40}ms both` }}
            >
              <Tag size={9} /> {sk}
            </span>
          ))}
        </div>
      </SectionCard>
    )}

    <SectionCard title="Job Details" icon={Briefcase} delay={160}>
      <div className="-mt-1">
        {job.department && (
          <DetailRow label="Department" value={job.department} />
        )}
        {job.type && (
          <DetailRow
            label="Type"
            value={job.type}
            accent={getTypeAccentHex(job.type)}
          />
        )}
        {job.experience && (
          <DetailRow label="Experience" value={job.experience} />
        )}
        {job.salary && (
          <DetailRow label="Salary" value={job.salary} accent="#059669" />
        )}
        {job.location && <DetailRow label="Location" value={job.location} />}
      </div>
    </SectionCard>

    <Reveal delay={220}>
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3 items-start">
        <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
          <Users size={16} color="#D97706" />
        </div>
        <div>
          <p className="m-0 mb-0.5 font-bold text-sm text-amber-900">
            AI-Powered Interview
          </p>
          <p className="m-0 text-xs text-amber-700 leading-relaxed">
            This position uses an automated AI interview. You'll receive
            feedback instantly after completion.
          </p>
        </div>
      </div>
    </Reveal>

    <Reveal delay={270}>
      <button
        onClick={handleApply}
        className="w-full py-3.5 rounded-xl border-none text-white font-bold text-sm cursor-pointer flex items-center justify-center gap-2 transition-all duration-200 hover:-translate-y-0.5"
        style={{
          background: "linear-gradient(135deg,#4F46E5,#7C3AED)",
          boxShadow: "0 4px 16px rgba(79,70,229,0.3)",
          fontFamily: "'DM Sans', sans-serif",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = "0 8px 28px rgba(79,70,229,0.4)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = "0 4px 16px rgba(79,70,229,0.3)";
        }}
      >
        <Sparkles size={15} /> Apply for this Position
      </button>
    </Reveal>
  </div>
);

// ─── Page ─────────────────────────────────────────────────────
const UserJobDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { selectedJob: job, loading, error } = useSelector((s) => s.jobs);
  const [mounted, setMounted] = useState(false);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const headerRef = useRef(null);
  const { isMobile, isTablet } = useBreakpoint();

  useEffect(() => {
    if (id) dispatch(fetchJobById(id));
  }, [id, dispatch]);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => setShowStickyBar(!e.isIntersecting),
      { threshold: 0, rootMargin: "-80px 0px 0px 0px" },
    );
    if (headerRef.current) obs.observe(headerRef.current);
    return () => obs.disconnect();
  }, [job]);

  const handleApply = () => navigate(`/interview?jobId=${job?.id}`);

  const isLoading =
    loading?.fetch ||
    loading?.fetchById ||
    (!error && (!job || (!job.id && !job.title)));

  if (isLoading)
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,700&family=DM+Sans:wght@400;500;600;700&display=swap');
          @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
          * { box-sizing: border-box; }
        `}</style>
        <div
          className="min-h-screen bg-gray-50"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          <PageSkeleton />
        </div>
      </>
    );

  if (error || !job || (!job.id && !job.title))
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,700&family=DM+Sans:wght@400;500;600&display=swap');
          * { box-sizing: border-box; }
        `}</style>
        <div
          className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3 px-4"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mb-1">
            <Building2 size={28} color="#DC2626" />
          </div>
          <p
            className="font-bold text-base text-gray-700 m-0 text-center"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            {error || "Job not found"}
          </p>
          <button
            onClick={() => navigate("/jobs")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 text-sm font-semibold cursor-pointer hover:bg-indigo-100 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Jobs
          </button>
        </div>
      </>
    );

  const skills = parseSkills(job.skills);
  const palette = getPalette(job.companyName);
  const typeSty = getTypeSty(job.type);
  const initials =
    (job.companyName || "CO")
      .split(" ")
      .filter(Boolean)
      .map((w) => w[0] || "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "CO";
  const postedText = timeAgo(job.posted);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,400&family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes popIn {
          0%   { opacity: 0; transform: scale(0.92) translateY(8px) }
          60%  { transform: scale(1.02) translateY(-2px) }
          100% { opacity: 1; transform: scale(1) translateY(0) }
        }
        ::-webkit-scrollbar { width: 6px }
        ::-webkit-scrollbar-track { background: #F9FAFB }
        ::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 99px }
      `}</style>

      <div
        className="min-h-screen bg-gray-50 pb-24"
        style={{
          fontFamily: "'DM Sans', sans-serif",
          opacity: mounted ? 1 : 0,
          transition: "opacity 0.35s",
        }}
      >
        {/* Bg decoration */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div
            className="absolute -top-24 -right-24 w-125 h-125 rounded-full"
            style={{
              background:
                "radial-gradient(circle,rgba(99,102,241,0.06) 0%,transparent 65%)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(rgba(0,0,0,0.018) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,0.018) 1px,transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />
        </div>

        {/* ─── Breadcrumb strip ─────────────────────────────────────────── */}
        <div
          className="sticky top-0 z-10 border-b border-black/6 px-4 sm:px-6"
          style={{
            background: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(16px)",
          }}
        >
          <div className="max-w-7xl mx-auto flex items-center h-14 gap-3">
            <button
              onClick={() => navigate("/jobs")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-transparent border border-gray-200 text-gray-500 text-sm font-semibold cursor-pointer transition-all duration-150 shrink-0 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600"
            >
              <ArrowLeft size={14} />
              <span className="hidden sm:inline">All Jobs</span>
            </button>
            <div className="flex items-center gap-1.5 text-gray-400 text-xs min-w-0">
              <ChevronRight size={13} className="shrink-0" />
              <span className="font-medium text-gray-700 truncate">
                {job.title}
              </span>
            </div>
          </div>
        </div>

        {/* ─── Main content ─────────────────────────────────────────────── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-8 relative z-10">
          {/* Hero card */}
          <div
            ref={headerRef}
            className="bg-white border border-gray-200 rounded-3xl mb-6 relative overflow-hidden"
            style={{
              padding: isMobile ? "20px 18px" : "28px 32px",
              boxShadow: "0 2px 16px rgba(0,0,0,0.05)",
              animation: "popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both",
            }}
          >
            {/* Top accent bar */}
            <div
              className="absolute top-0 left-0 right-0 h-1"
              style={{
                background: "linear-gradient(90deg,#4F46E5,#7C3AED,#06B6D4)",
              }}
            />

            {/* Title row */}
            <div
              className={`flex items-start justify-between gap-3 sm:gap-4 flex-wrap ${
                isMobile ? "flex-col" : "flex-row"
              }`}
            >
              <div className="flex items-start gap-3 sm:gap-4">
                {/* Company avatar */}
                <div
                  className="shrink-0 rounded-2xl flex items-center justify-center text-white font-extrabold"
                  style={{
                    width: isMobile ? 56 : 72,
                    height: isMobile ? 56 : 72,
                    background: palette.bg,
                    boxShadow: `0 6px 20px ${palette.shadow}`,
                    fontSize: isMobile ? 20 : 24,
                    fontFamily: "'Fraunces', serif",
                    letterSpacing: "0.02em",
                  }}
                >
                  {initials}
                </div>
                <div className="min-w-0">
                  <h1
                    className="font-bold text-gray-900 m-0 mb-1.5 leading-tight wrap-break-word"
                    style={{
                      fontFamily: "'Fraunces', serif",
                      fontSize: isMobile ? 18 : 24,
                    }}
                  >
                    {job.title}
                  </h1>
                  <p className="m-0 text-sm text-gray-500 flex items-center gap-1 font-medium">
                    <Building2 size={13} color="#9CA3AF" />
                    {job.companyName || "Company"}
                  </p>
                </div>
              </div>

              {/* Apply CTA — desktop */}
              {!isMobile && (
                <div className="flex items-center gap-2 shrink-0">
                  <ApplyButton onClick={handleApply} />
                </div>
              )}
            </div>

            {/* Apply CTA — mobile full width */}
            {isMobile && (
              <div className="mt-4">
                <ApplyButton onClick={handleApply} fullWidth />
              </div>
            )}

            {/* Meta badges */}
            <div className="flex flex-wrap gap-2 mt-6 pt-5 border-t border-gray-100">
              {job.type && (
                <span
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${typeSty.bg} ${typeSty.text} ${typeSty.border}`}
                >
                  <Briefcase size={11} /> {job.type}
                </span>
              )}
              {job.location && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200">
                  <MapPin size={11} color="#9CA3AF" /> {job.location}
                </span>
              )}
              {job.experience && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200">
                  <GraduationCap size={11} color="#9CA3AF" /> {job.experience}
                </span>
              )}
              {job.salary && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                  <DollarSign size={11} /> {job.salary}
                </span>
              )}
              {job.department && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200">
                  {job.department}
                </span>
              )}
              {postedText && (
                <span
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-400 border border-gray-200 ${
                    !isMobile ? "ml-auto" : ""
                  }`}
                >
                  <Clock size={11} /> {postedText}
                </span>
              )}
            </div>
          </div>

          {/* ─── Content grid ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left / Main column */}
            <div className="lg:col-span-2 flex flex-col gap-5">
              {job.description && (
                <SectionCard title="About the Role" icon={BookOpen} delay={80}>
                  <ProseContent text={job.description} />
                </SectionCard>
              )}
              {job.responsibilities && (
                <SectionCard
                  title="Responsibilities"
                  icon={CheckCircle2}
                  delay={140}
                >
                  <ProseContent text={job.responsibilities} />
                </SectionCard>
              )}
              {job.requirements && (
                <SectionCard title="Requirements" icon={Award} delay={200}>
                  <ProseContent text={job.requirements} />
                </SectionCard>
              )}

              {/* Sidebar shown inline on mobile & tablet */}
              <div className="lg:hidden">
                <SidebarContent
                  job={job}
                  skills={skills}
                  handleApply={handleApply}
                />
              </div>

              {/* CTA banner */}
              <Reveal delay={260}>
                <div
                  className={`rounded-2xl flex justify-between gap-4 flex-wrap relative overflow-hidden ${
                    isMobile ? "flex-col items-start" : "flex-row items-center"
                  }`}
                  style={{
                    background:
                      "linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%)",
                    padding: isMobile ? "22px 20px" : "28px 30px",
                    boxShadow: "0 8px 32px rgba(79,70,229,0.25)",
                  }}
                >
                  <div
                    className="absolute inset-0 opacity-[0.07]"
                    style={{
                      backgroundImage:
                        "radial-gradient(circle,#fff 1px,transparent 1px)",
                      backgroundSize: "20px 20px",
                    }}
                  />
                  <div className="relative">
                    <p
                      className="m-0 mb-1 font-bold text-lg text-white"
                      style={{ fontFamily: "'Fraunces', serif" }}
                    >
                      Ready to apply?
                    </p>
                    <p className="m-0 text-sm text-white/70">
                      Take the AI-powered interview for {job.title}
                    </p>
                  </div>
                  <button
                    onClick={handleApply}
                    className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white border-none text-indigo-600 text-sm font-bold cursor-pointer relative transition-transform duration-200 hover:scale-[1.04] ${
                      isMobile ? "w-full" : ""
                    }`}
                    style={{
                      boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    <Sparkles size={14} /> Start Interview
                  </button>
                </div>
              </Reveal>
            </div>

            {/* Right / Sidebar — desktop only */}
            <div className="hidden lg:flex flex-col gap-5">
              <SidebarContent
                job={job}
                skills={skills}
                handleApply={handleApply}
              />
            </div>
          </div>
        </div>

        <StickyApplyBar
          job={job}
          visible={showStickyBar}
          onApply={handleApply}
        />
      </div>
    </>
  );
};

export default UserJobDetail;

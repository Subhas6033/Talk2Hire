import React, {
  useState,
  useEffect,
  useRef,
  Suspense,
  lazy,
  memo,
} from "react";
import { motion, AnimatePresence, useInView } from "motion/react";
import { Link, useNavigate } from "react-router-dom";
import clsx from "clsx";
import {
  Search,
  MapPin,
  Briefcase,
  Building2,
  Star,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Users,
  Clock,
  CheckCircle,
  Quote,
  Zap,
  BookOpen,
  Award,
  Target,
  Mic,
  Bolt,
  BarChart3,
  Building,
  LineChart,
  ChevronRight,
} from "lucide-react";

/* ═══════════════════════════════════════════════
   DESIGN TOKENS
═══════════════════════════════════════════════ */
const TOKENS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap');

  :root {
    --c-cream:    #faf9f7;
    --c-white:    #ffffff;
    --c-ink:      #0d0d12;
    --c-ink-70:   rgba(13,13,18,0.70);
    --c-ink-40:   rgba(13,13,18,0.40);
    --c-ink-12:   rgba(13,13,18,0.08);
    --c-ink-06:   rgba(13,13,18,0.04);
    --c-slate:    #1e2235;
    --c-slate-2:  #2d3352;
    --c-slate-3:  #3d4570;
    --c-amber:    #d97706;
    --c-amber-l:  #fef3c7;
    --c-amber-2:  #f59e0b;
    --c-sage:     #059669;
    --c-sage-l:   #d1fae5;
    --c-violet:   #7c3aed;
    --c-violet-l: #ede9fe;
    --c-rose:     #e11d48;
    --c-rose-l:   #ffe4e6;
    --c-sky:      #0284c7;
    --c-sky-l:    #e0f2fe;
    --c-border:   rgba(13,13,18,0.09);
    --sh-sm:  0 1px 3px rgba(13,13,18,.07), 0 1px 2px rgba(13,13,18,.05);
    --sh-md:  0 4px 18px rgba(13,13,18,.08), 0 2px 6px rgba(13,13,18,.05);
    --sh-lg:  0 20px 60px rgba(13,13,18,.11), 0 8px 20px rgba(13,13,18,.07);
    --sh-xl:  0 32px 80px rgba(13,13,18,.15);
    --sh-colored: 0 20px 60px rgba(124,58,237,0.15), 0 8px 20px rgba(124,58,237,0.08);
  }

  .home-root { font-family: 'DM Sans', sans-serif; }
  .home-root h1, .home-root h2, .home-root h3 {
    font-family: 'Playfair Display', Georgia, serif;
  }
  .marquee-track:hover { animation-play-state: paused; }

  /* Number counter animation */
  @keyframes countUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

  /* Shimmer on feature icon hover */
  .feature-card:hover .feature-icon::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(135deg, rgba(255,255,255,0.4) 0%, transparent 60%);
    pointer-events: none;
  }
  .feature-icon { position: relative; }

  /* Gradient text */
  .gradient-text {
    background: linear-gradient(135deg, var(--c-slate) 0%, var(--c-slate-3) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
`;

/* ═══════════════════════════════════════════════
   SHARED PRIMITIVES
═══════════════════════════════════════════════ */
const Pill = ({ children, color = "default", className }) => {
  const map = {
    default: "bg-[var(--c-ink-12)] text-[var(--c-ink-70)]",
    amber: "bg-[var(--c-amber-l)] text-[var(--c-amber)]",
    sage: "bg-[var(--c-sage-l)] text-[var(--c-sage)]",
    violet: "bg-[var(--c-violet-l)] text-[var(--c-violet)]",
    rose: "bg-[var(--c-rose-l)] text-[var(--c-rose)]",
    sky: "bg-[var(--c-sky-l)] text-[var(--c-sky)]",
    slate: "bg-[var(--c-slate)] text-white",
  };
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold",
        map[color],
        className,
      )}
    >
      {children}
    </span>
  );
};

/* Section label + heading combo */
const SectionHeading = ({ label, title, subtitle, center = false }) => (
  <div className={clsx("mb-14", center && "text-center")}>
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
    >
      <p
        className="text-xs uppercase tracking-[0.3em] font-bold text-[var(--c-amber)] mb-4 flex items-center gap-2"
        style={center ? { justifyContent: "center" } : {}}
      >
        <span className="w-5 h-px bg-[var(--c-amber)] inline-block" />
        {label}
        <span className="w-5 h-px bg-[var(--c-amber)] inline-block" />
      </p>
      <h2
        className="text-4xl sm:text-5xl font-black text-[var(--c-ink)] tracking-tight leading-[1.06] max-w-lg"
        style={center ? { marginInline: "auto" } : {}}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className="mt-4 text-[var(--c-ink-70)] text-base leading-relaxed max-w-xl"
          style={center ? { marginInline: "auto" } : {}}
        >
          {subtitle}
        </p>
      )}
    </motion.div>
  </div>
);

/* ═══════════════════════════════════════════════
   JOB SEARCH BAR (unchanged — already good)
═══════════════════════════════════════════════ */
const JobSearchBar = ({ className }) => {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (location) params.set("location", location);
    navigate(`/jobs?${params.toString()}`);
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5 }}
      onSubmit={handleSearch}
      className={clsx(
        "flex flex-col sm:flex-row gap-2 p-2 bg-white rounded-2xl border border-[var(--c-border)] shadow-[var(--sh-xl)]",
        className,
      )}
    >
      <label className="flex items-center gap-2.5 flex-1 px-3 py-2 rounded-xl bg-[var(--c-cream)] border border-[var(--c-border)] focus-within:border-[var(--c-slate)] focus-within:shadow-[0_0_0_3px_rgba(30,34,53,0.08)] transition-all">
        <Search size={16} className="text-[var(--c-ink-40)] flex-shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Job title, keyword, or company"
          className="flex-1 bg-transparent text-sm text-[var(--c-ink)] placeholder:text-[var(--c-ink-40)] outline-none"
        />
      </label>
      <div className="hidden sm:block w-px self-stretch my-1 bg-[var(--c-border)]" />
      <label className="flex items-center gap-2.5 flex-1 px-3 py-2 rounded-xl bg-[var(--c-cream)] border border-[var(--c-border)] focus-within:border-[var(--c-slate)] focus-within:shadow-[0_0_0_3px_rgba(30,34,53,0.08)] transition-all">
        <MapPin size={16} className="text-[var(--c-ink-40)] flex-shrink-0" />
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="City, state, or remote"
          className="flex-1 bg-transparent text-sm text-[var(--c-ink)] placeholder:text-[var(--c-ink-40)] outline-none"
        />
      </label>
      <motion.button
        whileTap={{ scale: 0.97 }}
        type="submit"
        className="px-7 py-2.5 bg-[var(--c-slate)] text-white text-sm font-semibold rounded-xl shadow-md hover:bg-[var(--c-slate-2)] hover:shadow-lg transition-all flex items-center justify-center gap-2 flex-shrink-0"
      >
        <Search size={15} /> Search Jobs
      </motion.button>
    </motion.form>
  );
};

/* ═══════════════════════════════════════════════
   ANIMATED JOB BOARD (hero right col)
═══════════════════════════════════════════════ */
const mockJobs = [
  {
    id: 1,
    title: "Senior Frontend Engineer",
    company: "Stripe",
    logo: "S",
    color: "#635bff",
    location: "Remote · USA",
    salary: "$160k–$210k",
    tags: ["React", "TypeScript"],
    type: "Full-time",
    posted: "2h ago",
    applicants: 48,
  },
  {
    id: 2,
    title: "ML Infrastructure Engineer",
    company: "Waymo",
    logo: "W",
    color: "#ff6d00",
    location: "Mountain View, CA",
    salary: "$200k–$260k",
    tags: ["Python", "Kubernetes"],
    type: "Full-time",
    posted: "5h ago",
    applicants: 23,
  },
  {
    id: 3,
    title: "Product Designer",
    company: "Figma",
    logo: "F",
    color: "#0acf83",
    location: "San Francisco · Hybrid",
    salary: "$140k–$185k",
    tags: ["Figma", "Research"],
    type: "Full-time",
    posted: "1d ago",
    applicants: 91,
  },
  {
    id: 4,
    title: "DevOps / Platform Engineer",
    company: "Vercel",
    logo: "V",
    color: "#000000",
    location: "Remote · Global",
    salary: "$150k–$195k",
    tags: ["Go", "AWS"],
    type: "Full-time",
    posted: "2d ago",
    applicants: 37,
  },
];

const AnimatedJobBoard = memo(() => {
  const [activeCard, setActiveCard] = useState(0);
  useEffect(() => {
    const t = setInterval(
      () => setActiveCard((p) => (p + 1) % mockJobs.length),
      2800,
    );
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative select-none pt-10 pb-10">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.6, duration: 0.4, type: "spring" }}
        className="absolute -top-2 right-2 flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-[var(--c-border)] shadow-[var(--sh-lg)] z-10"
      >
        <div className="w-8 h-8 rounded-lg bg-[var(--c-slate)] flex items-center justify-center">
          <Briefcase size={14} className="text-white" />
        </div>
        <div className="leading-none">
          <p className="text-sm font-bold text-[var(--c-ink)]">12,400+</p>
          <p className="text-[10px] text-[var(--c-ink-40)] mt-0.5">
            Open roles
          </p>
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.8, duration: 0.4, type: "spring" }}
        className="absolute -bottom-2 left-2 flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-[var(--c-border)] shadow-[var(--sh-lg)] z-10"
      >
        <div className="w-8 h-8 rounded-lg bg-[var(--c-sage-l)] flex items-center justify-center">
          <TrendingUp size={14} className="text-[var(--c-sage)]" />
        </div>
        <div className="leading-none">
          <p className="text-sm font-bold text-[var(--c-ink)]">+840 today</p>
          <p className="text-[10px] text-[var(--c-ink-40)] mt-0.5">
            New listings
          </p>
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
        className="relative w-full max-w-[420px] mx-auto"
      >
        {[2, 1].map((offset) => (
          <div
            key={offset}
            className="absolute inset-x-0 top-0 bg-white rounded-2xl border border-[var(--c-border)]"
            style={{
              transform: `translateY(${offset * 6}px) scale(${1 - offset * 0.03})`,
              opacity: 1 - offset * 0.25,
              zIndex: 10 - offset,
              height: "180px",
            }}
          />
        ))}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCard}
            initial={{ opacity: 0, y: -20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.38, ease: "easeInOut" }}
            className="relative z-20 bg-white rounded-2xl border border-[var(--c-border)] shadow-[var(--sh-lg)] p-5"
          >
            <div className="flex items-start gap-3 mb-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-black flex-shrink-0 shadow-sm"
                style={{ backgroundColor: mockJobs[activeCard].color }}
              >
                {mockJobs[activeCard].logo}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-[var(--c-ink)] text-sm leading-snug">
                      {mockJobs[activeCard].title}
                    </p>
                    <p className="text-xs text-[var(--c-ink-40)] mt-0.5">
                      {mockJobs[activeCard].company}
                    </p>
                  </div>
                  <Pill color="sage">
                    <CheckCircle size={10} /> Hiring
                  </Pill>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="flex items-center gap-1 text-xs text-[var(--c-ink-70)]">
                <MapPin size={11} className="text-[var(--c-ink-40)]" />
                {mockJobs[activeCard].location}
              </span>
              <span className="text-[var(--c-ink-40)]">·</span>
              <span className="text-xs font-semibold text-[var(--c-ink)]">
                {mockJobs[activeCard].salary}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {mockJobs[activeCard].tags.map((t) => (
                <Pill key={t} color="violet" className="text-[10px]">
                  {t}
                </Pill>
              ))}
              <Pill color="default" className="text-[10px]">
                {mockJobs[activeCard].type}
              </Pill>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-[var(--c-border)]">
              <span className="flex items-center gap-1 text-[11px] text-[var(--c-ink-40)]">
                <Clock size={11} />
                {mockJobs[activeCard].posted}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-[var(--c-ink-40)]">
                <Users size={11} />
                {mockJobs[activeCard].applicants} applicants
              </span>
              <motion.button
                whileTap={{ scale: 0.96 }}
                className="px-4 py-1.5 bg-[var(--c-slate)] text-white text-[11px] font-semibold rounded-lg hover:bg-[var(--c-slate-2)] transition-colors"
              >
                Quick Apply
              </motion.button>
            </div>
          </motion.div>
        </AnimatePresence>
        <div className="flex justify-center gap-1.5 mt-8 relative z-20">
          {mockJobs.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveCard(i)}
              className={clsx(
                "rounded-full transition-all duration-300",
                i === activeCard
                  ? "w-5 h-2 bg-[var(--c-slate)]"
                  : "w-2 h-2 bg-[var(--c-ink-12)] hover:bg-[var(--c-ink-40)]",
              )}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
});

/* ═══════════════════════════════════════════════
   ✦  FEATURES SECTION  (redesigned)
═══════════════════════════════════════════════ */
const featuresData = [
  {
    icon: Target,
    color: "var(--c-violet)",
    bg: "var(--c-violet-l)",
    title: "AI-Matched Opportunities",
    desc: "Our engine reads your profile and surfaces roles where you're a genuine fit — not just a keyword match.",
    stat: "3× more interviews",
    statColor: "var(--c-violet)",
  },
  {
    icon: Mic,
    color: "var(--c-rose)",
    bg: "var(--c-rose-l)",
    title: "Voice Interview Practice",
    desc: "Rehearse with our AI interviewer before the real thing. Scored on clarity, technical depth, and confidence.",
    stat: "92% pass rate",
    statColor: "var(--c-rose)",
  },
  {
    icon: Zap,
    color: "var(--c-amber)",
    bg: "var(--c-amber-l)",
    title: "One-Click Applications",
    desc: "Your resume is pre-filled from your profile. Apply to multiple roles in seconds, not hours.",
    stat: "Avg. 8 sec to apply",
    statColor: "var(--c-amber)",
  },
  {
    icon: BarChart3,
    color: "var(--c-sky)",
    bg: "var(--c-sky-l)",
    title: "Real-Time Market Salaries",
    desc: "Know your worth before you negotiate. Live compensation data for every role you explore.",
    stat: "+$28k avg. negotiated",
    statColor: "var(--c-sky)",
  },
  {
    icon: Building,
    color: "var(--c-sage)",
    bg: "var(--c-sage-l)",
    title: "Verified Company Profiles",
    desc: "Ratings, culture insights, interview experiences, and perks — sourced from real employees.",
    stat: "500+ verified companies",
    statColor: "var(--c-sage)",
  },
  {
    icon: LineChart,
    color: "var(--c-slate)",
    bg: "var(--c-ink-12)",
    title: "Application Tracker",
    desc: "Visual pipeline from application to offer. Never lose track of a conversation again.",
    stat: "Full funnel visibility",
    statColor: "var(--c-slate)",
  },
];

export const FeaturesSection = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section
      ref={ref}
      className="relative py-28 overflow-hidden bg-[var(--c-cream)] home-root"
    >
      <style>{TOKENS}</style>

      {/* Background decoration */}
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(circle, var(--c-border) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <div
        className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-[160px] opacity-30 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, var(--c-violet-l), transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-16">
          <SectionHeading
            label="Platform Features"
            title={"Your whole\ncareer toolkit."}
            subtitle="Everything from job discovery to offer negotiation — in one streamlined platform."
          />
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex-shrink-0"
          >
            <Link
              to="/jobs"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[var(--c-border)] bg-white text-sm font-semibold text-[var(--c-ink-70)] hover:text-[var(--c-ink)] hover:shadow-[var(--sh-md)] transition-all shadow-[var(--sh-sm)]"
            >
              Browse all features <ChevronRight size={15} />
            </Link>
          </motion.div>
        </div>

        {/* Bento-style grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {featuresData.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 28, scale: 0.97 }}
                animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
                transition={{
                  delay: i * 0.08,
                  duration: 0.5,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <motion.div
                  whileHover={{ y: -6, scale: 1.015 }}
                  transition={{ type: "spring", stiffness: 320, damping: 20 }}
                  className={clsx(
                    "feature-card h-full group relative overflow-hidden",
                    "bg-white rounded-3xl border border-[var(--c-border)]",
                    "shadow-[var(--sh-sm)] hover:shadow-[var(--sh-lg)] transition-shadow duration-300",
                    "p-7 flex flex-col gap-5",
                    // Make first and last card span wider on large screens
                    i === 0 && "lg:col-span-1",
                  )}
                >
                  {/* Subtle bg tint on hover */}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl pointer-events-none"
                    style={{
                      background: `radial-gradient(ellipse at top left, ${item.bg} 0%, transparent 65%)`,
                    }}
                  />

                  {/* Icon */}
                  <div className="relative w-fit">
                    <div
                      className="feature-icon w-12 h-12 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                      style={{ backgroundColor: item.bg }}
                    >
                      <Icon size={22} style={{ color: item.color }} />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 relative">
                    <h3 className="font-bold text-[var(--c-ink)] text-[16px] mb-2.5 leading-snug tracking-tight group-hover:text-[var(--c-slate)] transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-sm text-[var(--c-ink-70)] leading-relaxed">
                      {item.desc}
                    </p>
                  </div>

                  {/* Stat chip */}
                  <div className="relative flex items-center justify-between pt-4 border-t border-[var(--c-border)]">
                    <span
                      className="text-xs font-bold"
                      style={{ color: item.color }}
                    >
                      {item.stat}
                    </span>
                    <motion.div
                      whileHover={{ x: 3 }}
                      className="w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ backgroundColor: item.bg }}
                    >
                      <ArrowRight size={13} style={{ color: item.color }} />
                    </motion.div>
                  </div>
                </motion.div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

/* ═══════════════════════════════════════════════
   ✦  TRUSTED COMPANIES SLIDER  (redesigned)
═══════════════════════════════════════════════ */
const companies = [
  { name: "Google", logo: "/google.webp", h: "h-7" },
  { name: "Amazon", logo: "/amazon.png", h: "h-8" },
  { name: "Microsoft", logo: "/microsoft.png", h: "h-14" },
  { name: "Netflix", logo: "/netflix.png", h: "h-7" },
  { name: "Meta", logo: "/meta.png", h: "h-8" },
  // { name: "Stripe", logo: "/stripe.png", h: "h-7" },
  // { name: "Shopify", logo: "/shopify.png", h: "h-8" },
];

const statBubbles = [
  {
    value: "500+",
    label: "Hiring companies",
    color: "var(--c-violet-l)",
    text: "var(--c-violet)",
  },
  {
    value: "12k+",
    label: "Open roles today",
    color: "var(--c-sage-l)",
    text: "var(--c-sage)",
  },
  {
    value: "94%",
    label: "Placement rate",
    color: "var(--c-amber-l)",
    text: "var(--c-amber)",
  },
];

export const TrustedCompaniesSlider = memo(() => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section
      ref={ref}
      className="relative py-20 overflow-hidden bg-white home-root"
    >
      <style>{TOKENS}</style>

      {/* Subtle top/bottom rule lines */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--c-border)] to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--c-border)] to-transparent" />

      <div className="relative mx-auto max-w-7xl px-6">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 mb-14">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
          >
            <p className="text-xs uppercase tracking-[0.3em] font-bold text-[var(--c-amber)] mb-2 flex items-center gap-2">
              <span className="w-5 h-px bg-[var(--c-amber)] inline-block" /> Our
              Partners
            </p>
            <h2 className="text-2xl sm:text-3xl font-black text-[var(--c-ink)] tracking-tight">
              Top companies hiring now
            </h2>
          </motion.div>

          {/* Stat bubbles */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="flex flex-wrap gap-3"
          >
            {statBubbles.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={inView ? { opacity: 1, scale: 1 } : {}}
                transition={{
                  delay: 0.2 + i * 0.08,
                  duration: 0.4,
                  type: "spring",
                }}
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border border-[var(--c-border)] shadow-[var(--sh-sm)]"
                style={{ backgroundColor: s.color }}
              >
                <span
                  className="text-[15px] font-black"
                  style={{ color: s.text }}
                >
                  {s.value}
                </span>
                <span className="text-[11px] font-medium text-[var(--c-ink-70)] leading-tight max-w-[70px]">
                  {s.label}
                </span>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Slider */}
        <div className="relative overflow-hidden rounded-2xl border border-[var(--c-border)] bg-[var(--c-cream)] p-4 shadow-[var(--sh-sm)]">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-20 z-10 bg-gradient-to-r from-[var(--c-cream)] to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-20 z-10 bg-gradient-to-l from-[var(--c-cream)] to-transparent" />

          <motion.div
            className="flex gap-4 marquee-track"
            animate={{ x: ["0%", "-50%"] }}
            transition={{ repeat: Infinity, ease: "linear", duration: 28 }}
          >
            {[...companies, ...companies].map((c, i) => (
              <motion.div
                key={`${c.name}-${i}`}
                whileHover={{ y: -4, scale: 1.04, backgroundColor: "#ffffff" }}
                transition={{ type: "spring", stiffness: 400, damping: 22 }}
                className="flex-shrink-0 w-40 h-16 flex items-center justify-center bg-white rounded-xl border border-[var(--c-border)] shadow-[var(--sh-sm)] cursor-pointer transition-colors"
              >
                <img
                  src={c.logo}
                  alt={`${c.name} logo`}
                  loading="lazy"
                  className={clsx(
                    "w-auto object-contain grayscale hover:grayscale-0 opacity-50 hover:opacity-100 transition-all duration-400",
                    c.h,
                  )}
                />
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* CTA row */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="mt-8 flex items-center justify-center gap-4"
        >
          <p className="text-sm text-[var(--c-ink-40)]">
            Want to post a job and reach 50k+ candidates?
          </p>
          <Link
            to="/hire"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--c-slate)] hover:text-[var(--c-slate-2)] transition-colors"
          >
            List your company <ChevronRight size={14} />
          </Link>
        </motion.div>
      </div>
    </section>
  );
});

/* ═══════════════════════════════════════════════
   ✦  TESTIMONIALS SECTION  (redesigned)
═══════════════════════════════════════════════ */
const testimonials = [
  {
    name: "Sarah Chen",
    role: "Senior Engineer",
    company: "Stripe",
    avatar: "SC",
    avatarColor: "#6366f1",
    quote:
      "Talk2Hire's AI coaching pinpointed exactly where I was stumbling in system design rounds. Landed my Stripe offer after two weeks of targeted practice.",
    rating: 5,
    outcome: "Got offer in 3 weeks",
    outcomeColor: "sage",
  },
  {
    name: "Marcus Johnson",
    role: "ML Engineer",
    company: "Waymo",
    avatar: "MJ",
    avatarColor: "#f59e0b",
    quote:
      "The salary benchmarks alone were worth it. I negotiated $40k more than my initial offer by knowing what the market actually pays.",
    rating: 5,
    outcome: "Negotiated +$40k",
    outcomeColor: "amber",
  },
  {
    name: "Priya Nair",
    role: "Backend Developer",
    company: "Shopify",
    avatar: "PN",
    avatarColor: "#10b981",
    quote:
      "Every job I found here was a genuine fit for my background — no noise, just signal. Applied to 8 roles, got 6 first-round interviews.",
    rating: 5,
    outcome: "6 interviews from 8 apps",
    outcomeColor: "sage",
  },
  {
    name: "Alex Rivera",
    role: "Frontend Engineer",
    company: "Vercel",
    avatar: "AR",
    avatarColor: "#ec4899",
    quote:
      "The application tracker kept me sane during my search. Seeing everything in a visual pipeline turned a stressful month into a manageable process.",
    rating: 5,
    outcome: "Hired in 5 weeks",
    outcomeColor: "violet",
  },
  {
    name: "Jordan Kim",
    role: "Platform Engineer",
    company: "Cloudflare",
    avatar: "JK",
    avatarColor: "#0ea5e9",
    quote:
      "The company culture cards are incredibly honest. I avoided two companies that looked great on paper but had serious red flags from real employees.",
    rating: 5,
    outcome: "Found perfect culture fit",
    outcomeColor: "sky",
  },
];

/* Featured quote — large display card */
const FeaturedTestimonial = ({ item }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.6 }}
    className="relative overflow-hidden rounded-3xl p-8 sm:p-10"
    style={{
      background: `linear-gradient(135deg, var(--c-slate) 0%, var(--c-slate-2) 60%, var(--c-slate-3) 100%)`,
    }}
  >
    {/* Quote mark watermark */}
    <div className="absolute top-4 right-6 text-[10rem] leading-none font-serif text-white opacity-[0.06] select-none pointer-events-none">
      "
    </div>

    <div className="relative">
      {/* Stars */}
      <div className="flex gap-1 mb-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            size={16}
            className="fill-[var(--c-amber)] text-[var(--c-amber)]"
          />
        ))}
      </div>

      <blockquote className="text-xl sm:text-2xl font-semibold text-white leading-relaxed mb-8 max-w-2xl">
        "{item.quote}"
      </blockquote>

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-md"
            style={{ backgroundColor: item.avatarColor }}
          >
            {item.avatar}
          </div>
          <div>
            <p className="font-bold text-white text-sm">{item.name}</p>
            <p className="text-white/55 text-xs mt-0.5">
              {item.role} @ {item.company}
            </p>
          </div>
        </div>
        <Pill color="amber" className="text-xs">
          {item.outcome}
        </Pill>
      </div>
    </div>
  </motion.div>
);

/* Regular scroll card */
const TestimonialCard = memo(({ item, index }) => (
  <motion.div
    initial={{ opacity: 0, y: 24 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ delay: index * 0.1, duration: 0.5 }}
    className="min-w-[300px] max-w-[300px]"
  >
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 320, damping: 20 }}
      className="h-full bg-white rounded-3xl border border-[var(--c-border)] shadow-[var(--sh-sm)] hover:shadow-[var(--sh-lg)] p-6 flex flex-col gap-4 relative overflow-hidden transition-shadow duration-300 group"
    >
      {/* Top accent line */}
      <div
        className="absolute top-0 left-6 right-6 h-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ backgroundColor: item.avatarColor }}
      />

      <div className="flex items-center justify-between">
        {/* Avatar */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-sm"
            style={{ backgroundColor: item.avatarColor }}
          >
            {item.avatar}
          </div>
          <div>
            <p className="font-bold text-[var(--c-ink)] text-sm leading-none">
              {item.name}
            </p>
            <p className="text-[11px] text-[var(--c-ink-40)] mt-0.5">
              {item.company}
            </p>
          </div>
        </div>
        {/* Stars */}
        <div className="flex gap-0.5">
          {Array.from({ length: item.rating }).map((_, i) => (
            <Star
              key={i}
              size={11}
              className="text-[var(--c-amber)] fill-[var(--c-amber)]"
            />
          ))}
        </div>
      </div>

      <p className="text-sm text-[var(--c-ink-70)] leading-relaxed flex-1">
        "{item.quote}"
      </p>

      <div className="flex items-center justify-between pt-3 border-t border-[var(--c-border)]">
        <Pill color={item.outcomeColor} className="text-[10px]">
          <CheckCircle size={9} /> {item.outcome}
        </Pill>
        <p className="text-[10px] text-[var(--c-ink-40)]">{item.role}</p>
      </div>
    </motion.div>
  </motion.div>
));

export const TestimonialsSlider = memo(() => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section
      ref={ref}
      className="relative py-28 overflow-hidden bg-[var(--c-cream)] home-root"
    >
      <style>{TOKENS}</style>

      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(var(--c-border) 1px, transparent 1px), linear-gradient(90deg, var(--c-border) 1px, transparent 1px)",
          backgroundSize: "52px 52px",
        }}
      />
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] rounded-full blur-[120px] opacity-20 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, var(--c-violet-l), transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-6">
        <SectionHeading
          label="Success Stories"
          title={"Real hires,\nreal results."}
          subtitle="Thousands of engineers landed offers using Talk2Hire. Here's what they say."
        />

        {/* Featured large testimonial */}
        <div className="mb-10">
          <FeaturedTestimonial item={testimonials[0]} />
        </div>

        {/* Scrolling cards row */}
        <div className="relative overflow-hidden -mx-6 px-6">
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-20 z-10"
            style={{
              background:
                "linear-gradient(to right, var(--c-cream), transparent)",
            }}
          />
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-20 z-10"
            style={{
              background:
                "linear-gradient(to left, var(--c-cream), transparent)",
            }}
          />
          <motion.div
            className="flex gap-5 marquee-track"
            animate={{ x: ["0%", "-50%"] }}
            transition={{ repeat: Infinity, ease: "linear", duration: 42 }}
          >
            {[...testimonials.slice(1), ...testimonials.slice(1)].map(
              (item, i) => (
                <TestimonialCard
                  key={`${item.name}-${i}`}
                  item={item}
                  index={i}
                />
              ),
            )}
          </motion.div>
        </div>

        {/* Bottom stats row */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4"
        >
          {[
            { value: "8,200+", label: "Professionals hired", icon: "🎯" },
            { value: "4.9/5", label: "Average rating", icon: "⭐" },
            { value: "94%", label: "Interview success rate", icon: "📈" },
            { value: "<3 wks", label: "Average time to offer", icon: "⚡" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{
                delay: 0.55 + i * 0.08,
                duration: 0.4,
                type: "spring",
              }}
              className="flex flex-col items-center justify-center gap-2 p-5 rounded-2xl bg-white border border-[var(--c-border)] shadow-[var(--sh-sm)] text-center"
            >
              <span className="text-2xl">{stat.icon}</span>
              <p className="text-2xl font-black text-[var(--c-ink)]">
                {stat.value}
              </p>
              <p className="text-xs text-[var(--c-ink-40)] font-medium">
                {stat.label}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
});

/* ═══════════════════════════════════════════════
   CTA BANNER (polished)
═══════════════════════════════════════════════ */
export const CTABanner = () => (
  <section
    className="relative py-28 overflow-hidden home-root"
    style={{ backgroundColor: "var(--c-slate)" }}
  >
    <style>{TOKENS}</style>
    <div
      className="absolute inset-0 opacity-[0.07]"
      style={{
        backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
        backgroundSize: "28px 28px",
      }}
    />
    <div
      className="absolute top-[-30%] left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full blur-[160px] opacity-20 pointer-events-none"
      style={{ backgroundColor: "var(--c-amber)" }}
    />
    <div
      className="absolute bottom-[-20%] right-[-5%] w-[400px] h-[400px] rounded-full blur-[120px] opacity-10 pointer-events-none"
      style={{ backgroundColor: "var(--c-violet)" }}
    />

    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="relative text-center px-6"
    >
      <Pill color="amber" className="mb-6 mx-auto">
        <Zap size={11} /> No credit card required
      </Pill>
      <h2 className="text-4xl sm:text-6xl font-black text-white mb-5 tracking-tight leading-[1.04]">
        Your next role
        <br />
        is waiting.
      </h2>
      <p className="text-white/50 mb-10 max-w-md mx-auto text-base leading-relaxed">
        Create a free profile, get matched to verified roles, and practice with
        AI before your real interview.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          to="/signup"
          className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white font-bold text-sm rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
          style={{ color: "var(--c-slate)" }}
        >
          Get Started Free <ArrowRight size={15} />
        </Link>
        <Link
          to="/jobs"
          className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white/10 text-white font-semibold text-sm rounded-xl border border-white/20 hover:bg-white/15 transition-all"
        >
          <BookOpen size={15} /> Browse Jobs
        </Link>
      </div>
      <div className="mt-16 flex flex-wrap justify-center gap-12">
        {[
          { icon: Award, value: "4.9/5", label: "Avg. rating" },
          { icon: Users, value: "8,200+", label: "Hired this year" },
          { icon: Building2, value: "500+", label: "Partner companies" },
        ].map(({ icon: Icon, value, label }) => (
          <div key={label} className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Icon size={13} className="text-[var(--c-amber)]" />
              <p className="text-2xl font-black text-white">{value}</p>
            </div>
            <p className="text-xs text-white/35">{label}</p>
          </div>
        ))}
      </div>
    </motion.div>
  </section>
);

/* ═══════════════════════════════════════════════
   HERO SECTION
═══════════════════════════════════════════════ */
export const HeroSection = () => {
  const trendingSearches = [
    "Remote Engineering",
    "Product Design",
    "Data Science",
    "DevOps",
  ];
  return (
    <section className="relative overflow-hidden bg-[var(--c-cream)] home-root">
      <style>{TOKENS}</style>
      <div
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "linear-gradient(var(--c-border) 1px, transparent 1px), linear-gradient(90deg, var(--c-border) 1px, transparent 1px)",
          backgroundSize: "52px 52px",
        }}
      />
      <div className="absolute top-[-20%] right-[-8%] w-[520px] h-[520px] rounded-full bg-amber-100 blur-[140px] opacity-70 pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[380px] h-[380px] rounded-full bg-slate-100 blur-[100px] opacity-80 pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-6 pt-24 pb-28">
        <div className="grid grid-cols-1 lg:grid-cols-2 items-center gap-20">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <Pill color="amber" className="mb-6">
                <Sparkles size={11} /> Now with AI Interview Coaching
              </Pill>
              <h1 className="text-[clamp(2.6rem,5vw,3.8rem)] font-black leading-[1.08] tracking-tight text-[var(--c-ink)] mb-6">
                Find Work That{" "}
                <span className="relative inline-block">
                  Fits
                  <svg
                    className="absolute -bottom-1 left-0 w-full"
                    viewBox="0 0 200 8"
                    fill="none"
                    preserveAspectRatio="none"
                  >
                    <motion.path
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{
                        delay: 0.8,
                        duration: 0.7,
                        ease: "easeOut",
                      }}
                      d="M4 5 Q50 1 100 5 Q150 9 196 4"
                      stroke="#d97706"
                      strokeWidth="3"
                      strokeLinecap="round"
                      fill="none"
                    />
                  </svg>
                </span>
                <br />
                <span className="text-[var(--c-ink-40)]">Your Ambition.</span>
              </h1>
              <p className="text-[var(--c-ink-70)] text-base leading-relaxed mb-8 max-w-md">
                Discover roles at top-tier companies, practice with AI interview
                coaching, and land offers faster — all in one place.
              </p>
              <JobSearchBar className="mb-4" />
              <div className="flex flex-wrap items-center gap-2 mt-4">
                <span className="text-xs text-[var(--c-ink-40)] font-medium">
                  Trending:
                </span>
                {trendingSearches.map((s) => (
                  <button
                    key={s}
                    className="px-3 py-1 rounded-full bg-white border border-[var(--c-border)] text-xs text-[var(--c-ink-70)] hover:text-[var(--c-ink)] hover:border-[var(--c-ink-40)] transition-all shadow-[var(--sh-sm)]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="mt-10 flex items-center gap-4 pt-8 border-t border-[var(--c-border)]"
            >
              <div className="flex -space-x-2">
                {["#6366f1", "#ec4899", "#f59e0b", "#10b981"].map((c, i) => (
                  <div
                    key={i}
                    className="w-9 h-9 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: c }}
                  >
                    {["A", "S", "M", "J"][i]}
                  </div>
                ))}
              </div>
              <div>
                <div className="flex gap-0.5 mb-0.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                      key={i}
                      size={12}
                      className="text-[var(--c-amber)] fill-[var(--c-amber)]"
                    />
                  ))}
                </div>
                <p className="text-xs text-[var(--c-ink-40)]">
                  <span className="font-bold text-[var(--c-ink)]">8,200+</span>{" "}
                  professionals hired this year
                </p>
              </div>
              <div className="ml-auto hidden sm:flex gap-6">
                {[
                  { value: "500+", label: "Companies" },
                  { value: "12k+", label: "Open Roles" },
                ].map(({ value, label }) => (
                  <div key={label} className="text-center">
                    <p className="text-lg font-black text-[var(--c-ink)]">
                      {value}
                    </p>
                    <p className="text-[11px] text-[var(--c-ink-40)]">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
          <div className="hidden lg:block">
            <AnimatedJobBoard />
          </div>
        </div>
      </div>
    </section>
  );
};

/* ═══════════════════════════════════════════════
   LAZY WRAPPERS + FALLBACK
═══════════════════════════════════════════════ */
const LazyFeatures = lazy(() => Promise.resolve({ default: FeaturesSection }));
const LazyTrustedSlider = lazy(() =>
  Promise.resolve({ default: TrustedCompaniesSlider }),
);
const LazyTestimonialsSlider = lazy(() =>
  Promise.resolve({ default: TestimonialsSlider }),
);
const LazyCTABanner = lazy(() => Promise.resolve({ default: CTABanner }));

const SectionFallback = () => (
  <div className="w-full py-24 flex items-center justify-center bg-white">
    <div
      className="w-8 h-8 rounded-full border-2 animate-spin"
      style={{
        borderColor: "var(--c-border)",
        borderTopColor: "var(--c-slate)",
      }}
    />
  </div>
);

/* ═══════════════════════════════════════════════
   HOME PAGE  — Nav rendered by Layout, not here
═══════════════════════════════════════════════ */
export const HomePage = () => (
  <div className="home-root min-h-screen bg-white">
    <style>{TOKENS}</style>
    <HeroSection />
    <Suspense fallback={<SectionFallback />}>
      <LazyFeatures />
    </Suspense>
    <Suspense fallback={<SectionFallback />}>
      <LazyTrustedSlider />
    </Suspense>
    <Suspense fallback={<SectionFallback />}>
      <LazyTestimonialsSlider />
    </Suspense>
    <Suspense fallback={<SectionFallback />}>
      <LazyCTABanner />
    </Suspense>
  </div>
);

export default HomePage;

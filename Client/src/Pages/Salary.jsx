import React, { useState, useRef, useEffect } from "react";
import {
  motion,
  useInView,
  AnimatePresence,
  useMotionValue,
  useSpring,
} from "motion/react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import {
  TrendingUp,
  TrendingDown,
  MapPin,
  Briefcase,
  ChevronDown,
  ArrowRight,
  Sparkles,
  BarChart2,
  DollarSign,
  Users,
  Star,
  Info,
  ArrowUpRight,
  Layers,
  Search,
  ChevronRight,
  Zap,
  Award,
  Building2,
  GraduationCap,
  Clock,
} from "lucide-react";

/* ═══════════════════════════════════════════════
   DESIGN TOKENS
═══════════════════════════════════════════════ */
const TOKENS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap');

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
  }

  .salary-root { font-family: 'DM Sans', sans-serif; color: var(--c-ink); }
  .salary-root h1, .salary-root h2, .salary-root h3, .salary-root h4 {
    font-family: 'Playfair Display', Georgia, serif;
  }

  @keyframes ticker-up {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .ticker { animation: ticker-up 0.4s ease forwards; }

  @keyframes bar-grow {
    from { width: 0; }
  }

  @keyframes float-slow {
    0%, 100% { transform: translateY(0px); }
    50%       { transform: translateY(-6px); }
  }
  .float-slow { animation: float-slow 6s ease-in-out infinite; }

  @keyframes pulse-ring {
    0%   { box-shadow: 0 0 0 0 rgba(5,150,105,0.3); }
    70%  { box-shadow: 0 0 0 10px rgba(5,150,105,0); }
    100% { box-shadow: 0 0 0 0 rgba(5,150,105,0); }
  }
  .pulse-ring { animation: pulse-ring 2.5s ease-in-out infinite; }

  .bar-fill { animation: bar-grow 1.2s cubic-bezier(0.22,1,0.36,1) forwards; }

  select { -webkit-appearance: none; appearance: none; }

  .salary-root .gradient-text {
    background: linear-gradient(135deg, var(--c-ink) 0%, var(--c-slate-3) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .hover-lift { transition: transform 0.25s cubic-bezier(0.22,1,0.36,1), box-shadow 0.25s ease; }
  .hover-lift:hover { transform: translateY(-4px); box-shadow: var(--sh-lg); }
`;

/* ═══════════════════════════════════════════════
   SALARY DATA
═══════════════════════════════════════════════ */
const ROLES = [
  "Software Engineer",
  "Frontend Engineer",
  "Backend Engineer",
  "ML Engineer",
  "DevOps Engineer",
  "Product Manager",
  "Data Scientist",
  "Platform Engineer",
];

const LOCATIONS = ["San Francisco", "New York", "Seattle", "Austin", "Remote"];

const LEVELS = ["Junior", "Mid-level", "Senior", "Staff", "Principal"];

const SALARY_DATA = {
  "Software Engineer": {
    Junior: { base: 115000, total: 145000, equity: 22000, bonus: 8000 },
    "Mid-level": { base: 155000, total: 210000, equity: 42000, bonus: 13000 },
    Senior: { base: 200000, total: 285000, equity: 68000, bonus: 17000 },
    Staff: { base: 250000, total: 370000, equity: 100000, bonus: 20000 },
    Principal: { base: 300000, total: 460000, equity: 140000, bonus: 20000 },
  },
  "Frontend Engineer": {
    Junior: { base: 108000, total: 132000, equity: 16000, bonus: 8000 },
    "Mid-level": { base: 148000, total: 195000, equity: 36000, bonus: 11000 },
    Senior: { base: 190000, total: 265000, equity: 60000, bonus: 15000 },
    Staff: { base: 235000, total: 345000, equity: 88000, bonus: 22000 },
    Principal: { base: 280000, total: 420000, equity: 120000, bonus: 20000 },
  },
  "Backend Engineer": {
    Junior: { base: 112000, total: 140000, equity: 20000, bonus: 8000 },
    "Mid-level": { base: 153000, total: 205000, equity: 40000, bonus: 12000 },
    Senior: { base: 196000, total: 278000, equity: 65000, bonus: 17000 },
    Staff: { base: 245000, total: 360000, equity: 95000, bonus: 20000 },
    Principal: { base: 292000, total: 450000, equity: 136000, bonus: 22000 },
  },
  "ML Engineer": {
    Junior: { base: 125000, total: 160000, equity: 25000, bonus: 10000 },
    "Mid-level": { base: 170000, total: 235000, equity: 52000, bonus: 13000 },
    Senior: { base: 220000, total: 315000, equity: 80000, bonus: 15000 },
    Staff: { base: 275000, total: 405000, equity: 110000, bonus: 20000 },
    Principal: { base: 330000, total: 500000, equity: 150000, bonus: 20000 },
  },
  "DevOps Engineer": {
    Junior: { base: 105000, total: 130000, equity: 17000, bonus: 8000 },
    "Mid-level": { base: 143000, total: 188000, equity: 33000, bonus: 12000 },
    Senior: { base: 182000, total: 252000, equity: 55000, bonus: 15000 },
    Staff: { base: 225000, total: 328000, equity: 80000, bonus: 23000 },
    Principal: { base: 265000, total: 395000, equity: 110000, bonus: 20000 },
  },
  "Product Manager": {
    Junior: { base: 110000, total: 140000, equity: 20000, bonus: 10000 },
    "Mid-level": { base: 152000, total: 202000, equity: 38000, bonus: 12000 },
    Senior: { base: 195000, total: 272000, equity: 62000, bonus: 15000 },
    Staff: { base: 240000, total: 352000, equity: 90000, bonus: 22000 },
    Principal: { base: 285000, total: 430000, equity: 125000, bonus: 20000 },
  },
  "Data Scientist": {
    Junior: { base: 118000, total: 148000, equity: 20000, bonus: 10000 },
    "Mid-level": { base: 160000, total: 218000, equity: 45000, bonus: 13000 },
    Senior: { base: 205000, total: 290000, equity: 70000, bonus: 15000 },
    Staff: { base: 255000, total: 375000, equity: 100000, bonus: 20000 },
    Principal: { base: 305000, total: 465000, equity: 140000, bonus: 20000 },
  },
  "Platform Engineer": {
    Junior: { base: 113000, total: 142000, equity: 21000, bonus: 8000 },
    "Mid-level": { base: 156000, total: 210000, equity: 42000, bonus: 12000 },
    Senior: { base: 200000, total: 283000, equity: 67000, bonus: 16000 },
    Staff: { base: 248000, total: 365000, equity: 97000, bonus: 20000 },
    Principal: { base: 295000, total: 455000, equity: 140000, bonus: 20000 },
  },
};

const LOCATION_MULTIPLIER = {
  "San Francisco": 1.0,
  "New York": 0.95,
  Seattle: 0.93,
  Austin: 0.82,
  Remote: 0.88,
};

const COMPANY_DATA = [
  {
    name: "Google",
    logo: "G",
    color: "#4285F4",
    avg: 285000,
    yoe: "5-7 yrs",
    interview: 4.2,
  },
  {
    name: "Meta",
    logo: "M",
    color: "#0866FF",
    avg: 310000,
    yoe: "5-8 yrs",
    interview: 4.5,
  },
  {
    name: "Apple",
    logo: "⌘",
    color: "#555",
    avg: 275000,
    yoe: "6-8 yrs",
    interview: 4.1,
  },
  {
    name: "Amazon",
    logo: "A",
    color: "#FF9900",
    avg: 248000,
    yoe: "4-6 yrs",
    interview: 4.0,
  },
  {
    name: "Microsoft",
    logo: "⊞",
    color: "#00A4EF",
    avg: 262000,
    yoe: "5-7 yrs",
    interview: 3.9,
  },
  {
    name: "Stripe",
    logo: "S",
    color: "#6772E5",
    avg: 295000,
    yoe: "5-8 yrs",
    interview: 4.6,
  },
];

const TRENDING = [
  {
    title: "ML Engineer",
    growth: "+18%",
    color: "var(--c-sage)",
    bg: "var(--c-sage-l)",
    icon: TrendingUp,
  },
  {
    title: "Platform Eng.",
    growth: "+12%",
    color: "var(--c-violet)",
    bg: "var(--c-violet-l)",
    icon: TrendingUp,
  },
  {
    title: "DevOps Eng.",
    growth: "+9%",
    color: "var(--c-sky)",
    bg: "var(--c-sky-l)",
    icon: TrendingUp,
  },
  {
    title: "Data Scientist",
    growth: "+14%",
    color: "var(--c-amber)",
    bg: "var(--c-amber-l)",
    icon: TrendingUp,
  },
];

/* ═══════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════ */
const fmt = (n) =>
  n >= 1000 ? "$" + (n / 1000).toFixed(n % 1000 === 0 ? 0 : 0) + "K" : "$" + n;

const fmtFull = (n) => "$" + n.toLocaleString("en-US");

/* ═══════════════════════════════════════════════
   ANIMATED NUMBER
═══════════════════════════════════════════════ */
const AnimatedNumber = ({
  value,
  prefix = "$",
  suffix = "",
  decimals = 0,
  className,
  style,
}) => {
  const [displayed, setDisplayed] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    let start = null;
    const duration = 1200;
    const from = displayed;
    const to = value;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplayed(Math.round(from + (to - from) * ease));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, value]);

  const display =
    decimals > 0
      ? displayed.toFixed(decimals)
      : displayed.toLocaleString("en-US");

  return (
    <span ref={ref} className={className} style={style}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
};

/* ═══════════════════════════════════════════════
   PILL
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

/* ═══════════════════════════════════════════════
   SECTION HEADING
═══════════════════════════════════════════════ */
const SectionHeading = ({ label, title, subtitle, center = false }) => (
  <div className={clsx("mb-12", center && "text-center")}>
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.55 }}
    >
      <p
        className="text-xs uppercase tracking-[0.3em] font-bold text-var(--c-amber) mb-4 flex items-center gap-2"
        style={center ? { justifyContent: "center" } : {}}
      >
        <span className="w-5 h-px bg-var(--c-amber) inline-block" />
        {label}
        <span className="w-5 h-px bg-var(--c-amber) inline-block" />
      </p>
      <h2
        className="text-4xl sm:text-5xl font-black text-var(--c-ink) tracking-tight leading-[1.06] max-w-lg whitespace-pre-line"
        style={center ? { marginInline: "auto" } : {}}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className="mt-4 text-var(--c-ink-70) text-base leading-relaxed max-w-xl"
          style={center ? { marginInline: "auto" } : {}}
        >
          {subtitle}
        </p>
      )}
    </motion.div>
  </div>
);

/* ═══════════════════════════════════════════════
   SALARY BAR CHART
═══════════════════════════════════════════════ */
const SalaryBarChart = ({ role, location }) => {
  const chartRef = useRef(null);
  const inView = useInView(chartRef, { once: true, margin: "-60px" });
  const multiplier = LOCATION_MULTIPLIER[location] || 1;
  const data = SALARY_DATA[role] || SALARY_DATA["Software Engineer"];

  const levels = Object.keys(data);
  const maxVal = Math.max(...levels.map((l) => data[l].total * multiplier));

  return (
    <div ref={chartRef} className="space-y-4">
      {levels.map((level, i) => {
        const d = data[level];
        const base = Math.round(d.base * multiplier);
        const total = Math.round(d.total * multiplier);
        const basePct = (base / maxVal) * 100;
        const totalPct = (total / maxVal) * 100;

        return (
          <motion.div
            key={level}
            initial={{ opacity: 0, x: -20 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{
              delay: i * 0.1,
              duration: 0.5,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="group"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-var(--c-ink) w-20 shrink-0">
                {level}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-var(--c-ink-40) font-medium">
                  {fmt(base)} base
                </span>
                <span className="text-xs font-bold text-var(--c-ink)">
                  {fmt(total)} total
                </span>
              </div>
            </div>
            <div className="relative h-8 rounded-xl overflow-hidden bg-var(--c-ink-06)">
              {/* Total bar */}
              <motion.div
                className="absolute inset-y-0 left-0 rounded-xl"
                style={{ backgroundColor: "var(--c-ink-12)" }}
                initial={{ width: 0 }}
                animate={inView ? { width: `${totalPct}%` } : {}}
                transition={{
                  delay: 0.2 + i * 0.1,
                  duration: 1.1,
                  ease: [0.22, 1, 0.36, 1],
                }}
              />
              {/* Base bar */}
              <motion.div
                className="absolute inset-y-0 left-0 rounded-xl"
                style={{
                  background: `linear-gradient(90deg, var(--c-slate) 0%, var(--c-slate-2) 100%)`,
                }}
                initial={{ width: 0 }}
                animate={inView ? { width: `${basePct}%` } : {}}
                transition={{
                  delay: 0.35 + i * 0.1,
                  duration: 1.0,
                  ease: [0.22, 1, 0.36, 1],
                }}
              />
              {/* Hover label */}
              <div className="absolute inset-0 flex items-center px-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[10px] font-bold text-white drop-shadow">
                  Equity ~{fmt(Math.round(d.equity * multiplier))} · Bonus ~
                  {fmt(Math.round(d.bonus * multiplier))}
                </span>
              </div>
            </div>
          </motion.div>
        );
      })}

      {/* Legend */}
      <div className="flex items-center gap-5 pt-2">
        <div className="flex items-center gap-1.5">
          <div
            className="w-3 h-3 rounded-sm"
            style={{
              background:
                "linear-gradient(90deg, var(--c-slate), var(--c-slate-2))",
            }}
          />
          <span className="text-[11px] text-var(--c-ink-40)">Base salary</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-var(--c-ink-12)" />
          <span className="text-[11px] text-var(--c-ink-40)">
            Total comp (incl. equity + bonus)
          </span>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════
   SALARY CALCULATOR CARD
═══════════════════════════════════════════════ */
const SalaryCalculator = () => {
  const [role, setRole] = useState("Software Engineer");
  const [level, setLevel] = useState("Senior");
  const [location, setLocation] = useState("San Francisco");
  const [yoe, setYoe] = useState(5);

  const multiplier = LOCATION_MULTIPLIER[location] || 1;
  const data =
    SALARY_DATA[role]?.[level] || SALARY_DATA["Software Engineer"]["Senior"];
  const base = Math.round(data.base * multiplier);
  const equity = Math.round(data.equity * multiplier);
  const bonus = Math.round(data.bonus * multiplier);
  const total = base + equity + bonus;

  const breakdown = [
    {
      label: "Base Salary",
      value: base,
      color: "var(--c-slate)",
      pct: (base / total) * 100,
    },
    {
      label: "Annual Equity",
      value: equity,
      color: "var(--c-violet)",
      pct: (equity / total) * 100,
    },
    {
      label: "Bonus",
      value: bonus,
      color: "var(--c-amber)",
      pct: (bonus / total) * 100,
    },
  ];

  const SelectBox = ({ value, onChange, options, icon: Icon }) => (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
        <Icon size={14} style={{ color: "var(--c-ink-40)" }} />
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-9 pr-8 py-2.5 text-sm font-medium rounded-xl border bg-white cursor-pointer focus:outline-none transition-shadow"
        style={{
          borderColor: "var(--c-border)",
          color: "var(--c-ink)",
          boxShadow: "var(--sh-sm)",
        }}
      >
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
      <ChevronDown
        size={13}
        className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: "var(--c-ink-40)" }}
      />
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-3xl border border-var(--c-border) overflow-hidden shadow-var(--sh-xl) bg-white"
    >
      {/* Header */}
      <div
        className="relative px-8 pt-8 pb-6 overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, var(--c-slate) 0%, var(--c-slate-2) 60%, var(--c-slate-3) 100%)",
        }}
      >
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        <div
          className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[100px] opacity-20 pointer-events-none"
          style={{ backgroundColor: "var(--c-amber)" }}
        />
        <div className="relative">
          <Pill color="amber" className="mb-3">
            <Sparkles size={10} /> Salary Calculator
          </Pill>
          <h3 className="text-2xl font-black text-white leading-tight mb-1">
            What should you earn?
          </h3>
          <p className="text-white/50 text-sm">
            Adjust role, level & location for personalised estimates.
          </p>
        </div>
      </div>

      <div className="p-8">
        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          <SelectBox
            value={role}
            onChange={setRole}
            options={ROLES}
            icon={Briefcase}
          />
          <SelectBox
            value={level}
            onChange={setLevel}
            options={LEVELS}
            icon={GraduationCap}
          />
          <SelectBox
            value={location}
            onChange={setLocation}
            options={LOCATIONS}
            icon={MapPin}
          />
        </div>

        {/* Big number */}
        <div className="text-center mb-8 py-6 rounded-2xl bg-var(--c-cream) border border-var(--c-border) relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "linear-gradient(var(--c-border) 1px,transparent 1px),linear-gradient(90deg,var(--c-border) 1px,transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />
          <p className="relative text-xs uppercase tracking-[0.3em] font-bold text-var(--c-ink-40) mb-2">
            Estimated Total Comp
          </p>
          <AnimatedNumber
            value={total}
            className="relative block text-5xl sm:text-6xl font-black text-var(--c-ink) leading-none"
            style={{ fontFamily: "'Playfair Display', serif" }}
          />
          <p className="relative text-xs text-var(--c-ink-40) mt-2 font-medium">
            per year · {location}
          </p>

          {/* Live dot */}
          <div className="absolute top-3 right-3 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-var(--c-sage) pulse-ring" />
            <span className="text-[10px] font-semibold text-var(--c-sage)">
              Live data
            </span>
          </div>
        </div>

        {/* Breakdown bars */}
        <div className="space-y-3 mb-6">
          {breakdown.map((item, i) => (
            <div key={item.label}>
              <div className="flex justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs font-semibold text-var(--c-ink-70)">
                    {item.label}
                  </span>
                </div>
                <AnimatedNumber
                  value={item.value}
                  className="text-xs font-bold text-var(--c-ink)"
                />
              </div>
              <div className="h-2 rounded-full bg-var(--c-ink-06) overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: item.color }}
                  initial={{ width: 0 }}
                  whileInView={{ width: `${item.pct}%` }}
                  viewport={{ once: true }}
                  transition={{
                    delay: 0.3 + i * 0.1,
                    duration: 1.0,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <Link to="/interview">
          <motion.div
            whileHover={{ y: -2, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-3.5 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2 cursor-pointer"
            style={{
              background:
                "linear-gradient(135deg, var(--c-slate) 0%, var(--c-slate-2) 100%)",
              boxShadow: "0 8px 28px rgba(13,13,18,0.18)",
            }}
          >
            Practice for this role <ArrowRight size={14} />
          </motion.div>
        </Link>
      </div>
    </motion.div>
  );
};

/* ═══════════════════════════════════════════════
   STAT CARD
═══════════════════════════════════════════════ */
const StatCard = ({ icon: Icon, color, bg, value, label, sub, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20, scale: 0.97 }}
    whileInView={{ opacity: 1, y: 0, scale: 1 }}
    viewport={{ once: true }}
    transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    className="hover-lift bg-white rounded-3xl border border-var(--c-border) shadow-var(--sh-sm) p-6 flex flex-col gap-3"
  >
    <div
      className="w-11 h-11 rounded-2xl flex items-center justify-center"
      style={{ backgroundColor: bg }}
    >
      <Icon size={20} style={{ color }} />
    </div>
    <div>
      <p
        className="text-2xl font-black text-var(--c-ink) leading-none"
        style={{ fontFamily: "'Playfair Display', serif" }}
      >
        {value}
      </p>
      <p className="text-sm font-semibold text-var(--c-ink-70) mt-1">{label}</p>
      {sub && <p className="text-xs text-var(--c-ink-40) mt-0.5">{sub}</p>}
    </div>
  </motion.div>
);

/* ═══════════════════════════════════════════════
   COMPANY ROW
═══════════════════════════════════════════════ */
const CompanyRow = ({ company, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ delay, duration: 0.45 }}
    className="group flex items-center gap-4 p-4 rounded-2xl border border-var(--c-border) bg-white hover:shadow-var(--sh-md) hover:border-var(--c-ink-12) transition-all duration-200 cursor-pointer"
  >
    <div
      className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-black shrink-0 shadow-sm"
      style={{ backgroundColor: company.color }}
    >
      {company.logo}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-bold text-var(--c-ink) leading-none">
        {company.name}
      </p>
      <p className="text-[11px] text-var(--c-ink-40) mt-0.5">
        {company.yoe} experience
      </p>
    </div>
    <div className="text-right shrink-0">
      <p
        className="text-sm font-black text-var(--c-ink)"
        style={{ fontFamily: "'Playfair Display',serif" }}
      >
        {fmt(company.avg)}
      </p>
      <p className="text-[10px] text-var(--c-ink-40)">avg total comp</p>
    </div>
    <div className="flex items-center gap-1 shrink-0">
      <Star size={11} className="fill-var(--c-amber)] text-[var(--c-amber)" />
      <span className="text-xs font-bold text-var(--c-ink)">
        {company.interview}
      </span>
    </div>
    <ArrowUpRight
      size={14}
      className="text-(--c-ink-40) opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
    />
  </motion.div>
);

/* ═══════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════ */
const SalaryPage = () => {
  const [chartRole, setChartRole] = useState("Software Engineer");
  const [chartLocation, setChartLocation] = useState("San Francisco");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredRoles = ROLES.filter((r) =>
    r.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="salary-root min-h-screen bg-white">
      <style>{TOKENS}</style>

      {/* ══════════════════════════════════════════
          HERO
      ══════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-var(--c-cream) pt-20 pb-32 px-6">
        {/* Grid texture */}
        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              "linear-gradient(var(--c-border) 1px,transparent 1px),linear-gradient(90deg,var(--c-border) 1px,transparent 1px)",
            backgroundSize: "52px 52px",
          }}
        />
        {/* Glows */}
        <div className="absolute top-[-10%] right-[-5%] w-125 h-125 rounded-full bg-amber-100 blur-[140px] opacity-60 pointer-events-none" />
        <div className="absolute bottom-[-15%] left-[-5%] w-100 h-100 rounded-full bg-violet-100 blur-[110px] opacity-50 pointer-events-none" />

        <div className="relative mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Left */}
            <div>
              <motion.div
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65 }}
              >
                <Pill color="amber" className="mb-6">
                  <BarChart2 size={11} /> 2025 Salary Intelligence
                </Pill>

                <h1 className="text-[clamp(2.6rem,5vw,4rem)] font-black leading-[1.05] tracking-tight text-(--c-ink) mb-6">
                  Know your{" "}
                  <span className="relative inline-block italic">
                    worth.
                    <svg
                      className="absolute -bottom-1 left-0 w-full"
                      viewBox="0 0 220 8"
                      fill="none"
                      preserveAspectRatio="none"
                    >
                      <motion.path
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{
                          delay: 0.9,
                          duration: 0.7,
                          ease: "easeOut",
                        }}
                        d="M4 5 Q55 1 110 5 Q165 9 216 4"
                        stroke="#d97706"
                        strokeWidth="3"
                        strokeLinecap="round"
                        fill="none"
                      />
                    </svg>
                  </span>
                  <br />
                  <span className="text-(--c-slate-3)">Negotiate smarter.</span>
                </h1>

                <p className="text-(--c-ink-70) text-base leading-relaxed mb-8 max-w-md">
                  Real-time compensation data for 8 tech roles across top
                  companies and locations. Benchmark your salary before your
                  next negotiation.
                </p>

                <div className="flex flex-wrap items-center gap-3 mb-10">
                  <Link to="/salary/calculator">
                    <motion.div
                      whileHover={{ y: -2, scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      className="inline-flex items-center gap-2.5 text-white px-7 py-3.5 rounded-2xl text-sm font-bold cursor-pointer"
                      style={{
                        background:
                          "linear-gradient(135deg, var(--c-slate) 0%, var(--c-slate-2) 100%)",
                        boxShadow: "0 8px 28px rgba(13,13,18,0.22)",
                      }}
                    >
                      <span
                        className="w-6 h-6 rounded-lg flex items-center justify-center"
                        style={{
                          backgroundColor: "var(--c-sage)",
                          boxShadow: "0 2px 8px rgba(5,150,105,0.4)",
                        }}
                      >
                        <DollarSign size={13} />
                      </span>
                      Check My Salary
                      <ArrowRight size={14} />
                    </motion.div>
                  </Link>
                  <Link to="/interview">
                    <motion.div
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.97 }}
                      className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-semibold border cursor-pointer"
                      style={{
                        borderColor: "var(--c-border)",
                        backgroundColor: "white",
                        color: "var(--c-ink-70)",
                        boxShadow: "var(--sh-sm)",
                      }}
                    >
                      <Zap size={14} style={{ color: "var(--c-amber)" }} />
                      Practice Interview
                    </motion.div>
                  </Link>
                </div>

                {/* Trust row */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6, duration: 0.5 }}
                  className="flex flex-wrap items-center gap-6 pt-6 border-t border-(--c-border)"
                >
                  {[
                    { val: "8 roles", sub: "tracked" },
                    { val: "5 cities", sub: "covered" },
                    { val: "Updated", sub: "monthly" },
                  ].map((s) => (
                    <div key={s.val}>
                      <p
                        className="text-base font-black text-(--c-ink)"
                        style={{ fontFamily: "'Playfair Display',serif" }}
                      >
                        {s.val}
                      </p>
                      <p className="text-[11px] text-(--c-ink-40)">{s.sub}</p>
                    </div>
                  ))}
                </motion.div>
              </motion.div>
            </div>

            {/* Right — floating stat cards */}
            <div className="hidden lg:block relative h-80">
              {/* Large highlight */}
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  delay: 0.2,
                  duration: 0.6,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="float-slow absolute top-0 right-0 w-64 bg-white rounded-3xl border border-var(--c-border) shadow-var(--sh-xl) p-6"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-var(--c-sage-l) flex items-center justify-center">
                    <TrendingUp size={15} style={{ color: "var(--c-sage)" }} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-var(--c-ink-40) uppercase tracking-wider">
                      Senior ML Eng.
                    </p>
                    <p className="text-[10px] text-var(--c-ink-40)">
                      San Francisco
                    </p>
                  </div>
                </div>
                <p
                  className="text-3xl font-black text-var(--c-ink) leading-none mb-1"
                  style={{ fontFamily: "'Playfair Display',serif" }}
                >
                  $315K
                </p>
                <p className="text-[11px] text-var(--c-sage) font-semibold flex items-center gap-1">
                  <TrendingUp size={10} /> +18% YoY
                </p>
              </motion.div>

              {/* Bottom left card */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  delay: 0.45,
                  duration: 0.55,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="absolute bottom-0 left-0 w-52 bg-white rounded-3xl border border-var(--c-border) shadow-var(--sh-lg) p-5"
                style={{ animation: "float-slow 7s ease-in-out 1.5s infinite" }}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-var(--c-ink-40) mb-3">
                  Top Payers 2025
                </p>
                {["Meta $310K", "Stripe $295K", "Google $285K"].map((s, i) => (
                  <div
                    key={s}
                    className="flex items-center gap-2 py-1 border-b border-var(--c-border) last:border-0"
                  >
                    <span
                      className="text-xs font-bold text-var(--c-slate)"
                      style={{ minWidth: 14 }}
                    >
                      {i + 1}
                    </span>
                    <span className="text-xs text-var(--c-ink-70)">{s}</span>
                  </div>
                ))}
              </motion.div>

              {/* Middle right badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.65, type: "spring" }}
                className="absolute top-1/2 left-8 -translate-y-1/2 flex items-center gap-2 bg-white rounded-2xl px-4 py-2.5 border border-var(--c-border) shadow-var(--sh-md)"
              >
                <div className="w-7 h-7 rounded-lg bg-var(--c-amber-l) flex items-center justify-center">
                  <Award size={13} style={{ color: "var(--c-amber)" }} />
                </div>
                <div>
                  <p className="text-xs font-bold text-var(--c-ink)">
                    Avg. +$42K
                  </p>
                  <p className="text-[10px] text-var(--c-ink-40)">
                    after negotiation
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          STATS ROW
      ══════════════════════════════════════════ */}
      <section className="relative py-14 px-6 border-b border-var(--c-border) bg-white">
        <div className="mx-auto max-w-7xl grid grid-cols-2 sm:grid-cols-4 gap-5">
          {[
            {
              icon: DollarSign,
              color: "var(--c-sage)",
              bg: "var(--c-sage-l)",
              value: "$285K",
              label: "Avg. Senior Total Comp",
              sub: "SF Bay Area · 2025",
            },
            {
              icon: TrendingUp,
              color: "var(--c-violet)",
              bg: "var(--c-violet-l)",
              value: "+14%",
              label: "YoY salary growth",
              sub: "ML & AI roles",
            },
            {
              icon: Users,
              color: "var(--c-sky)",
              bg: "var(--c-sky-l)",
              value: "8 roles",
              label: "Roles benchmarked",
              sub: "Across 5 locations",
            },
            {
              icon: Building2,
              color: "var(--c-amber)",
              bg: "var(--c-amber-l)",
              value: "6 firms",
              label: "Top companies",
              sub: "FAANG + Stripe",
            },
          ].map((s, i) => (
            <StatCard key={s.label} {...s} delay={i * 0.08} />
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          CALCULATOR + CHART
      ══════════════════════════════════════════ */}
      <section className="relative py-28 px-6 overflow-hidden bg-var(--c-cream)">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(var(--c-border) 1px,transparent 1px),linear-gradient(90deg,var(--c-border) 1px,transparent 1px)",
            backgroundSize: "52px 52px",
          }}
        />
        <div
          className="absolute top-0 right-0 w-125 h-125 rounded-full blur-[160px] opacity-20 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, var(--c-violet-l), transparent 70%)",
          }}
        />

        <div className="relative mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          {/* Calculator */}
          <SalaryCalculator />

          {/* Chart panel */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="bg-white rounded-3xl border border-var(--c-border) shadow-var(--sh-lg) overflow-hidden"
          >
            <div className="px-7 pt-7 pb-5 border-b border-var(--c-border)">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <Pill color="sky" className="mb-2">
                    <BarChart2 size={10} /> Salary Spectrum
                  </Pill>
                  <h3 className="text-xl font-black text-var(--c-ink)">
                    Level-by-level breakdown
                  </h3>
                  <p className="text-sm text-var(--c-ink-40) mt-0.5">
                    Hover bars to reveal equity & bonus detail
                  </p>
                </div>
                {/* Chart filters */}
                <div className="flex gap-2">
                  <div className="relative">
                    <select
                      value={chartRole}
                      onChange={(e) => setChartRole(e.target.value)}
                      className="text-xs font-semibold pl-3 pr-6 py-2 rounded-xl border bg-var(--c-cream) cursor-pointer focus:outline-none"
                      style={{
                        borderColor: "var(--c-border)",
                        color: "var(--c-ink)",
                      }}
                    >
                      {ROLES.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                    <ChevronDown
                      size={11}
                      className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ color: "var(--c-ink-40)" }}
                    />
                  </div>
                  <div className="relative">
                    <select
                      value={chartLocation}
                      onChange={(e) => setChartLocation(e.target.value)}
                      className="text-xs font-semibold pl-3 pr-6 py-2 rounded-xl border bg-var(--c-cream) cursor-pointer focus:outline-none"
                      style={{
                        borderColor: "var(--c-border)",
                        color: "var(--c-ink)",
                      }}
                    >
                      {LOCATIONS.map((l) => (
                        <option key={l}>{l}</option>
                      ))}
                    </select>
                    <ChevronDown
                      size={11}
                      className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ color: "var(--c-ink-40)" }}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="p-7">
              <AnimatePresence mode="wait">
                <motion.div
                  key={chartRole + chartLocation}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <SalaryBarChart role={chartRole} location={chartLocation} />
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          TRENDING ROLES
      ══════════════════════════════════════════ */}
      <section className="relative py-20 px-6 bg-white overflow-hidden border-t border-var(--c-border)">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
            <SectionHeading
              label="Trending 2025"
              title={"Fastest-growing\nroles right now."}
            />
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="shrink-0 mb-12"
            >
              <Link
                to="/salary/trends"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-var(--c-border) bg-white text-sm font-semibold text-var(--c-ink-70) hover:shadow-var(--sh-md) transition-all shadow-var(--sh-sm)"
              >
                All trends <ChevronRight size={15} />
              </Link>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {TRENDING.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 24, scale: 0.97 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true }}
                transition={{
                  delay: i * 0.09,
                  duration: 0.5,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <motion.div
                  whileHover={{ y: -5, scale: 1.015 }}
                  transition={{ type: "spring", stiffness: 320, damping: 22 }}
                  className="group relative overflow-hidden rounded-3xl border border-var(--c-border) bg-var(--c-cream) shadow-var(--sh-sm) hover:shadow-var(--sh-lg) p-6 flex flex-col gap-4 transition-shadow duration-300 cursor-pointer"
                >
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-3xl"
                    style={{
                      background: `radial-gradient(ellipse at top left, ${item.bg} 0%, transparent 65%)`,
                    }}
                  />
                  <div className="relative flex items-center justify-between">
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center"
                      style={{ backgroundColor: item.bg }}
                    >
                      <item.icon size={20} style={{ color: item.color }} />
                    </div>
                    <span
                      className="text-xs font-bold px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: item.bg, color: item.color }}
                    >
                      {item.growth}
                    </span>
                  </div>
                  <div className="relative">
                    <p className="font-bold text-var(--c-ink) text-base leading-snug">
                      {item.title}
                    </p>
                    <p className="text-xs text-var(--c-ink-40) mt-1">
                      YoY salary growth
                    </p>
                  </div>
                  <div className="relative pt-3 border-t border-var(--c-border) flex items-center justify-between">
                    <span
                      className="text-xs font-bold"
                      style={{ color: item.color }}
                    >
                      View salaries
                    </span>
                    <ArrowRight
                      size={13}
                      style={{ color: item.color }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          TOP COMPANIES TABLE
      ══════════════════════════════════════════ */}
      <section className="relative py-28 px-6 bg-var(--c-cream) overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "radial-gradient(circle, var(--c-border) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        <div className="relative mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-14 items-start">
          {/* Left: table */}
          <div>
            <SectionHeading
              label="Top Companies"
              title={"Where engineers\nearn the most."}
              subtitle="Average total compensation for senior software roles."
            />
            <div className="space-y-2.5">
              {COMPANY_DATA.map((c, i) => (
                <CompanyRow key={c.name} company={c} delay={i * 0.07} />
              ))}
            </div>
          </div>

          {/* Right: insight cards */}
          <div className="space-y-5 pt-2">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55 }}
              className="rounded-3xl overflow-hidden border border-var(--c-border) shadow-var(--sh-lg)"
              style={{
                background:
                  "linear-gradient(135deg, var(--c-slate) 0%, var(--c-slate-2) 60%, var(--c-slate-3) 100%)",
              }}
            >
              <div className="relative p-7 overflow-hidden">
                <div
                  className="absolute inset-0 opacity-[0.07]"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle, white 1px, transparent 1px)",
                    backgroundSize: "22px 22px",
                  }}
                />
                <div
                  className="absolute top-0 right-0 w-48 h-48 rounded-full blur-[80px] opacity-20"
                  style={{ backgroundColor: "var(--c-amber)" }}
                />
                <div className="relative">
                  <p className="text-white/50 text-xs uppercase tracking-widest font-bold mb-3 flex items-center gap-2">
                    <Info size={11} /> Negotiation Insight
                  </p>
                  <p
                    className="text-xl font-black text-white leading-snug mb-4"
                    style={{ fontFamily: "'Playfair Display',serif" }}
                  >
                    "Candidates who practice salary negotiation earn{" "}
                    <span className="text-var(--c-amber)">$42K more</span> on
                    average at offer."
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-1.5">
                      {["#6366f1", "#f59e0b", "#10b981"].map((c) => (
                        <div
                          key={c}
                          className="w-7 h-7 rounded-full border-2 border-var(--c-slate-2)"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <p className="text-white/45 text-xs">
                      Based on 4,600+ user reports
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Tips */}
            {[
              {
                icon: "💡",
                title: "Know your BATNA",
                body: "Research competing offers before negotiating. Having alternatives is your strongest leverage.",
              },
              {
                icon: "🎯",
                title: "Anchor high, justify well",
                body: "Start 15–20% above target. Back it with market data from this page.",
              },
              {
                icon: "📊",
                title: "Total comp, not just base",
                body: "Equity refresh cycles, signing bonuses, and RSU cliffs all affect your real take-home.",
              },
            ].map((tip, i) => (
              <motion.div
                key={tip.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.15 + i * 0.1, duration: 0.45 }}
                className="flex items-start gap-4 p-5 rounded-2xl bg-white border border-var(--c-border) shadow-var(--sh-sm) hover:shadow-var(--sh-md) transition-shadow duration-200"
              >
                <span className="text-2xl leading-none mt-0.5">{tip.icon}</span>
                <div>
                  <p className="text-sm font-bold text-var(--c-ink) mb-1">
                    {tip.title}
                  </p>
                  <p className="text-xs text-var(--c-ink-70) leading-relaxed">
                    {tip.body}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          ROLE EXPLORER
      ══════════════════════════════════════════ */}
      <section className="relative py-24 px-6 bg-white border-t border-var(--c-border)">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
            <SectionHeading
              label="Role Explorer"
              title={"Browse all\nrole salaries."}
            />
            {/* Search */}
            <div className="relative mb-12 sm:mb-0 shrink-0 w-full sm:w-64">
              <Search
                size={14}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: "var(--c-ink-40)" }}
              />
              <input
                type="text"
                placeholder="Search roles…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border focus:outline-none transition-shadow"
                style={{
                  borderColor: "var(--c-border)",
                  color: "var(--c-ink)",
                  boxShadow: "var(--sh-sm)",
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredRoles.map((role, i) => {
                const d = SALARY_DATA[role];
                const senior = d?.["Senior"];
                const multiplier = 1.0; // SF default
                const base = senior ? Math.round(senior.base * multiplier) : 0;
                const total = senior
                  ? Math.round(senior.total * multiplier)
                  : 0;

                return (
                  <motion.div
                    key={role}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{
                      delay: i * 0.06,
                      duration: 0.4,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  >
                    <motion.div
                      whileHover={{ y: -4, scale: 1.01 }}
                      transition={{
                        type: "spring",
                        stiffness: 320,
                        damping: 22,
                      }}
                      className="group relative overflow-hidden rounded-2xl border border-var(--c-border) bg-var(--c-cream) shadow-var(--sh-sm) hover:shadow-var(--sh-lg) p-5 flex flex-col gap-3 cursor-pointer transition-shadow duration-300"
                    >
                      <div
                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none rounded-2xl"
                        style={{
                          background:
                            "radial-gradient(ellipse at top left, var(--c-amber-l) 0%, transparent 65%)",
                        }}
                      />
                      <div className="relative flex items-start justify-between gap-2">
                        <div className="w-9 h-9 rounded-xl bg-var(--c-ink-12) flex items-center justify-center shrink-0">
                          <Layers
                            size={16}
                            style={{ color: "var(--c-ink-70)" }}
                          />
                        </div>
                        <ArrowUpRight
                          size={14}
                          className="text-var(--c-ink-40) opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        />
                      </div>
                      <div className="relative">
                        <p className="text-sm font-bold text-var(--c-ink) leading-snug mb-1">
                          {role}
                        </p>
                        <p className="text-[11px] text-var(--c-ink-40)">
                          Senior · SF
                        </p>
                      </div>
                      <div className="relative pt-3 border-t border-var(--c-border)">
                        <p
                          className="text-xl font-black text-var(--c-ink) leading-none"
                          style={{ fontFamily: "'Playfair Display',serif" }}
                        >
                          {fmt(total)}
                        </p>
                        <p className="text-[10px] text-var(--c-ink-40) mt-0.5">
                          {fmt(base)} base · total comp
                        </p>
                      </div>
                    </motion.div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          CTA BANNER
      ══════════════════════════════════════════ */}
      <section
        className="relative py-28 overflow-hidden"
        style={{ backgroundColor: "var(--c-slate)" }}
      >
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div
          className="absolute top-[-30%] left-1/2 -translate-x-1/2 w-175 h-100 rounded-full blur-[160px] opacity-20 pointer-events-none"
          style={{ backgroundColor: "var(--c-amber)" }}
        />
        <div
          className="absolute bottom-[-20%] right-[-5%] w-100 h-100 rounded-full blur-[120px] opacity-10 pointer-events-none"
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
            <Zap size={11} /> Free · No card required
          </Pill>
          <h2 className="text-4xl sm:text-6xl font-black text-white mb-5 tracking-tight leading-[1.04]">
            Earn what you
            <br />
            actually deserve.
          </h2>
          <p className="text-white/50 mb-10 max-w-md mx-auto text-base leading-relaxed">
            Practice salary negotiation, interview skills, and compensation
            conversations with AI coaching before your next offer.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/interview">
              <motion.div
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white font-bold text-sm rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer"
                style={{ color: "var(--c-slate)" }}
              >
                Start Practising <ArrowRight size={15} />
              </motion.div>
            </Link>
            <Link to="/salary">
              <motion.div
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 font-bold text-sm rounded-xl transition-all cursor-pointer border"
                style={{
                  backgroundColor: "rgba(255,255,255,0.08)",
                  borderColor: "rgba(255,255,255,0.15)",
                  color: "rgba(255,255,255,0.75)",
                }}
              >
                <BarChart2 size={15} /> Explore Salaries
              </motion.div>
            </Link>
          </div>

          <div className="mt-16 flex flex-wrap justify-center gap-12">
            {[
              { Icon: Award, value: "$42K", label: "Avg. salary uplift" },
              { Icon: Users, value: "4,600+", label: "Negotiations coached" },
              {
                Icon: TrendingUp,
                value: "92%",
                label: "Offer acceptance rate",
              },
            ].map(({ Icon, value, label }) => (
              <div key={label} className="text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Icon size={13} className="text-var(--c-amber)" />
                  <p
                    className="text-2xl font-black text-white"
                    style={{ fontFamily: "'Playfair Display',serif" }}
                  >
                    {value}
                  </p>
                </div>
                <p className="text-xs text-white/35">{label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>
    </div>
  );
};

export default SalaryPage;

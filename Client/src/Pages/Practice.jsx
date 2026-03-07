import React, { memo, useState } from "react";
import { motion, useInView, AnimatePresence } from "motion/react";
import { Link } from "react-router-dom";
import { useRef } from "react";
import clsx from "clsx";
import {
  Mic,
  BarChart3,
  Target,
  Zap,
  Clock,
  Star,
  CheckCircle,
  ArrowRight,
  Sparkles,
  Award,
  TrendingUp,
  Users,
  Brain,
  BookOpen,
  ChevronRight,
  Coins,
  Lock,
  RefreshCw,
  CalendarClock,
  X,
} from "lucide-react";

/* ═══════════════════════════════════════════════
   DESIGN TOKENS  (identical to homepage)
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

  .interview-root { font-family: 'DM Sans', sans-serif; }
  .interview-root h1,
  .interview-root h2,
  .interview-root h3 { font-family: 'Playfair Display', Georgia, serif; }

  .feature-card:hover .feature-icon-wrap::after {
    content: '';
    position: absolute; inset: 0; border-radius: inherit;
    background: linear-gradient(135deg, rgba(255,255,255,0.4) 0%, transparent 60%);
    pointer-events: none;
  }
  .feature-icon-wrap { position: relative; }

  @keyframes marquee-scroll {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
  }
  .marquee-track { animation: marquee-scroll 36s linear infinite; }
  .marquee-track:hover { animation-play-state: paused; }

  @keyframes float-card {
    0%, 100% { transform: translateY(0px); }
    50%       { transform: translateY(-8px); }
  }

  @keyframes credit-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(217,119,6,0.3); }
    50%       { box-shadow: 0 0 0 8px rgba(217,119,6,0); }
  }
  .credit-pulse { animation: credit-pulse 2.4s ease-in-out infinite; }

  @keyframes shimmer {
    0%   { background-position: -200% center; }
    100% { background-position:  200% center; }
  }
  .shimmer-bar {
    background: linear-gradient(90deg, var(--c-amber-l) 25%, #fff8e1 50%, var(--c-amber-l) 75%);
    background-size: 200% auto;
    animation: shimmer 2s linear infinite;
  }

  .modal-backdrop { backdrop-filter: blur(6px); }

  @keyframes count-up {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

/* ═══════════════════════════════════════════════
   FREE MONTHLY CREDIT CONFIG
═══════════════════════════════════════════════ */
const MONTHLY_CREDITS = 10; // free credits every user gets per month

// Compute days until 1st of next month
const getDaysUntilReset = () => {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return Math.ceil((next - now) / (1000 * 60 * 60 * 24));
};

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

const SectionHeading = ({ label, title, subtitle, center = false }) => (
  <div className={clsx("mb-12", center && "text-center")}>
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
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
   CREDIT INFO POPOVER
═══════════════════════════════════════════════ */
const CreditPopover = ({ onClose }) => {
  const daysLeft = getDaysUntilReset();
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.93, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.93, y: -6 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="absolute top-full left-0 mt-2 z-50 w-72 rounded-2xl border border-var(--c-border) bg-white shadow-var(--sh-lg) overflow-hidden"
    >
      {/* Header */}
      <div
        className="relative px-5 pt-5 pb-4 overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, var(--c-slate) 0%, var(--c-slate-2) 100%)",
        }}
      >
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center"
          style={{
            backgroundColor: "rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.5)",
          }}
        >
          <X size={12} />
        </button>
        <div className="relative flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-var(--c-amber-l) flex items-center justify-center shrink-0">
            <Coins size={16} style={{ color: "var(--c-amber)" }} />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none">
              Monthly Credits
            </p>
            <p className="text-[11px] text-white/50 mt-0.5">
              Free for every user, every month
            </p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {[
          {
            icon: "🎯",
            text: `${MONTHLY_CREDITS} sessions gifted on the 1st of each month`,
          },
          {
            icon: "🔄",
            text: "Credits auto-refill — nothing to buy or redeem",
          },
          {
            icon: "⚡",
            text: "Each session = 1 credit: question → record → score",
          },
          {
            icon: "📅",
            text: `Resets in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`,
          },
        ].map(({ icon, text }) => (
          <div key={text} className="flex items-start gap-2.5">
            <span className="text-base leading-none mt-0.5">{icon}</span>
            <p className="text-xs text-var(--c-ink-70) leading-relaxed">
              {text}
            </p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        className="px-4 py-3 border-t border-var(--c-border) flex items-center gap-1.5"
        style={{ backgroundColor: "var(--c-cream)" }}
      >
        <RefreshCw size={10} style={{ color: "var(--c-ink-40)" }} />
        <p className="text-[10px] text-var(--c-ink-40)">
          Unused credits don't roll over to next month
        </p>
      </div>
    </motion.div>
  );
};

/* ═══════════════════════════════════════════════
   CREDIT WIDGET  — floating pill in hero
═══════════════════════════════════════════════ */
const CreditWidget = ({ credits, total }) => {
  const [open, setOpen] = useState(false);
  const isEmpty = credits === 0;
  const low = credits <= 2 && !isEmpty;
  const daysLeft = getDaysUntilReset();
  const segments = Array.from({ length: total }, (_, i) => i < credits);

  return (
    <div className="relative">
      <motion.button
        onClick={() => setOpen((v) => !v)}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        className={clsx(
          "inline-flex items-center gap-3 px-4 py-2.5 rounded-2xl border transition-all duration-300 cursor-pointer select-none",
          isEmpty
            ? "border-var(--c-rose) bg-var(--c-rose-l)"
            : low
              ? "border-var(--c-amber) bg-var(--c-amber-l) credit-pulse"
              : "border-var(--c-border) bg-white shadow-var(--sh-sm) hover:shadow-var(--sh-md)",
        )}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{
            backgroundColor: isEmpty ? "var(--c-rose-l)" : "var(--c-amber-l)",
          }}
        >
          {isEmpty ? (
            <Lock size={13} style={{ color: "var(--c-rose)" }} />
          ) : (
            <Coins size={13} style={{ color: "var(--c-amber)" }} />
          )}
        </div>
        <div className="text-left leading-none">
          <p
            className="text-xs font-bold"
            style={{
              color: isEmpty
                ? "var(--c-rose)"
                : low
                  ? "var(--c-amber)"
                  : "var(--c-ink)",
            }}
          >
            {isEmpty ? "No credits left" : `${credits} / ${total} credits`}
          </p>
          <p
            className="text-[10px] mt-0.5 flex items-center gap-1"
            style={{ color: "var(--c-ink-40)" }}
          >
            <CalendarClock size={9} />
            {isEmpty ? `Refills in ${daysLeft}d` : "resets monthly · free"}
          </p>
        </div>
        <div className="flex items-center gap-0.75 shrink-0">
          {segments.map((filled, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                delay: 0.3 + i * 0.04,
                type: "spring",
                stiffness: 400,
                damping: 20,
              }}
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: filled
                  ? isEmpty
                    ? "var(--c-rose)"
                    : low
                      ? "var(--c-amber)"
                      : "var(--c-sage)"
                  : "var(--c-ink-12)",
              }}
            />
          ))}
        </div>
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            <div className="relative z-50">
              <CreditPopover onClose={() => setOpen(false)} />
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ═══════════════════════════════════════════════
   ANIMATED SCORE PREVIEW CARD  (hero right col)
═══════════════════════════════════════════════ */
const ScorePreviewCard = memo(() => {
  const bars = [
    { label: "Clarity", value: 91, color: "var(--c-violet)" },
    { label: "Depth", value: 85, color: "var(--c-sky)" },
    { label: "Structure", value: 97, color: "var(--c-sage)" },
    { label: "Delivery", value: 88, color: "var(--c-amber)" },
  ];
  const r = 40,
    circ = 2 * Math.PI * r;
  const dash = (90 / 100) * circ;

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}
      className="relative w-full max-w-100 mx-auto"
    >
      {/* Floating badge – top right */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.7, type: "spring" }}
        className="absolute -top-3 -right-3 z-10 flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-var(--c-border) shadow-var(--sh-lg)"
      >
        <div className="w-7 h-7 rounded-lg bg-var(--c-sage-l) flex items-center justify-center">
          <CheckCircle size={13} className="text-var(--c-sage)" />
        </div>
        <div className="leading-none">
          <p className="text-xs font-bold text-var(--c-ink)">92% Pass Rate</p>
          <p className="text-[10px] text-var(--c-ink-40) mt-0.5">
            after practice
          </p>
        </div>
      </motion.div>

      {/* Floating badge – bottom left */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.9, type: "spring" }}
        className="absolute -bottom-3 -left-3 z-10 flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-var(--c-border) shadow-var(--sh-lg)"
      >
        <div className="w-7 h-7 rounded-lg bg-var(--c-amber-l) flex items-center justify-center">
          <TrendingUp size={13} className="text-var(--c-amber)" />
        </div>
        <div className="leading-none">
          <p className="text-xs font-bold text-var(--c-ink)">+28 pts avg</p>
          <p className="text-[10px] text-var(--c-ink-40) mt-0.5">
            score improvement
          </p>
        </div>
      </motion.div>
      {/* Main card */}
      <div
        className="bg-white rounded-3xl border border-var(--c-border) shadow-var(--sh-xl) p-6"
        style={{ animation: "float-card 5s ease-in-out infinite" }}
      >
        {/* Question snippet */}
        <div className="mb-5 p-4 rounded-2xl bg-var(--c-cream) border border-var(--c-border) relative overflow-hidden">
          <div className="absolute top-1 right-3 text-5xl font-serif text-var(--c-ink) opacity-[0.04] select-none">
            "
          </div>
          <p className="text-[10px] uppercase tracking-widest font-bold text-var(--c-amber) mb-2 flex items-center gap-1.5">
            <span className="w-3 h-px bg-var(--c-amber)" /> Behavioral
          </p>
          <p className="text-sm font-semibold text-var(--c-ink) leading-snug">
            Tell me about a time you debugged a critical production issue under
            pressure.
          </p>
        </div>

        {/* Score ring + label */}
        <div className="flex items-center gap-4 mb-5">
          <div className="relative w-20 h-20 shrink-0">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 96 96">
              <circle
                cx="48"
                cy="48"
                r={r}
                fill="none"
                stroke="var(--c-border)"
                strokeWidth="7"
              />
              <motion.circle
                cx="48"
                cy="48"
                r={r}
                fill="none"
                stroke="var(--c-sage)"
                strokeWidth="7"
                strokeLinecap="round"
                initial={{ strokeDasharray: `0 ${circ}` }}
                animate={{ strokeDasharray: `${dash} ${circ}` }}
                transition={{
                  delay: 0.8,
                  duration: 1.4,
                  ease: [0.4, 0, 0.2, 1],
                }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className="text-xl font-black text-var(--c-ink)"
                style={{ fontFamily: "'Playfair Display',serif" }}
              >
                90
              </span>
              <span className="text-[9px] text-var(--c-ink-40) font-semibold">
                /100
              </span>
            </div>
          </div>
          <div>
            <Pill color="sage" className="mb-1.5">
              <Award size={10} /> Excellent
            </Pill>
            <p className="text-xs text-var(--c-ink-40) font-medium leading-snug max-w-40">
              Strong STAR structure with quantified outcomes.
            </p>
          </div>
        </div>

        {/* Mini bars */}
        <div className="space-y-2.5">
          {bars.map((bar, i) => (
            <div key={bar.label}>
              <div className="flex justify-between mb-1">
                <span className="text-[10px] font-semibold text-var(--c-ink-70)">
                  {bar.label}
                </span>
                <span className="text-[10px] font-bold text-var(--c-ink)">
                  {bar.value}
                </span>
              </div>
              <div className="h-1.5 bg-var(--c-ink-06) rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: bar.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${bar.value}%` }}
                  transition={{
                    delay: 1 + i * 0.12,
                    duration: 1.1,
                    ease: [0.4, 0, 0.2, 1],
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
});

/* ═══════════════════════════════════════════════
   FEATURES DATA
═══════════════════════════════════════════════ */
const FEATURES = [
  {
    Icon: Target,
    color: "var(--c-violet)",
    bg: "var(--c-violet-l)",
    title: "AI-Matched Questions",
    desc: "Questions are calibrated to your chosen role and experience level — no irrelevant noise.",
    stat: "6 roles · 4 formats",
  },
  {
    Icon: Mic,
    color: "var(--c-rose)",
    bg: "var(--c-rose-l)",
    title: "Voice Recording & Analysis",
    desc: "Answer out loud like a real interview. The AI analyses your clarity, depth, and delivery.",
    stat: "Real-time scoring",
  },
  {
    Icon: BarChart3,
    color: "var(--c-sky)",
    bg: "var(--c-sky-l)",
    title: "4-Dimension Scoring",
    desc: "Detailed breakdown across Clarity, Depth, Structure (STAR), and Confidence & Delivery.",
    stat: "Actionable breakdown",
  },
  {
    Icon: Brain,
    color: "var(--c-amber)",
    bg: "var(--c-amber-l)",
    title: "AI Coach Summary",
    desc: "Every session ends with a plain-language coach note on exactly what to improve next.",
    stat: "Specific, not generic",
  },
  {
    Icon: Clock,
    color: "var(--c-sage)",
    bg: "var(--c-sage-l)",
    title: "Session History",
    desc: "Track your scores over time. See which competencies are improving and which need work.",
    stat: "Full progress view",
  },
  {
    Icon: BookOpen,
    color: "var(--c-slate)",
    bg: "var(--c-ink-12)",
    title: "STAR Method Guidance",
    desc: "Built-in coaching prompts before each answer to keep your structure tight and impactful.",
    stat: "Every session",
  },
];

/* ═══════════════════════════════════════════════
   HOW IT WORKS STEPS
═══════════════════════════════════════════════ */
const STEPS = [
  {
    n: "01",
    Icon: Target,
    color: "var(--c-violet)",
    bg: "var(--c-violet-l)",
    title: "Pick Your Setup",
    desc: "Choose your target role, experience level, and interview format on the setup page.",
  },
  {
    n: "02",
    Icon: Brain,
    color: "var(--c-amber)",
    bg: "var(--c-amber-l)",
    title: "Read the Question",
    desc: "Our AI selects a real, calibrated interview question based on your choices.",
  },
  {
    n: "03",
    Icon: Mic,
    color: "var(--c-rose)",
    bg: "var(--c-rose-l)",
    title: "Record Your Answer",
    desc: "Speak naturally. The AI listens and analyses your response across four dimensions.",
  },
  {
    n: "04",
    Icon: Award,
    color: "var(--c-sage)",
    bg: "var(--c-sage-l)",
    title: "Get Scored Feedback",
    desc: "Receive strengths, improvement areas, and a coach summary. Repeat until it clicks.",
  },
];

/* ═══════════════════════════════════════════════
   TESTIMONIALS
═══════════════════════════════════════════════ */
const TESTIMONIALS = [
  {
    name: "Sarah Chen",
    role: "Sr. Engineer",
    company: "Stripe",
    av: "SC",
    avColor: "#6366f1",
    quote:
      "Talk2Hire's coaching pinpointed exactly where I was stumbling in system design rounds. Landed my Stripe offer after two weeks of targeted practice.",
    outcome: "Hired in 3 weeks",
    outcomeColor: "sage",
  },
  {
    name: "Marcus Johnson",
    role: "ML Engineer",
    company: "Waymo",
    av: "MJ",
    avColor: "#f59e0b",
    quote:
      "The AI feedback was brutally honest — exactly what I needed. Went from a 68 to a 95 score on behavioral questions after five sessions.",
    outcome: "+27 score boost",
    outcomeColor: "amber",
  },
  {
    name: "Priya Nair",
    role: "Backend Dev",
    company: "Shopify",
    av: "PN",
    avColor: "#10b981",
    quote:
      "I applied to 8 roles and got 6 first-round interviews. The practice built a level of confidence I genuinely didn't have before.",
    outcome: "6 of 8 interviews",
    outcomeColor: "sage",
  },
  {
    name: "Alex Rivera",
    role: "Frontend Eng.",
    company: "Vercel",
    av: "AR",
    avColor: "#ec4899",
    quote:
      "The STAR method coaching clicked after the third session. By session five I was structuring answers without even thinking about it.",
    outcome: "Hired in 5 weeks",
    outcomeColor: "violet",
  },
  {
    name: "Jordan Kim",
    role: "Platform Eng.",
    company: "Cloudflare",
    av: "JK",
    avColor: "#0ea5e9",
    quote:
      "Getting scored on Delivery was a game-changer. I never realised how much my pacing was hurting my answers until I saw it in the breakdown.",
    outcome: "Offer accepted",
    outcomeColor: "sky",
  },
];

/* ═══════════════════════════════════════════════
   PAGE COMPONENT
═══════════════════════════════════════════════ */
const MockInterviewPage = () => {
  // Credit state — simulated; in real app from context/API
  const [credits, setCredits] = useState(7); // 7 of 10 remaining (demo)

  const featuresRef = useRef(null);
  const featuresInView = useInView(featuresRef, {
    once: true,
    margin: "-80px",
  });

  return (
    <div className="interview-root min-h-screen bg-white">
      <style>{TOKENS}</style>

      {/* ══════════════════════════════════════════
          HERO
      ══════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-var(--c-cream) pt-20 pb-28 px-6">
        {/* Grid texture */}
        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              "linear-gradient(var(--c-border) 1px,transparent 1px),linear-gradient(90deg,var(--c-border) 1px,transparent 1px)",
            backgroundSize: "52px 52px",
          }}
        />
        {/* Ambient glows */}
        <div className="absolute top-[-15%] right-[-5%] w-120 h-120 rounded-full bg-amber-100 blur-[130px] opacity-70 pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-5%] w-90 h-90 rounded-full bg-violet-100 blur-[100px] opacity-55 pointer-events-none" />

        <div className="relative mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-2 items-center gap-16">
          {/* Left copy */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              {/* Top row: existing pill + credit widget */}
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <Pill color="amber">
                  <Sparkles size={11} /> AI-Powered Interview Practice
                </Pill>
                <CreditWidget credits={credits} total={MONTHLY_CREDITS} />
              </div>

              <h1 className="text-[clamp(2.5rem,5vw,3.9rem)] font-black leading-[1.07] tracking-tight text-var(--c-ink) mb-6">
                Practice until{" "}
                <span className="relative inline-block">
                  you're ready.
                  <svg
                    className="absolute -bottom-1 left-0 w-full"
                    viewBox="0 0 300 8"
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
                      d="M4 5 Q75 1 150 5 Q225 9 296 4"
                      stroke="#d97706"
                      strokeWidth="3"
                      strokeLinecap="round"
                      fill="none"
                    />
                  </svg>
                </span>
              </h1>

              <p className="text-var(--c-ink-70) text-base leading-relaxed mb-8 max-w-md">
                Real interview questions, AI-scored feedback, and detailed
                coaching across 6 roles and 4 formats. Build the confidence to
                walk in and own it.
              </p>

              {/* Primary CTA */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                {/* Primary — Start Practising */}
                <Link to="/interview">
                  <motion.div
                    whileHover={{ y: -2, scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 340, damping: 22 }}
                    className="inline-flex items-center gap-2.5 text-white px-7 py-3.5 rounded-2xl text-sm font-bold tracking-wide cursor-pointer"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--c-slate) 0%, var(--c-slate-2) 100%)",
                      boxShadow:
                        "0 8px 28px rgba(13,13,18,0.22), 0 2px 6px rgba(13,13,18,0.1)",
                    }}
                  >
                    <span
                      className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: "var(--c-rose)",
                        boxShadow: "0 2px 8px rgba(225,29,72,0.4)",
                      }}
                    >
                      <Mic size={13} />
                    </span>
                    Start Practising
                    <ArrowRight size={14} />
                  </motion.div>
                </Link>
              </div>

              {/* Credits remaining inline hint */}
              <div className="flex items-center gap-1.5 mb-10">
                <p
                  className="inline-flex items-center gap-1.5 text-xs font-semibold"
                  style={{
                    color:
                      credits === 0
                        ? "var(--c-rose)"
                        : credits <= 2
                          ? "var(--c-amber)"
                          : "var(--c-ink-40)",
                  }}
                >
                  <Coins size={11} />
                  {credits === 0
                    ? "No credits — refills on the 1st"
                    : `${credits} session${credits !== 1 ? "s" : ""} left this month`}
                </p>
                <span style={{ color: "var(--c-ink-12)", fontSize: "10px" }}>
                  ·
                </span>
                <p className="text-xs" style={{ color: "var(--c-ink-40)" }}>
                  Free · No card required
                </p>
              </div>

              {/* Social proof row */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="flex items-center gap-5 pt-6 border-t border-var(--c-border)"
              >
                <div className="flex -space-x-2">
                  {["#7c3aed", "#e11d48", "#d97706", "#059669"].map((c, i) => (
                    <div
                      key={i}
                      className="w-9 h-9 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: c }}
                    >
                      {["S", "M", "A", "R"][i]}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex gap-0.5 mb-0.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star
                        key={i}
                        size={12}
                        className="text-var(--c-amber)] fill-[var(--c-amber)"
                      />
                    ))}
                  </div>
                  <p className="text-xs text-var(--c-ink-40)">
                    <span className="font-bold text-var(--c-ink)">4,600+</span>{" "}
                    candidates improved their score
                  </p>
                </div>
                <div className="ml-auto hidden sm:flex gap-6">
                  {[
                    { value: "92%", label: "Pass Rate" },
                    { value: "4.9★", label: "Rating" },
                  ].map((s) => (
                    <div key={s.label} className="text-center">
                      <p className="text-lg font-black text-var(--c-ink)">
                        {s.value}
                      </p>
                      <p className="text-[11px] text-var(--c-ink-40)">
                        {s.label}
                      </p>
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          </div>

          {/* Right — animated score card */}
          <div className="hidden lg:flex justify-center items-center py-8">
            <ScorePreviewCard />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          FREE CREDIT BANNER
      ══════════════════════════════════════════ */}
      <section
        className="relative py-10 px-6 overflow-hidden"
        style={{ backgroundColor: "var(--c-slate)" }}
      >
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-6"
        >
          {/* Left: headline */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-var(--c-amber-l) flex items-center justify-center shrink-0">
              <Coins size={22} style={{ color: "var(--c-amber)" }} />
            </div>
            <div>
              <p className="text-white font-bold text-base leading-tight">
                {MONTHLY_CREDITS} free sessions every month — for everyone.
              </p>
              <p className="text-white/45 text-xs mt-0.5 flex items-center gap-1.5">
                <RefreshCw size={10} /> Credits auto-refill on the 1st · No card
                needed
              </p>
            </div>
          </div>

          {/* Right: credit dots + reset info */}
          <div className="flex items-center gap-5 shrink-0">
            <div className="text-center">
              <p
                className="text-2xl font-black text-white"
                style={{ fontFamily: "'Playfair Display',serif" }}
              >
                {credits}
                <span className="text-white/30 text-sm font-normal">
                  /{MONTHLY_CREDITS}
                </span>
              </p>
              <p className="text-[11px] text-white/40">credits left</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1">
                {Array.from({ length: MONTHLY_CREDITS }, (_, i) => (
                  <div
                    key={i}
                    className="w-2.5 h-2.5 rounded-full transition-all"
                    style={{
                      backgroundColor:
                        i < credits
                          ? "var(--c-sage)"
                          : "rgba(255,255,255,0.12)",
                    }}
                  />
                ))}
              </div>
              <p className="text-[10px] text-white/30 flex items-center gap-1">
                <CalendarClock size={9} /> Resets in {getDaysUntilReset()} days
              </p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ══════════════════════════════════════════
          FEATURES
      ══════════════════════════════════════════ */}
      <section
        ref={featuresRef}
        className="relative py-28 overflow-hidden bg-white px-6"
      >
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "radial-gradient(circle, var(--c-border) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div
          className="absolute top-0 right-0 w-125 h-125 rounded-full blur-[160px] opacity-25 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, var(--c-violet-l), transparent 70%)",
          }}
        />

        <div className="relative mx-auto max-w-7xl">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-14">
            <SectionHeading
              label="Platform Features"
              title={"Everything you need\nto land the offer."}
              subtitle="From question selection to scored coaching — your whole interview toolkit in one session."
            />
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="shrink-0"
            >
              <Link
                to="/interview"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-var(--c-border) bg-white text-sm font-semibold text-var(--c-ink-70) hover:text-var(--c-ink) hover:shadow-var(--sh-md) transition-all shadow-var(--sh-sm)"
              >
                Start practising <ChevronRight size={15} />
              </Link>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 28, scale: 0.97 }}
                animate={featuresInView ? { opacity: 1, y: 0, scale: 1 } : {}}
                transition={{
                  delay: i * 0.08,
                  duration: 0.5,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <motion.div
                  whileHover={{ y: -6, scale: 1.015 }}
                  transition={{ type: "spring", stiffness: 320, damping: 20 }}
                  className="feature-card h-full group relative overflow-hidden bg-var(--c-cream) rounded-3xl border border-var(--c-border) shadow-var(--sh-sm) hover:shadow-var(--sh-lg) p-7 flex flex-col gap-5 transition-shadow duration-300"
                >
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl pointer-events-none"
                    style={{
                      background: `radial-gradient(ellipse at top left, ${item.bg} 0%, transparent 65%)`,
                    }}
                  />
                  <div className="relative w-fit">
                    <div
                      className="feature-icon-wrap w-12 h-12 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                      style={{ backgroundColor: item.bg }}
                    >
                      <item.Icon size={22} style={{ color: item.color }} />
                    </div>
                  </div>
                  <div className="flex-1 relative">
                    <h3 className="font-bold text-var(--c-ink) text-[16px] mb-2.5 leading-snug tracking-tight group-hover:text-var(--c-slate) transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-sm text-var(--c-ink-70) leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                  <div className="relative flex items-center justify-between pt-4 border-t border-var(--c-border)">
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
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════════ */}
      <section className="relative py-24 px-6 bg-var(--c-cream) overflow-hidden">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(var(--c-border) 1px,transparent 1px),linear-gradient(90deg,var(--c-border) 1px,transparent 1px)",
            backgroundSize: "52px 52px",
          }}
        />
        <div className="relative mx-auto max-w-7xl">
          <SectionHeading
            center
            label="How It Works"
            title={"Four steps to\nyour next offer."}
            subtitle="From setup to scored feedback in under five minutes."
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {STEPS.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 28, scale: 0.97 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true }}
                transition={{
                  delay: i * 0.1,
                  duration: 0.5,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <motion.div
                  whileHover={{ y: -6, scale: 1.015 }}
                  transition={{ type: "spring", stiffness: 320, damping: 20 }}
                  className="feature-card h-full group relative overflow-hidden bg-white rounded-3xl border border-var(--c-border) shadow-var(--sh-sm) hover:shadow-var(--sh-lg) p-7 flex flex-col gap-4 transition-shadow duration-300"
                >
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl pointer-events-none"
                    style={{
                      background: `radial-gradient(ellipse at top left, ${item.bg} 0%, transparent 65%)`,
                    }}
                  />
                  <div className="relative flex items-center justify-between">
                    <div
                      className="feature-icon-wrap w-12 h-12 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                      style={{ backgroundColor: item.bg }}
                    >
                      <item.Icon size={22} style={{ color: item.color }} />
                    </div>
                    <span
                      className="text-4xl font-black opacity-[0.08] text-var(--c-ink)"
                      style={{ fontFamily: "'Playfair Display',serif" }}
                    >
                      {item.n}
                    </span>
                  </div>
                  <div className="relative flex-1">
                    <h3 className="font-bold text-var(--c-ink) text-[16px] mb-2.5 leading-snug tracking-tight group-hover:text-var(--c-slate) transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-sm text-var(--c-ink-70) leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                  <div className="relative pt-3 border-t border-var(--c-border) flex items-center justify-between">
                    <span
                      className="text-xs font-bold"
                      style={{ color: item.color }}
                    >
                      Step {item.n}
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
            ))}
          </div>

          {/* Step CTA */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="text-center mt-14"
          >
            <Link to="/interview">
              <motion.div
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center gap-3 bg-var(--c-slate) text-white px-10 py-4 rounded-2xl text-sm font-bold tracking-wide shadow-var(--sh-xl) hover:bg-var(--c-slate-2) hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
              >
                <Mic size={16} className="text-var(--c-rose)" />
                Start Your First Session
                <ArrowRight size={15} />
              </motion.div>
            </Link>
            <p className="text-xs text-var(--c-ink-40) mt-3 font-medium">
              Takes less than 5 minutes · Free to try
            </p>
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          TESTIMONIALS  (featured + marquee)
      ══════════════════════════════════════════ */}
      <section className="relative py-28 overflow-hidden bg-white px-6">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "linear-gradient(var(--c-border) 1px,transparent 1px),linear-gradient(90deg,var(--c-border) 1px,transparent 1px)",
            backgroundSize: "52px 52px",
          }}
        />
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-175 h-75 rounded-full blur-[120px] opacity-20 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, var(--c-violet-l), transparent 70%)",
          }}
        />

        <div className="relative mx-auto max-w-7xl">
          <SectionHeading
            label="Success Stories"
            title={"Real hires,\nreal results."}
            subtitle="Thousands of candidates sharpened their answers with Talk2Hire. Here's what they say."
          />

          {/* Featured large testimonial */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative overflow-hidden rounded-3xl p-8 sm:p-10 mb-10"
            style={{
              background:
                "linear-gradient(135deg, var(--c-slate) 0%, var(--c-slate-2) 60%, var(--c-slate-3) 100%)",
            }}
          >
            <div className="absolute top-4 right-6 text-[10rem] leading-none font-serif text-white opacity-[0.06] select-none pointer-events-none">
              "
            </div>
            <div className="relative">
              <div className="flex gap-1 mb-6">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    size={16}
                    className="fill-var(--c-amber) text-var(--c-amber)"
                  />
                ))}
              </div>
              <blockquote className="text-xl sm:text-2xl font-semibold text-white leading-relaxed mb-8 max-w-2xl">
                "{TESTIMONIALS[0].quote}"
              </blockquote>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-md"
                    style={{ backgroundColor: TESTIMONIALS[0].avColor }}
                  >
                    {TESTIMONIALS[0].av}
                  </div>
                  <div>
                    <p className="font-bold text-white text-sm">
                      {TESTIMONIALS[0].name}
                    </p>
                    <p className="text-white/55 text-xs mt-0.5">
                      {TESTIMONIALS[0].role} @ {TESTIMONIALS[0].company}
                    </p>
                  </div>
                </div>
                <Pill color="amber">{TESTIMONIALS[0].outcome}</Pill>
              </div>
            </div>
          </motion.div>

          {/* Marquee row */}
          <div className="relative overflow-hidden -mx-6 px-6">
            <div
              className="pointer-events-none absolute inset-y-0 left-0 w-20 z-10"
              style={{
                background: "linear-gradient(to right, white, transparent)",
              }}
            />
            <div
              className="pointer-events-none absolute inset-y-0 right-0 w-20 z-10"
              style={{
                background: "linear-gradient(to left, white, transparent)",
              }}
            />
            <div className="flex gap-5 marquee-track">
              {[...TESTIMONIALS.slice(1), ...TESTIMONIALS.slice(1)].map(
                (item, i) => (
                  <div key={i} className="min-w-75 max-w-75">
                    <motion.div
                      whileHover={{ y: -6 }}
                      transition={{
                        type: "spring",
                        stiffness: 320,
                        damping: 20,
                      }}
                      className="h-full bg-var(--c-cream) rounded-3xl border border-var(--c-border) shadow-var(--sh-sm) hover:shadow-var(--sh-lg) p-6 flex flex-col gap-4 relative overflow-hidden group transition-shadow duration-300"
                    >
                      <div
                        className="absolute top-0 left-6 right-6 h-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        style={{ backgroundColor: item.avColor }}
                      />
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-sm"
                            style={{ backgroundColor: item.avColor }}
                          >
                            {item.av}
                          </div>
                          <div>
                            <p className="font-bold text-var(--c-ink) text-sm leading-none">
                              {item.name}
                            </p>
                            <p className="text-[11px] text-var(--c-ink-40) mt-0.5">
                              {item.company}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <Star
                              key={i}
                              size={11}
                              className="fill-var(--c-amber) text-var(--c-amber)"
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-sm text-var(--c-ink-70) leading-relaxed flex-1">
                        "{item.quote}"
                      </p>
                      <div className="flex items-center justify-between pt-3 border-t border-var(--c-border)">
                        <Pill color={item.outcomeColor} className="text-[10px]">
                          <CheckCircle size={9} /> {item.outcome}
                        </Pill>
                        <p className="text-[10px] text-var(--c-ink-40)">
                          {item.role}
                        </p>
                      </div>
                    </motion.div>
                  </div>
                ),
              )}
            </div>
          </div>

          {/* Bottom stats */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4"
          >
            {[
              { value: "4,600+", label: "Candidates improved", icon: "🎯" },
              { value: "4.9/5", label: "Average rating", icon: "⭐" },
              { value: "92%", label: "Interview pass rate", icon: "📈" },
              { value: "<5 min", label: "Per practice session", icon: "⚡" },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{
                  delay: 0.35 + i * 0.08,
                  duration: 0.4,
                  type: "spring",
                }}
                className="flex flex-col items-center justify-center gap-2 p-5 rounded-2xl bg-var(--c-cream) border border-var(--c-border) shadow-var(--sh-sm) text-center"
              >
                <span className="text-2xl">{stat.icon}</span>
                <p
                  className="text-2xl font-black text-var(--c-ink)"
                  style={{ fontFamily: "'Playfair Display',serif" }}
                >
                  {stat.value}
                </p>
                <p className="text-xs text-var(--c-ink-40) font-medium">
                  {stat.label}
                </p>
              </motion.div>
            ))}
          </motion.div>
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
            <Zap size={11} /> No credit card required
          </Pill>
          <h2 className="text-4xl sm:text-6xl font-black text-white mb-5 tracking-tight leading-[1.04]">
            Your next offer
            <br />
            starts here.
          </h2>
          <p className="text-white/50 mb-10 max-w-md mx-auto text-base leading-relaxed">
            Practice real questions. Get AI feedback. Walk into every interview
            with unshakeable confidence.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/interview">
              <motion.div
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white font-bold text-sm rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer"
                style={{ color: "var(--c-slate)" }}
              >
                <Mic size={15} className="text-var(--c-rose)" />
                Practice an Interview <ArrowRight size={15} />
              </motion.div>
            </Link>
            <div
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 font-semibold text-sm rounded-xl border"
              style={{
                backgroundColor: "rgba(255,255,255,0.06)",
                borderColor: "rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              <Coins size={14} />
              {MONTHLY_CREDITS} free sessions every month
            </div>
          </div>

          <div className="mt-16 flex flex-wrap justify-center gap-12">
            {[
              { Icon: Award, value: "4.9/5", label: "Avg. rating" },
              { Icon: Users, value: "4,600+", label: "Improved this year" },
              { Icon: TrendingUp, value: "92%", label: "Interview pass rate" },
            ].map(({ Icon, value, label }) => (
              <div key={label} className="text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Icon size={13} className="text-var(--c-amber)" />
                  <p className="text-2xl font-black text-white">{value}</p>
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

export default MockInterviewPage;

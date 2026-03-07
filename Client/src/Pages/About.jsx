import React, { useRef } from "react";
import { motion, useInView } from "motion/react";
import { useNavigate } from "react-router-dom";
import {
  Mic,
  Zap,
  Lightbulb,
  Globe,
  ArrowRight,
  CheckCircle,
  Users,
  Award,
  TrendingUp,
  Star,
  ChevronRight,
  Sparkles,
  Target,
  Brain,
} from "lucide-react";

/* ══════════════════════════════════════════
   Design Tokens — matches site palette
══════════════════════════════════════════ */
const TOKENS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap');

  :root {
    --c-cream:    #faf9f7;
    --c-white:    #ffffff;
    --c-ink:      #0d0d12;
    --c-ink-70:   rgba(13,13,18,0.70);
    --c-ink-40:   rgba(13,13,18,0.40);
    --c-ink-12:   rgba(13,13,18,0.08);
    --c-slate:    #1e2235;
    --c-slate-2:  #2d3352;
    --c-slate-3:  #3d4570;
    --c-amber:    #d97706;
    --c-amber-l:  #fef3c7;
    --c-amber-2:  #f59e0b;
    --c-amber-3:  #fde68a;
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

  .about-root { font-family: 'DM Sans', sans-serif; color: var(--c-ink); }
  .about-root h1, .about-root h2, .about-root h3 {
    font-family: 'Playfair Display', Georgia, serif;
  }

  @keyframes ticker {
    0%   { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }
  .ticker-track { animation: ticker 28s linear infinite; }
  .ticker-track:hover { animation-play-state: paused; }
`;

/* ══════════════════════════════════════════
   Ambient corner glows
══════════════════════════════════════════ */
const CornerGlow = () => (
  <>
    <div
      className="absolute top-0 right-0 w-150 h-150 rounded-full pointer-events-none"
      style={{
        background:
          "radial-gradient(circle at 80% 15%, #fef3c7 0%, #fde68a 25%, transparent 65%)",
        opacity: 0.6,
        filter: "blur(80px)",
      }}
    />
    <div
      className="absolute top-[40%] left-[-5%] w-100 h-100 rounded-full pointer-events-none"
      style={{
        background: "radial-gradient(circle, #ede9fe 0%, transparent 70%)",
        opacity: 0.35,
        filter: "blur(90px)",
      }}
    />
    <div
      className="absolute bottom-0 right-[10%] w-87.5 h-87.5 rounded-full pointer-events-none"
      style={{
        background: "radial-gradient(circle, #fef3c7 0%, transparent 70%)",
        opacity: 0.4,
        filter: "blur(70px)",
      }}
    />
  </>
);

/* ══════════════════════════════════════════
   Grid texture
══════════════════════════════════════════ */
const GridTexture = () => (
  <div
    className="absolute inset-0 pointer-events-none"
    style={{
      backgroundImage:
        "linear-gradient(var(--c-border) 1px, transparent 1px), linear-gradient(90deg, var(--c-border) 1px, transparent 1px)",
      backgroundSize: "52px 52px",
      opacity: 0.4,
    }}
  />
);

/* ══════════════════════════════════════════
   Section label — matches homepage
══════════════════════════════════════════ */
const SectionLabel = ({ children, center = false }) => (
  <p
    className={`text-xs uppercase tracking-[0.3em] font-bold mb-4 flex items-center gap-2 ${center ? "justify-center" : ""}`}
    style={{ color: "var(--c-amber)" }}
  >
    <span
      className="w-5 h-px inline-block"
      style={{ backgroundColor: "var(--c-amber)" }}
    />
    {children}
    <span
      className="w-5 h-px inline-block"
      style={{ backgroundColor: "var(--c-amber)" }}
    />
  </p>
);

/* ══════════════════════════════════════════
   Ornament divider
══════════════════════════════════════════ */
const Ornament = () => (
  <div className="flex items-center justify-center gap-3 my-6">
    <div
      className="h-px w-14 rounded-full"
      style={{
        background: "linear-gradient(90deg, transparent, var(--c-amber))",
      }}
    />
    <span style={{ color: "var(--c-amber)", fontSize: 10 }}>✦</span>
    <div
      className="h-px w-14 rounded-full"
      style={{
        background: "linear-gradient(90deg, var(--c-amber), transparent)",
      }}
    />
  </div>
);

/* ══════════════════════════════════════════
   Stat card
══════════════════════════════════════════ */
const StatCard = ({ value, label, icon, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    whileHover={{ y: -5, boxShadow: "var(--sh-lg)" }}
    className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border text-center"
    style={{
      background: "var(--c-white)",
      borderColor: "var(--c-border)",
      boxShadow: "var(--sh-sm)",
    }}
  >
    <span className="text-2xl">{icon}</span>
    <p
      className="text-3xl font-black"
      style={{ fontFamily: "'Playfair Display', serif", color: "var(--c-ink)" }}
    >
      {value}
    </p>
    <p className="text-xs font-medium" style={{ color: "var(--c-ink-40)" }}>
      {label}
    </p>
  </motion.div>
);

/* ══════════════════════════════════════════
   Feature card
══════════════════════════════════════════ */
const features = [
  {
    icon: Mic,
    color: "var(--c-rose)",
    bg: "var(--c-rose-l)",
    title: "Realistic Interviews",
    desc: "Simulate real interview conditions with AI-driven questions and voice recognition that adapts to your answers in real time.",
    stat: "95% realism score",
  },
  {
    icon: Zap,
    color: "var(--c-amber)",
    bg: "var(--c-amber-l)",
    title: "Instant Scoring",
    desc: "Get instant feedback with a rubric-based scoring system for every answer — clarity, depth, and confidence all measured.",
    stat: "< 2s feedback",
  },
  {
    icon: Lightbulb,
    color: "var(--c-violet)",
    bg: "var(--c-violet-l)",
    title: "Suggestions & Tips",
    desc: "Receive personalized suggestions to improve clarity, confidence, and technical depth after every single response.",
    stat: "3× improvement rate",
  },
  {
    icon: Globe,
    color: "var(--c-sky)",
    bg: "var(--c-sky-l)",
    title: "Multi-domain Coverage",
    desc: "Covers Technology, Finance, Healthcare, and Education — curated question banks updated with real industry trends.",
    stat: "4 core domains",
  },
];

const FeatureCard = ({ item, index }) => {
  const Icon = item.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 28, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true }}
      transition={{
        delay: index * 0.1,
        duration: 0.55,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{ y: -6 }}
      className="group relative overflow-hidden rounded-3xl border p-7 flex flex-col gap-5"
      style={{
        background: "var(--c-white)",
        borderColor: "var(--c-border)",
        boxShadow: "var(--sh-sm)",
        transition: "box-shadow 0.3s",
      }}
    >
      {/* hover bg tint */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at top left, ${item.bg} 0%, transparent 65%)`,
        }}
      />

      <div className="relative w-fit">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
          style={{ backgroundColor: item.bg }}
        >
          <Icon size={22} style={{ color: item.color }} />
        </div>
      </div>

      <div className="flex-1 relative">
        <h3
          className="font-bold text-base mb-2.5 leading-snug tracking-tight"
          style={{
            fontFamily: "'Playfair Display', serif",
            color: "var(--c-ink)",
          }}
        >
          {item.title}
        </h3>
        <p
          className="text-sm leading-relaxed"
          style={{ color: "var(--c-ink-70)" }}
        >
          {item.desc}
        </p>
      </div>

      <div
        className="relative flex items-center justify-between pt-4 border-t"
        style={{ borderColor: "var(--c-border)" }}
      >
        <span className="text-xs font-bold" style={{ color: item.color }}>
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
  );
};

/* ══════════════════════════════════════════
   Timeline step
══════════════════════════════════════════ */
const steps = [
  {
    num: "01",
    title: "Create your profile",
    desc: "Set your domain, experience level, and target role in under 2 minutes.",
    color: "var(--c-amber)",
  },
  {
    num: "02",
    title: "Start your interview",
    desc: "Our AI generates a tailored question set and listens to your voice responses.",
    color: "var(--c-violet)",
  },
  {
    num: "03",
    title: "Get instant feedback",
    desc: "Receive a detailed score breakdown and actionable tips immediately after.",
    color: "var(--c-sage)",
  },
  {
    num: "04",
    title: "Track & improve",
    desc: "Review your history, compare sessions, and watch your scores climb over time.",
    color: "var(--c-sky)",
  },
];

const TimelineStep = ({ step, index, isLast }) => (
  <motion.div
    initial={{ opacity: 0, x: -24 }}
    whileInView={{ opacity: 1, x: 0 }}
    viewport={{ once: true }}
    transition={{
      delay: index * 0.12,
      duration: 0.55,
      ease: [0.22, 1, 0.36, 1],
    }}
    className="flex gap-5 relative"
  >
    {/* Line */}
    {!isLast && (
      <div
        className="absolute left-5.5 top-13 w-px h-[calc(100%+8px)]"
        style={{
          background:
            "linear-gradient(to bottom, var(--c-border), transparent)",
        }}
      />
    )}
    {/* Number badge */}
    <div
      className="shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center border font-black text-sm"
      style={{
        background: "var(--c-white)",
        borderColor: "var(--c-border)",
        color: step.color,
        boxShadow: "var(--sh-sm)",
        fontFamily: "'Playfair Display', serif",
      }}
    >
      {step.num}
    </div>
    <div className="pb-8">
      <h3
        className="font-bold text-base mb-1.5"
        style={{ color: "var(--c-ink)" }}
      >
        {step.title}
      </h3>
      <p
        className="text-sm leading-relaxed"
        style={{ color: "var(--c-ink-70)" }}
      >
        {step.desc}
      </p>
    </div>
  </motion.div>
);

/* ══════════════════════════════════════════
   Ticker domains
══════════════════════════════════════════ */
const domains = [
  "Technology",
  "Finance",
  "Healthcare",
  "Education",
  "Product Design",
  "Data Science",
  "DevOps",
  "Marketing",
  "Sales",
  "Legal",
  "Operations",
  "Engineering",
];

const Ticker = () => (
  <div
    className="relative overflow-hidden py-5 border-y"
    style={{ borderColor: "var(--c-border)" }}
  >
    <div
      className="pointer-events-none absolute inset-y-0 left-0 w-24 z-10"
      style={{
        background: "linear-gradient(to right, var(--c-white), transparent)",
      }}
    />
    <div
      className="pointer-events-none absolute inset-y-0 right-0 w-24 z-10"
      style={{
        background: "linear-gradient(to left, var(--c-white), transparent)",
      }}
    />
    <div className="ticker-track flex gap-8 w-max">
      {[...domains, ...domains].map((d, i) => (
        <div key={i} className="flex items-center gap-2 shrink-0">
          <span
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: "var(--c-ink-40)" }}
          >
            {d}
          </span>
          <span style={{ color: "var(--c-amber)", fontSize: 8 }}>✦</span>
        </div>
      ))}
    </div>
  </div>
);

/* ══════════════════════════════════════════
   CTA Button
══════════════════════════════════════════ */
const CTAButton = ({ children, onClick, variant = "primary" }) => {
  const [hovered, setHovered] = React.useState(false);
  if (variant === "secondary")
    return (
      <motion.button
        onClick={onClick}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.97 }}
        className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-sm border cursor-pointer outline-none"
        style={{
          fontFamily: "'DM Sans', sans-serif",
          background: "var(--c-white)",
          borderColor: "var(--c-border)",
          color: "var(--c-ink-70)",
          boxShadow: "var(--sh-sm)",
        }}
      >
        {children}
      </motion.button>
    );
  return (
    <motion.button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileTap={{ scale: 0.97 }}
      className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-xl font-bold text-sm text-white cursor-pointer border-0 outline-none"
      style={{
        fontFamily: "'DM Sans', sans-serif",
        background: "var(--c-slate)",
        boxShadow: hovered ? "0 12px 36px rgba(30,34,53,0.28)" : "var(--sh-md)",
        transition: "box-shadow 0.25s",
      }}
    >
      {children}
      <motion.div
        animate={{ x: hovered ? 4 : 0 }}
        transition={{ type: "spring", stiffness: 300 }}
      >
        <ArrowRight size={14} />
      </motion.div>
    </motion.button>
  );
};

/* ══════════════════════════════════════════
   Main AboutPage
══════════════════════════════════════════ */
const AboutPage = () => {
  const navigate = useNavigate();
  const featuresRef = useRef(null);
  const featuresInView = useInView(featuresRef, {
    once: true,
    margin: "-80px",
  });

  return (
    <>
      {/* SEO — unchanged */}
      <title>About Talk2Hire | AI-Powered Interview Preparation Platform</title>
      <meta
        name="description"
        content="Learn about Talk2Hire, an AI-powered interview preparation platform that simulates real interviews, provides instant scoring, and helps candidates improve with personalized feedback."
      />
      <meta
        name="keywords"
        content="AI interview platform, mock interview practice, interview preparation online, AI interview simulator, Talk2Hire platform"
      />
      <meta name="robots" content="index, follow" />
      <link rel="canonical" href="https://talk2hire.com/about" />
      <meta
        property="og:title"
        content="About Talk2Hire | AI Interview Preparation Platform"
      />
      <meta
        property="og:description"
        content="Discover how Talk2Hire uses AI to simulate realistic interviews, evaluate answers, and help candidates improve with instant feedback."
      />
      <meta property="og:type" content="website" />
      <meta property="og:url" content="https://talk2hire.com/about" />
      <meta
        property="og:image"
        content="https://talk2hire.com/talk2hirelogo.png"
      />
      <meta name="twitter:card" content="summary_large_image" />
      <meta
        name="twitter:title"
        content="About Talk2Hire | AI Interview Platform"
      />
      <meta
        name="twitter:description"
        content="AI-powered mock interviews with instant scoring and personalized feedback."
      />
      <meta
        name="twitter:image"
        content="https://talk2hire.com/talk2hirelogo.png"
      />
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Talk2Hire",
          url: "https://talk2hire.com/",
          logo: "https://talk2hire.com/talk2hirelogo.png",
          description:
            "Talk2Hire is an AI-powered interview preparation platform offering realistic mock interviews, instant scoring, and personalized feedback across multiple domains.",
          sameAs: [
            "https://www.linkedin.com/company/quantumhash-corporation/",
            "https://x.com/QuantumhashCrp",
            "https://www.instagram.com/quantumhash_corporation/",
            "https://www.facebook.com/profile.php?id=61582410893482",
            "https://www.youtube.com/@QuantumHashCorporation",
            "https://github.com/Quantumhash-Corporation",
          ],
        })}
      </script>

      <style>{TOKENS}</style>

      <div className="about-root">
        {/* ══════════════════════════════════════
            HERO
        ══════════════════════════════════════ */}
        <section
          className="relative overflow-hidden min-h-[88vh] flex items-center"
          style={{ background: "var(--c-white)" }}
        >
          <GridTexture />
          <CornerGlow />

          {/* Decorative rings */}
          <div
            className="absolute top-10 right-14 w-52 h-52 rounded-full border pointer-events-none"
            style={{ borderColor: "rgba(217,119,6,0.10)" }}
          />
          <div
            className="absolute top-20 right-24 w-28 h-28 rounded-full border pointer-events-none"
            style={{ borderColor: "rgba(217,119,6,0.07)" }}
          />
          <div
            className="absolute bottom-16 left-8 w-40 h-40 rounded-full border pointer-events-none"
            style={{ borderColor: "rgba(217,119,6,0.08)" }}
          />

          <div className="relative z-10 mx-auto max-w-7xl px-6 py-24 w-full">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              {/* Left — text */}
              <div>
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                >
                  {/* Pill */}
                  <motion.div
                    className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-7"
                    style={{
                      background: "var(--c-amber-l)",
                      borderColor: "rgba(217,119,6,0.25)",
                    }}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 }}
                  >
                    <motion.span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: "var(--c-amber)" }}
                      animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                      transition={{ duration: 1.8, repeat: Infinity }}
                    />
                    <span
                      className="text-xs font-bold uppercase tracking-[0.2em]"
                      style={{ color: "var(--c-amber)" }}
                    >
                      About Talk2Hire
                    </span>
                  </motion.div>

                  <h1
                    className="mb-6 leading-[1.06] tracking-tight"
                    style={{
                      fontSize: "clamp(36px, 5.5vw, 64px)",
                      fontWeight: 900,
                      color: "var(--c-ink)",
                    }}
                  >
                    Prepare Smarter,{" "}
                    <span className="relative inline-block">
                      <span
                        style={{
                          fontStyle: "italic",
                          background:
                            "linear-gradient(135deg, var(--c-slate) 0%, var(--c-slate-3) 100%)",
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                          backgroundClip: "text",
                        }}
                      >
                        Interview Better.
                      </span>
                      <svg
                        className="absolute -bottom-1 left-0 w-full"
                        viewBox="0 0 400 8"
                        fill="none"
                        preserveAspectRatio="none"
                      >
                        <motion.path
                          d="M4 5 Q100 1 200 5 Q300 9 396 4"
                          stroke="#d97706"
                          strokeWidth="3"
                          strokeLinecap="round"
                          fill="none"
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{
                            delay: 0.9,
                            duration: 0.8,
                            ease: "easeOut",
                          }}
                        />
                      </svg>
                    </span>
                  </h1>

                  <p
                    className="text-base leading-relaxed mb-8 max-w-lg"
                    style={{ color: "var(--c-ink-70)", fontWeight: 300 }}
                  >
                    Talk2Hire uses AI to help candidates practice interviews in
                    a realistic environment. Dynamic question sets across
                    Technology, Finance, Healthcare and Education — with instant
                    evaluation, scoring, and feedback.
                  </p>

                  <div className="flex flex-wrap gap-3">
                    <CTAButton onClick={() => navigate("/interview?jobId=11")}>
                      <Sparkles size={15} /> Start Your Interview
                    </CTAButton>
                    <CTAButton
                      variant="secondary"
                      onClick={() => navigate("/jobs")}
                    >
                      Browse Jobs <ChevronRight size={14} />
                    </CTAButton>
                  </div>

                  {/* Trust row */}
                  <motion.div
                    className="flex items-center gap-4 mt-10 pt-8 border-t"
                    style={{ borderColor: "var(--c-border)" }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                  >
                    <div className="flex -space-x-2">
                      {["#6366f1", "#ec4899", "#f59e0b", "#10b981"].map(
                        (c, i) => (
                          <div
                            key={i}
                            className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold"
                            style={{ backgroundColor: c }}
                          >
                            {["A", "S", "M", "J"][i]}
                          </div>
                        ),
                      )}
                    </div>
                    <div>
                      <div className="flex gap-0.5 mb-0.5">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star
                            key={i}
                            size={11}
                            className="fill-amber-400 text-amber-400"
                          />
                        ))}
                      </div>
                      <p
                        className="text-xs"
                        style={{ color: "var(--c-ink-40)" }}
                      >
                        <span
                          className="font-bold"
                          style={{ color: "var(--c-ink)" }}
                        >
                          8,200+
                        </span>{" "}
                        professionals hired
                      </p>
                    </div>
                  </motion.div>
                </motion.div>
              </div>

              {/* Right — visual card stack */}
              <motion.div
                className="hidden lg:flex flex-col gap-4"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3, duration: 0.7, ease: "easeOut" }}
              >
                {/* Mission card */}
                <motion.div
                  className="rounded-3xl border p-7 relative overflow-hidden"
                  style={{
                    background: "var(--c-white)",
                    borderColor: "var(--c-border)",
                    boxShadow: "var(--sh-lg)",
                  }}
                  whileHover={{ y: -4 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <div
                    className="h-1 absolute top-0 left-0 right-0"
                    style={{
                      background:
                        "linear-gradient(90deg, var(--c-amber), var(--c-amber-2), var(--c-amber-3))",
                    }}
                  />
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: "var(--c-amber-l)" }}
                    >
                      <Target size={18} style={{ color: "var(--c-amber)" }} />
                    </div>
                    <div>
                      <p
                        className="text-[10px] font-bold uppercase tracking-widest"
                        style={{ color: "var(--c-amber)" }}
                      >
                        Our Mission
                      </p>
                      <p
                        className="text-sm font-bold"
                        style={{ color: "var(--c-ink)" }}
                      >
                        Democratize interview prep
                      </p>
                    </div>
                  </div>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: "var(--c-ink-70)" }}
                  >
                    We believe every candidate deserves access to world-class
                    interview preparation — not just those who can afford a
                    coach. Talk2Hire makes it free, fast, and brutally
                    effective.
                  </p>
                </motion.div>

                {/* Vision card */}
                <motion.div
                  className="rounded-3xl border p-7 relative overflow-hidden"
                  style={{
                    background: "var(--c-white)",
                    borderColor: "var(--c-border)",
                    boxShadow: "var(--sh-lg)",
                  }}
                  whileHover={{ y: -4 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <div
                    className="h-1 absolute top-0 left-0 right-0"
                    style={{
                      background:
                        "linear-gradient(90deg, var(--c-violet), var(--c-slate), var(--c-slate-3))",
                    }}
                  />
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: "var(--c-violet-l)" }}
                    >
                      <Brain size={18} style={{ color: "var(--c-violet)" }} />
                    </div>
                    <div>
                      <p
                        className="text-[10px] font-bold uppercase tracking-widest"
                        style={{ color: "var(--c-violet)" }}
                      >
                        Our Vision
                      </p>
                      <p
                        className="text-sm font-bold"
                        style={{ color: "var(--c-ink)" }}
                      >
                        AI as your career co-pilot
                      </p>
                    </div>
                  </div>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: "var(--c-ink-70)" }}
                  >
                    A world where AI guides every professional from their first
                    interview to their dream role — continuously learning,
                    adapting, and improving alongside them.
                  </p>
                </motion.div>

                {/* Built by badge */}
                <motion.div
                  className="rounded-2xl border px-5 py-4 flex items-center gap-4"
                  style={{
                    background: "var(--c-cream)",
                    borderColor: "var(--c-border)",
                    boxShadow: "var(--sh-sm)",
                  }}
                  whileHover={{ y: -2 }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{
                      background: "linear-gradient(135deg,#1e2235,#2d3352)",
                    }}
                  >
                    <Sparkles size={14} className="text-white" />
                  </div>
                  <div>
                    <p
                      className="text-xs font-bold"
                      style={{ color: "var(--c-ink)" }}
                    >
                      Built by QuantumHash Corporation
                    </p>
                    <p
                      className="text-[11px]"
                      style={{ color: "var(--c-ink-40)" }}
                    >
                      Wilmington, DE · Est. 2024
                    </p>
                  </div>
                  <a
                    href="https://quantumhash.me"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-xs font-semibold flex items-center gap-1"
                    style={{ color: "var(--c-amber)" }}
                  >
                    Visit <ArrowRight size={11} />
                  </a>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            TICKER
        ══════════════════════════════════════ */}
        <Ticker />

        {/* ══════════════════════════════════════
            STATS
        ══════════════════════════════════════ */}
        <section
          className="relative py-20 overflow-hidden"
          style={{ background: "var(--c-white)" }}
        >
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard
                value="8,200+"
                label="Professionals hired"
                icon="🎯"
                delay={0}
              />
              <StatCard
                value="4.9/5"
                label="Average rating"
                icon="⭐"
                delay={0.08}
              />
              <StatCard
                value="94%"
                label="Interview pass rate"
                icon="📈"
                delay={0.16}
              />
              <StatCard
                value="< 3wk"
                label="Avg. time to offer"
                icon="⚡"
                delay={0.24}
              />
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            FEATURES
        ══════════════════════════════════════ */}
        <section
          ref={featuresRef}
          className="relative py-28 overflow-hidden"
          style={{ background: "var(--c-cream)" }}
        >
          {/* dot grid */}
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "radial-gradient(circle, var(--c-border) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />
          <div
            className="absolute top-0 right-0 w-100 h-100 rounded-full blur-[140px] opacity-25 pointer-events-none"
            style={{
              background:
                "radial-gradient(circle, var(--c-violet-l), transparent 70%)",
            }}
          />

          <div className="relative mx-auto max-w-7xl px-6">
            <div className="text-center mb-14">
              <SectionLabel center>Platform Features</SectionLabel>
              <motion.h2
                className="text-4xl sm:text-5xl font-black tracking-tight mb-4"
                style={{ color: "var(--c-ink)" }}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55 }}
              >
                Everything you need to{" "}
                <em
                  style={{
                    fontStyle: "italic",
                    background:
                      "linear-gradient(135deg, var(--c-slate) 0%, var(--c-slate-3) 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  land the role.
                </em>
              </motion.h2>
              <motion.p
                className="text-base max-w-md mx-auto"
                style={{ color: "var(--c-ink-70)" }}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.15 }}
              >
                Four powerful pillars that cover every stage of your interview
                journey.
              </motion.p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {features.map((item, i) => (
                <FeatureCard key={i} item={item} index={i} />
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            HOW IT WORKS + MISSION/VISION (mobile)
        ══════════════════════════════════════ */}
        <section
          className="relative py-28 overflow-hidden"
          style={{ background: "var(--c-white)" }}
        >
          <GridTexture />
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-150 h-75 rounded-full blur-[120px] opacity-15 pointer-events-none"
            style={{
              background:
                "radial-gradient(circle, var(--c-amber-l), transparent 70%)",
            }}
          />

          <div className="relative mx-auto max-w-7xl px-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-start">
              {/* How it works */}
              <div>
                <SectionLabel>How It Works</SectionLabel>
                <motion.h2
                  className="text-4xl font-black tracking-tight mb-3"
                  style={{ color: "var(--c-ink)" }}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                >
                  Four steps to your next offer.
                </motion.h2>
                <motion.p
                  className="text-base mb-12"
                  style={{ color: "var(--c-ink-70)" }}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 }}
                >
                  From setup to feedback in minutes — not weeks.
                </motion.p>
                <div className="flex flex-col">
                  {steps.map((step, i) => (
                    <TimelineStep
                      key={i}
                      step={step}
                      index={i}
                      isLast={i === steps.length - 1}
                    />
                  ))}
                </div>
              </div>

              {/* Why Talk2Hire */}
              <div>
                <SectionLabel>Why Talk2Hire</SectionLabel>
                <motion.h2
                  className="text-4xl font-black tracking-tight mb-3"
                  style={{ color: "var(--c-ink)" }}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                >
                  Built different, by design.
                </motion.h2>
                <motion.p
                  className="text-base mb-10"
                  style={{ color: "var(--c-ink-70)" }}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 }}
                >
                  We didn't just build another interview tool. We rethought the
                  entire experience.
                </motion.p>

                <div className="flex flex-col gap-4">
                  {[
                    {
                      icon: CheckCircle,
                      color: "var(--c-sage)",
                      bg: "var(--c-sage-l)",
                      title: "Real AI, not scripts",
                      desc: "Every question adapts to your previous answer — just like a real interviewer.",
                    },
                    {
                      icon: TrendingUp,
                      color: "var(--c-sky)",
                      bg: "var(--c-sky-l)",
                      title: "Progress you can see",
                      desc: "Track your score trends across sessions with visual charts and breakdowns.",
                    },
                    {
                      icon: Award,
                      color: "var(--c-amber)",
                      bg: "var(--c-amber-l)",
                      title: "Industry-verified questions",
                      desc: "Our question banks are curated from actual interview experiences at top companies.",
                    },
                    {
                      icon: Users,
                      color: "var(--c-violet)",
                      bg: "var(--c-violet-l)",
                      title: "Community-backed",
                      desc: "8,200+ professionals have used Talk2Hire to land roles at companies they love.",
                    },
                  ].map((item, i) => {
                    const Icon = item.icon;
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: 20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.1, duration: 0.5 }}
                        whileHover={{ x: 4 }}
                        className="flex items-start gap-4 p-5 rounded-2xl border group"
                        style={{
                          background: "var(--c-white)",
                          borderColor: "var(--c-border)",
                          boxShadow: "var(--sh-sm)",
                          transition: "box-shadow 0.2s",
                        }}
                      >
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform"
                          style={{ backgroundColor: item.bg }}
                        >
                          <Icon size={17} style={{ color: item.color }} />
                        </div>
                        <div>
                          <p
                            className="font-bold text-sm mb-1"
                            style={{ color: "var(--c-ink)" }}
                          >
                            {item.title}
                          </p>
                          <p
                            className="text-xs leading-relaxed"
                            style={{ color: "var(--c-ink-70)" }}
                          >
                            {item.desc}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            CTA BANNER
        ══════════════════════════════════════ */}
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
            className="absolute top-[-30%] left-1/2 -translate-x-1/2 w-150 h-100 rounded-full blur-[160px] opacity-20 pointer-events-none"
            style={{ backgroundColor: "var(--c-amber)" }}
          />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative text-center px-6"
          >
            {/* pill */}
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-7"
              style={{
                background: "var(--c-amber-l)",
                borderColor: "rgba(217,119,6,0.25)",
              }}
            >
              <Zap size={11} style={{ color: "var(--c-amber)" }} />
              <span
                className="text-xs font-bold uppercase tracking-[0.2em]"
                style={{ color: "var(--c-amber)" }}
              >
                No credit card required
              </span>
            </div>

            <h2 className="text-4xl sm:text-6xl font-black text-white mb-5 tracking-tight leading-[1.04]">
              Your next role
              <br />
              is waiting.
            </h2>
            <p className="text-white/50 mb-10 max-w-md mx-auto text-base leading-relaxed">
              Start practicing today. Our AI is ready to interview you right now
              — no setup, no waiting, no excuses.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <motion.button
                onClick={() => navigate("/interview?job=12")}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 font-bold text-sm rounded-xl shadow-lg"
                style={{
                  background: "var(--c-white)",
                  color: "var(--c-slate)",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Start Your Interview <ArrowRight size={15} />
              </motion.button>
              <motion.button
                onClick={() => navigate("/jobs")}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 font-semibold text-sm rounded-xl border text-white"
                style={{
                  background: "rgba(255,255,255,0.1)",
                  borderColor: "rgba(255,255,255,0.2)",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Browse Jobs
              </motion.button>
            </div>

            <Ornament />

            <div className="flex flex-wrap justify-center gap-12 mt-6">
              {[
                { icon: Award, value: "4.9/5", label: "Avg. rating" },
                { icon: Users, value: "8,200+", label: "Hired this year" },
                { icon: Globe, value: "4", label: "Domains covered" },
              ].map(({ icon: Icon, value, label }) => (
                <div key={label} className="text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <Icon size={13} style={{ color: "var(--c-amber)" }} />
                    <p className="text-2xl font-black text-white">{value}</p>
                  </div>
                  <p
                    className="text-xs"
                    style={{ color: "rgba(255,255,255,0.35)" }}
                  >
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        </section>
      </div>
    </>
  );
};

export default AboutPage;

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

// ─── Inline SVG ───────────────────────────────────────────────────────────────
const Svg = ({ d, size = 20, className = "", sw = 1.8, fill = "none" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={fill}
    stroke="currentColor"
    strokeWidth={sw}
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
  Sparkles: (p) => (
    <Svg
      {...p}
      d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
    />
  ),
  Brain: (p) => (
    <Svg
      {...p}
      d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"
    />
  ),
  Shield: (p) => <Svg {...p} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  Zap: (p) => <Svg {...p} d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />,
  Rocket: (p) => (
    <Svg
      {...p}
      d={[
        "M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z",
        "M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z",
        "M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0",
        "M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5",
      ]}
    />
  ),
  Check: (p) => <Svg {...p} sw={2.5} d="M20 6 9 17l-5-5" />,
  ChevRight: (p) => <Svg {...p} d="m9 18 6-6-6-6" />,
  ChevLeft: (p) => <Svg {...p} d="m15 18-6-6 6-6" />,
  X: (p) => <Svg {...p} d="M18 6 6 18M6 6l12 12" />,
  ArrowRight: (p) => <Svg {...p} d={["M5 12h14", "M12 5l7 7-7 7"]} />,
};

// ─── Slide data ───────────────────────────────────────────────────────────────
const SLIDES = [
  {
    icon: Ic.Sparkles,
    accent: "from-indigo-500 to-violet-600",
    accentLight: "bg-indigo-50",
    accentText: "text-indigo-600",
    accentBorder: "border-indigo-200",
    iconBg: "bg-indigo-100",
    iconColor: "text-indigo-600",
    tag: "Welcome",
    title: "Welcome to\nTalk2Hire",
    desc: "Experience the future of technical interviews with our cutting-edge AI-powered platform designed for top performers.",
    features: [
      { text: "Real-time voice interviews" },
      { text: "Intelligent question generation" },
      { text: "Instant feedback & scoring" },
    ],
    visual: { count: "10K+", label: "Candidates placed" },
  },
  {
    icon: Ic.Brain,
    accent: "from-sky-500 to-indigo-600",
    accentLight: "bg-sky-50",
    accentText: "text-sky-600",
    accentBorder: "border-sky-200",
    iconBg: "bg-sky-100",
    iconColor: "text-sky-600",
    tag: "AI Analysis",
    title: "AI-Powered\nAnalysis",
    desc: "Our advanced AI analyzes your resume and creates personalized interview questions tailored precisely to your expertise.",
    features: [
      { text: "Resume parsing & skill extraction" },
      { text: "Domain detection & mapping" },
      { text: "Custom question generation" },
    ],
    visual: { count: "98%", label: "Accuracy rate" },
  },
  {
    icon: Ic.Zap,
    accent: "from-amber-500 to-orange-500",
    accentLight: "bg-amber-50",
    accentText: "text-amber-600",
    accentBorder: "border-amber-200",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    tag: "Quick Setup",
    title: "Instant\nProfile Setup",
    desc: "Upload your resume and let our AI extract your information automatically — no tedious manual data entry required.",
    features: [
      { text: "One-click resume upload" },
      { text: "Automatic data extraction" },
      { text: "Smart profile completion" },
    ],
    visual: { count: "30s", label: "Average setup time" },
  },
  {
    icon: Ic.Shield,
    accent: "from-emerald-500 to-teal-600",
    accentLight: "bg-emerald-50",
    accentText: "text-emerald-600",
    accentBorder: "border-emerald-200",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
    tag: "Security",
    title: "Secure\n& Private",
    desc: "Your data is encrypted and protected with enterprise-grade security. We never share your information without explicit permission.",
    features: [
      { text: "End-to-end encryption" },
      { text: "GDPR compliant" },
      { text: "Privacy-first approach" },
    ],
    visual: { count: "256-bit", label: "Encryption standard" },
  },
  {
    icon: Ic.Rocket,
    accent: "from-violet-500 to-purple-600",
    accentLight: "bg-violet-50",
    accentText: "text-violet-600",
    accentBorder: "border-violet-200",
    iconBg: "bg-violet-100",
    iconColor: "text-violet-600",
    tag: "Get Started",
    title: "Ready to\nGet Started?",
    desc: "Join thousands of candidates who are acing their interviews with our AI-powered platform. Your dream job awaits.",
    features: [
      { text: "Start interviewing in minutes" },
      { text: "Track your progress" },
      { text: "Improve with AI feedback" },
    ],
    visual: { count: "95%", label: "Success rate" },
  },
];

// ─── Welcome Carousel ─────────────────────────────────────────────────────────
const WelcomeCarousel = ({ onComplete }) => {
  const [current, setCurrent] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    if (!autoPlay) return;
    const t = setInterval(() => {
      setCurrent((p) => {
        if (p === SLIDES.length - 1) {
          setAutoPlay(false);
          return p;
        }
        return p + 1;
      });
    }, 5000);
    return () => clearInterval(t);
  }, [autoPlay]);

  const go = (idx) => {
    setDirection(idx > current ? 1 : -1);
    setCurrent(idx);
    setAutoPlay(false);
  };
  const next = () => {
    if (current === SLIDES.length - 1) {
      onComplete?.();
      return;
    }
    setDirection(1);
    setCurrent((c) => c + 1);
    setAutoPlay(false);
  };
  const prev = () => {
    if (current === 0) return;
    setDirection(-1);
    setCurrent((c) => c - 1);
    setAutoPlay(false);
  };

  const slide = SLIDES[current];
  const Icon = slide.icon;
  const isLast = current === SLIDES.length - 1;

  const variants = {
    enter: (d) => ({ opacity: 0, x: d > 0 ? 60 : -60 }),
    center: { opacity: 1, x: 0 },
    exit: (d) => ({ opacity: 0, x: d > 0 ? -60 : 60 }),
  };

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');`}</style>

      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-linear-to-br from-slate-50 via-white to-indigo-50/40 overflow-hidden"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        {/* Ambient glow that shifts per slide */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div
            key={current + "-a"}
            animate={{ opacity: 1 }}
            initial={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className={`absolute -top-32 -left-32 w-lg h-lg rounded-full bg-linear-to-br ${slide.accent} opacity-10 blur-[120px]`}
          />
          <motion.div
            key={current + "-b"}
            animate={{ opacity: 1 }}
            initial={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className={`absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-linear-to-br ${slide.accent} opacity-10 blur-[100px]`}
          />
        </div>

        {/* Skip */}
        {!isLast && (
          <button
            onClick={onComplete}
            className="absolute top-6 right-6 z-20 flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-slate-700 transition-colors px-3 py-2 rounded-xl hover:bg-slate-100"
          >
            Skip <Ic.X size={14} />
          </button>
        )}

        {/* Main card */}
        <div className="relative z-10 w-full max-w-3xl mx-4">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl shadow-slate-200/60 overflow-hidden">
            {/* Progress bar */}
            <div className="h-1 bg-slate-100">
              <motion.div
                animate={{ width: `${((current + 1) / SLIDES.length) * 100}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className={`h-full rounded-full bg-linear-to-r ${slide.accent}`}
              />
            </div>

            <div className="p-8 sm:p-12">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={current}
                  custom={direction}
                  variants={variants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-8 sm:gap-12 items-center">
                    {/* Left / Main content */}
                    <div className="sm:col-span-3 space-y-6">
                      {/* Tag */}
                      <div
                        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full ${slide.accentLight} border ${slide.accentBorder}`}
                      >
                        <div
                          className={`w-5 h-5 rounded-lg ${slide.iconBg} flex items-center justify-center`}
                        >
                          <Icon size={11} className={slide.iconColor} />
                        </div>
                        <span
                          className={`text-xs font-bold ${slide.accentText} uppercase tracking-wider`}
                        >
                          {slide.tag}
                        </span>
                      </div>

                      {/* Headline */}
                      <h2
                        className="text-3xl sm:text-4xl xl:text-5xl font-black text-slate-900 leading-[1.05] tracking-tight"
                        style={{ fontFamily: "'Syne', sans-serif" }}
                      >
                        {slide.title.split("\n").map((line, i) => (
                          <span key={i}>
                            {i === 1 ? (
                              <span
                                className={`bg-linear-to-r ${slide.accent} bg-clip-text text-transparent`}
                              >
                                {line}
                              </span>
                            ) : (
                              line
                            )}
                            {i === 0 && <br />}
                          </span>
                        ))}
                      </h2>

                      {/* Description */}
                      <p className="text-slate-500 text-base leading-relaxed">
                        {slide.desc}
                      </p>

                      {/* Features */}
                      <div className="space-y-2.5">
                        {slide.features.map((f, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1, duration: 0.4 }}
                            className="flex items-center gap-3"
                          >
                            <div
                              className={`w-5 h-5 rounded-full ${slide.iconBg} flex items-center justify-center shrink-0`}
                            >
                              <Ic.Check size={10} className={slide.iconColor} />
                            </div>
                            <span className="text-sm font-medium text-slate-700">
                              {f.text}
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    {/* Right / Visual */}
                    <div className="sm:col-span-2 flex flex-col items-center gap-5">
                      {/* Big icon */}
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                        className={`w-28 h-28 rounded-3xl bg-linear-to-br ${slide.accent} flex items-center justify-center shadow-2xl`}
                        style={{
                          boxShadow: `0 20px 60px rgba(99,102,241,0.25)`,
                        }}
                      >
                        <motion.div
                          animate={{ rotate: [0, 5, -5, 0] }}
                          transition={{
                            duration: 4,
                            repeat: Infinity,
                            ease: "easeInOut",
                          }}
                        >
                          <Icon size={52} className="text-white" />
                        </motion.div>
                      </motion.div>

                      {/* Stat card */}
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.4 }}
                        className={`w-full p-5 rounded-2xl ${slide.accentLight} border ${slide.accentBorder} text-center`}
                      >
                        <p
                          className={`text-4xl font-black ${slide.accentText} mb-1`}
                          style={{ fontFamily: "'Syne', sans-serif" }}
                        >
                          {slide.visual.count}
                        </p>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          {slide.visual.label}
                        </p>
                      </motion.div>

                      {/* Mini dots for sm screens only */}
                      <div className="flex gap-2 sm:hidden">
                        {SLIDES.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => go(i)}
                            className={`w-1.5 rounded-full transition-all duration-300 ${i === current ? "w-6 bg-slate-700" : "bg-slate-300"} h-1.5`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer controls */}
            <div className="px-8 sm:px-12 pb-8 sm:pb-10">
              <div className="flex items-center justify-between gap-4">
                {/* Dots (hidden on mobile — shown in content) */}
                <div className="hidden sm:flex gap-2 items-center">
                  {SLIDES.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => go(i)}
                      className="relative flex items-center justify-center"
                    >
                      <motion.div
                        animate={{
                          width: i === current ? 28 : 8,
                          backgroundColor:
                            i === current ? "#1e293b" : "#e2e8f0",
                        }}
                        transition={{ duration: 0.3 }}
                        className="h-2 rounded-full"
                        style={{ width: i === current ? 28 : 8 }}
                      />
                    </button>
                  ))}
                </div>

                {/* Nav buttons */}
                <div className="flex items-center gap-3 ml-auto">
                  {current > 0 && (
                    <button
                      onClick={prev}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-sm font-semibold hover:bg-slate-200 transition-colors"
                    >
                      <Ic.ChevLeft size={15} /> Back
                    </button>
                  )}
                  <motion.button
                    whileHover={{
                      scale: 1.03,
                      boxShadow: "0 10px 30px rgba(99,102,241,0.3)",
                    }}
                    whileTap={{ scale: 0.97 }}
                    onClick={next}
                    className={`flex items-center gap-2 px-7 py-3 rounded-xl bg-linear-to-r ${slide.accent} text-white font-bold text-sm shadow-lg transition-all`}
                    style={{ fontFamily: "'Syne', sans-serif" }}
                  >
                    {isLast ? (
                      <>
                        Let's Go! <Ic.Rocket size={15} />
                      </>
                    ) : (
                      <>
                        Next <Ic.ChevRight size={15} />
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
            </div>
          </div>

          {/* Slide counter outside card */}
          <div className="text-center mt-5">
            <span className="text-xs font-semibold text-slate-400">
              {current + 1} of {SLIDES.length}
            </span>
          </div>
        </div>
      </div>
    </>
  );
};

export default WelcomeCarousel;

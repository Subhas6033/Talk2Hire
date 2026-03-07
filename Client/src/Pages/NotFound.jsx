import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { Home, ArrowLeft, Search, Compass } from "lucide-react";

/* ══════════════════════════════════════════
   Design Tokens — matches site palette
══════════════════════════════════════════ */
const TOKENS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Playfair+Display:wght@700;900&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap');

  :root {
    --c-cream:   #faf9f7;
    --c-white:   #ffffff;
    --c-ink:     #0d0d12;
    --c-ink-70:  rgba(13,13,18,0.70);
    --c-ink-40:  rgba(13,13,18,0.40);
    --c-ink-12:  rgba(13,13,18,0.08);
    --c-slate:   #1e2235;
    --c-slate-2: #2d3352;
    --c-slate-3: #3d4570;
    --c-amber:   #d97706;
    --c-amber-l: #fef3c7;
    --c-amber-2: #f59e0b;
    --c-amber-3: #fde68a;
    --c-border:  rgba(13,13,18,0.09);
    --sh-sm: 0 1px 3px rgba(13,13,18,.07), 0 1px 2px rgba(13,13,18,.05);
    --sh-md: 0 4px 18px rgba(13,13,18,.08), 0 2px 6px rgba(13,13,18,.05);
    --sh-lg: 0 20px 60px rgba(13,13,18,.11), 0 8px 20px rgba(13,13,18,.07);
    --sh-xl: 0 32px 80px rgba(13,13,18,.15);
  }

  .nf-root { font-family: 'DM Sans', sans-serif; }
  .nf-root h1, .nf-root h2 {
    font-family: 'Playfair Display', Georgia, serif;
  }

  @keyframes floatY {
    0%, 100% { transform: translateY(0px) rotate(-2deg); }
    50%       { transform: translateY(-18px) rotate(2deg); }
  }
  @keyframes floatY2 {
    0%, 100% { transform: translateY(0px) rotate(3deg); }
    50%       { transform: translateY(-12px) rotate(-1deg); }
  }
  @keyframes floatY3 {
    0%, 100% { transform: translateY(0px); }
    50%       { transform: translateY(-8px); }
  }
  .float-1 { animation: floatY  5s ease-in-out infinite; }
  .float-2 { animation: floatY2 6.5s ease-in-out infinite 0.8s; }
  .float-3 { animation: floatY3 4s ease-in-out infinite 1.5s; }
`;

/* ══════════════════════════════════════════
   Corner Glows — same as contact/homepage
══════════════════════════════════════════ */
const CornerGlow = () => (
  <>
    <div
      className="absolute top-0 right-0 w-125 h-125 rounded-full pointer-events-none"
      style={{
        background:
          "radial-gradient(circle at 80% 20%, #fef3c7 0%, #fde68a 30%, transparent 70%)",
        opacity: 0.65,
        filter: "blur(70px)",
      }}
    />
    <div
      className="absolute bottom-0 left-0 w-105 h-105 rounded-full pointer-events-none"
      style={{
        background:
          "radial-gradient(circle at 20% 80%, #fef9ee 0%, #fde68a 25%, transparent 65%)",
        opacity: 0.5,
        filter: "blur(80px)",
      }}
    />
    <div
      className="absolute top-1/2 left-[-5%] w-70 h-70 rounded-full pointer-events-none"
      style={{
        background: "radial-gradient(circle, #fef3c7 0%, transparent 70%)",
        opacity: 0.35,
        filter: "blur(90px)",
      }}
    />
  </>
);

/* ══════════════════════════════════════════
   Grid Texture
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
   Floating digit card
══════════════════════════════════════════ */
const FloatingDigit = ({ digit, floatClass, delay = 0 }) => (
  <motion.div
    className={`${floatClass} select-none`}
    initial={{ opacity: 0, scale: 0.6, y: 30 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    transition={{
      delay,
      duration: 0.7,
      type: "spring",
      stiffness: 180,
      damping: 16,
    }}
  >
    <div
      className="relative flex items-center justify-center rounded-3xl border"
      style={{
        width: "clamp(110px, 18vw, 160px)",
        height: "clamp(130px, 22vw, 190px)",
        background: "var(--c-white)",
        borderColor: "var(--c-border)",
        boxShadow: "var(--sh-lg)",
      }}
    >
      {/* amber top accent */}
      <div
        className="absolute top-0 left-6 right-6 h-1 rounded-b-full"
        style={{
          background:
            "linear-gradient(90deg, var(--c-amber-3), var(--c-amber), var(--c-amber-3))",
        }}
      />
      <span
        style={{
          fontFamily: "'Space Mono', 'Courier New', monospace",
          fontSize: "clamp(56px, 10vw, 88px)",
          fontWeight: 700,
          lineHeight: 1,
          letterSpacing: "-0.04em",
          background:
            "linear-gradient(160deg, var(--c-slate) 0%, var(--c-slate-3) 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        {digit}
      </span>
    </div>
  </motion.div>
);

/* ══════════════════════════════════════════
   CTA Button variants
══════════════════════════════════════════ */
const PrimaryBtn = ({ children, onClick, icon: Icon }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileTap={{ scale: 0.96 }}
      className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl font-bold text-sm text-white cursor-pointer border-0 outline-none"
      style={{
        fontFamily: "'DM Sans', sans-serif",
        background: "var(--c-slate)",
        boxShadow: hovered
          ? "0 12px 36px rgba(30,34,53,0.28), 0 4px 12px rgba(30,34,53,0.15)"
          : "var(--sh-md)",
        transition: "box-shadow 0.25s",
      }}
    >
      {Icon && <Icon size={15} />}
      <span>{children}</span>
      <motion.div
        animate={{ x: hovered ? 4 : 0 }}
        transition={{ type: "spring", stiffness: 300 }}
      >
        <ArrowLeft size={14} style={{ transform: "rotate(180deg)" }} />
      </motion.div>
    </motion.button>
  );
};

const SecondaryBtn = ({ children, onClick, icon: Icon }) => (
  <motion.button
    onClick={onClick}
    whileHover={{ y: -2, boxShadow: "var(--sh-md)" }}
    whileTap={{ scale: 0.96 }}
    className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl font-semibold text-sm cursor-pointer border outline-none"
    style={{
      fontFamily: "'DM Sans', sans-serif",
      background: "var(--c-white)",
      borderColor: "var(--c-border)",
      color: "var(--c-ink-70)",
      boxShadow: "var(--sh-sm)",
      transition: "box-shadow 0.25s",
    }}
  >
    {Icon && <Icon size={15} />}
    <span>{children}</span>
  </motion.button>
);

/* ══════════════════════════════════════════
   Suggestion Link chip
══════════════════════════════════════════ */
const SuggestionChip = ({ label, path, navigate, delay }) => (
  <motion.button
    onClick={() => navigate(path)}
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.4 }}
    whileHover={{
      y: -3,
      backgroundColor: "var(--c-amber-l)",
      borderColor: "rgba(217,119,6,0.3)",
    }}
    whileTap={{ scale: 0.96 }}
    className="px-4 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-colors duration-200"
    style={{
      background: "var(--c-white)",
      borderColor: "var(--c-border)",
      color: "var(--c-ink-70)",
      boxShadow: "var(--sh-sm)",
    }}
  >
    {label}
  </motion.button>
);

/* ══════════════════════════════════════════
   Main NotFoundPage
══════════════════════════════════════════ */
const NotFoundPage = () => {
  const navigate = useNavigate();

  const suggestions = [
    { label: "🏠 Home", path: "/" },
    { label: "💼 Browse Jobs", path: "/jobs" },
    { label: "📞 Contact Us", path: "/contact" },
    { label: "🔑 Sign In", path: "/login" },
  ];

  return (
    <>
      <style>{TOKENS}</style>
      <title>Talk2Hire | Not Found</title>

      <motion.div
        className="nf-root relative min-h-screen overflow-hidden flex flex-col items-center justify-center px-4 py-20"
        style={{ background: "var(--c-white)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.45 }}
      >
        <GridTexture />
        <CornerGlow />
        {/* Decorative rings */}
        <div
          className="absolute top-10 right-14 w-44 h-44 rounded-full border pointer-events-none"
          style={{ borderColor: "rgba(217,119,6,0.10)" }}
        />
        <div
          className="absolute top-20 right-22 w-24 h-24 rounded-full border pointer-events-none"
          style={{ borderColor: "rgba(217,119,6,0.07)" }}
        />
        <div
          className="absolute bottom-14 left-10 w-36 h-36 rounded-full border pointer-events-none"
          style={{ borderColor: "rgba(217,119,6,0.09)" }}
        />
        <div
          className="absolute bottom-26 left-20 w-20 h-20 rounded-full border pointer-events-none"
          style={{ borderColor: "rgba(217,119,6,0.06)" }}
        />
        {/* ── Content ── */}
        <div className="relative z-10 flex flex-col items-center text-center max-w-7xl w-full">
          {/* Status pill */}
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-10"
            style={{
              background: "var(--c-amber-l)",
              borderColor: "rgba(217,119,6,0.25)",
            }}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            <Compass size={12} style={{ color: "var(--c-amber)" }} />
            <span
              className="text-xs font-bold uppercase tracking-[0.2em]"
              style={{ color: "var(--c-amber)" }}
            >
              Page not found
            </span>
          </motion.div>

          {/* ── 404 floating digits ── */}
          <div className="flex items-center justify-center gap-4 mb-12">
            <FloatingDigit digit="4" floatClass="float-1" delay={0.2} />

            {/* Center icon */}
            <motion.div
              className="float-3 flex flex-col items-center gap-2"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                delay: 0.4,
                duration: 0.6,
                type: "spring",
                stiffness: 200,
              }}
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center border"
                style={{
                  background: "var(--c-amber-l)",
                  borderColor: "rgba(217,119,6,0.2)",
                  boxShadow: "0 8px 28px rgba(217,119,6,0.15)",
                }}
              >
                <Search size={26} style={{ color: "var(--c-amber)" }} />
              </div>
              {/* squiggle line */}
              <svg width="48" height="8" viewBox="0 0 48 8" fill="none">
                <motion.path
                  d="M2 5 Q12 1 24 5 Q36 9 46 4"
                  stroke="#d97706"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  fill="none"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ delay: 0.9, duration: 0.7, ease: "easeOut" }}
                />
              </svg>
            </motion.div>

            <FloatingDigit digit="4" floatClass="float-2" delay={0.3} />
          </div>

          {/* Heading */}
          <motion.h1
            className="mb-4 leading-[1.08] tracking-tight"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: "clamp(28px, 5vw, 42px)",
              fontWeight: 900,
              color: "var(--c-ink)",
            }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            Looks like you're{" "}
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
              lost
            </span>
          </motion.h1>

          <motion.p
            className="text-base leading-relaxed mb-10 max-w-sm"
            style={{ color: "var(--c-ink-70)" }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.55 }}
          >
            The page you're looking for doesn't exist or has been moved. Let's
            get you back on track.
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.5 }}
          >
            <PrimaryBtn onClick={() => navigate("/")} icon={Home}>
              Go to Home
            </PrimaryBtn>
            <SecondaryBtn onClick={() => navigate(-1)} icon={ArrowLeft}>
              Go Back
            </SecondaryBtn>
          </motion.div>

          {/* Divider */}
          <motion.div
            className="flex items-center gap-3 w-full max-w-xs mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            <div
              className="h-px flex-1 rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, transparent, var(--c-border))",
              }}
            />
            <span
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: "var(--c-ink-40)" }}
            >
              or try these
            </span>
            <div
              className="h-px flex-1 rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, var(--c-border), transparent)",
              }}
            />
          </motion.div>

          {/* Suggestion chips */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {suggestions.map((s, i) => (
              <SuggestionChip
                key={s.path}
                label={s.label}
                path={s.path}
                navigate={navigate}
                delay={0.85 + i * 0.07}
              />
            ))}
          </div>
        </div>
        {/* Footer line */}
        <motion.div
          className="relative z-10 mt-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
        >
          <div className="flex items-center gap-3 justify-center mb-3">
            <div
              className="h-px w-10 rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(217,119,6,0.25))",
              }}
            />
            <span style={{ color: "rgba(217,119,6,0.35)", fontSize: 10 }}>
              ✦
            </span>
            <div
              className="h-px w-10 rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, rgba(217,119,6,0.25), transparent)",
              }}
            />
          </div>
          <p
            className="text-center text-xs font-medium tracking-wider"
            style={{ color: "var(--c-ink-40)" }}
          >
            &copy; {new Date().getFullYear()} Talk2Hire · All rights reserved
          </p>
        </motion.div>
      </motion.div>
    </>
  );
};

export default NotFoundPage;

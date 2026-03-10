import { motion } from "framer-motion";

const TOKENS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap');

  :root {
    --c-cream:    #faf9f7;
    --c-white:    #ffffff;
    --c-ink:      #0d0d12;
    --c-ink-70:   rgba(13,13,18,0.70);
    --c-ink-40:   rgba(13,13,18,0.40);
    --c-ink-12:   rgba(13,13,18,0.08);
    --c-slate:    #1e2235;
    --c-slate-2:  #2d3352;
    --c-amber:    #d97706;
    --c-amber-l:  #fef3c7;
    --c-border:   rgba(13,13,18,0.09);
    --sh-lg:  0 20px 60px rgba(13,13,18,.11), 0 8px 20px rgba(13,13,18,.07);
  }

  .loader-root {
    font-family: 'DM Sans', sans-serif;
  }
  .loader-root h1, .loader-root h2 {
    font-family: 'Playfair Display', Georgia, serif;
  }

  @keyframes grid-fade {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.7; }
  }

  @keyframes shimmer {
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
  }

  .shimmer-text {
    background: linear-gradient(
      90deg,
      var(--c-ink-40) 0%,
      var(--c-ink) 40%,
      var(--c-amber) 50%,
      var(--c-ink) 60%,
      var(--c-ink-40) 100%
    );
    background-size: 200% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: shimmer 2.8s linear infinite;
  }

  .orbit-ring {
    position: absolute;
    border-radius: 50%;
    border: 1.5px solid var(--c-border);
  }
`;

const T2HLogo = () => (
  <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
    <rect width="32" height="32" rx="8" fill="var(--c-slate)" />
    <text
      x="16"
      y="22"
      textAnchor="middle"
      fill="white"
      fontSize="13"
      fontWeight="900"
      fontFamily="Playfair Display, serif"
    >
      T2H
    </text>
  </svg>
);

export default function Loader({ label = "Loading" }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="loader-root flex min-h-screen flex-col items-center justify-center relative overflow-hidden"
      style={{ backgroundColor: "var(--c-cream)" }}
    >
      <style>{TOKENS}</style>

      {/* Background grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(var(--c-border) 1px, transparent 1px), linear-gradient(90deg, var(--c-border) 1px, transparent 1px)",
          backgroundSize: "52px 52px",
          animation: "grid-fade 3s ease-in-out infinite",
        }}
      />

      {/* Ambient glow blobs */}
      <div
        className="absolute top-[-15%] right-[-10%] w-105 h-105 rounded-full blur-[160px] opacity-50 pointer-events-none"
        style={{ backgroundColor: "#fef3c7" }}
      />
      <div
        className="absolute bottom-[-10%] left-[-8%] w-85 h-85 rounded-full blur-[120px] opacity-40 pointer-events-none"
        style={{ backgroundColor: "#e0e7ff" }}
      />

      {/* Center composition */}
      <div className="relative flex flex-col items-center gap-10 z-10">
        {/* Orbital ring system */}
        <div className="relative w-40 h-40 flex items-center justify-center">
          {/* Outer pulsing ring */}
          <motion.div
            className="absolute rounded-full border border-(--c-border)"
            style={{ width: 160, height: 160 }}
            animate={{ scale: [1, 1.06, 1], opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Middle ring */}
          <motion.div
            className="absolute rounded-full"
            style={{
              width: 120,
              height: 120,
              border: "1.5px solid rgba(13,13,18,0.12)",
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
          >
            {/* Orbiting amber dot */}
            <motion.div
              className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full shadow-md"
              style={{ backgroundColor: "var(--c-amber)" }}
            />
          </motion.div>

          {/* Inner ring (counter-rotate) */}
          <motion.div
            className="absolute rounded-full"
            style={{
              width: 80,
              height: 80,
              border: "1.5px solid rgba(13,13,18,0.08)",
            }}
            animate={{ rotate: -360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          >
            {/* Orbiting slate dot */}
            <motion.div
              className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full"
              style={{ backgroundColor: "var(--c-slate)" }}
            />
          </motion.div>

          {/* Center logo card */}
          <motion.div
            className="relative z-10 flex items-center justify-center w-14 h-14 rounded-2xl bg-white shadow-(--sh-lg) border border-(--c-border)"
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <T2HLogo />
          </motion.div>
        </div>

        {/* Label area */}
        <div className="text-center space-y-2.5">
          <motion.h2
            className="shimmer-text text-2xl font-black tracking-tight"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {label}
          </motion.h2>
          <motion.p
            className="text-sm font-medium"
            style={{ color: "var(--c-ink-40)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            Talk2Hire is thinking…
          </motion.p>
        </div>

        {/* Animated progress bar */}
        <motion.div
          className="w-48 h-1 rounded-full overflow-hidden"
          style={{ backgroundColor: "var(--c-ink-12)" }}
          initial={{ opacity: 0, scaleX: 0.6 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          <motion.div
            className="h-full rounded-full origin-left"
            style={{
              background:
                "linear-gradient(90deg, var(--c-slate) 0%, var(--c-amber) 100%)",
            }}
            animate={{ x: ["-100%", "100%"] }}
            transition={{
              duration: 1.6,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </motion.div>

        {/* Dot trio */}
        <div className="flex gap-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="block rounded-full"
              style={{
                width: i === 1 ? 8 : 6,
                height: i === 1 ? 8 : 6,
                backgroundColor: i === 1 ? "var(--c-amber)" : "var(--c-ink-12)",
              }}
              animate={{
                y: [0, -6, 0],
                opacity: [0.4, 1, 0.4],
              }}
              transition={{
                duration: 1.1,
                repeat: Infinity,
                delay: i * 0.18,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      </div>

      {/* Bottom amber rule — mirrors the homepage section amber lines */}
      <motion.div
        className="absolute bottom-10 flex items-center gap-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <span
          className="w-8 h-px"
          style={{ backgroundColor: "var(--c-amber)" }}
        />
        <span
          className="text-[10px] uppercase tracking-[0.3em] font-bold"
          style={{ color: "var(--c-amber)" }}
        >
          Talk2Hire
        </span>
        <span
          className="w-8 h-px"
          style={{ backgroundColor: "var(--c-amber)" }}
        />
      </motion.div>
    </div>
  );
}

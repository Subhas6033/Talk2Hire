import { motion } from "framer-motion";

export default function Loader({ label = "" }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen flex-col items-center justify-center gap-6 bg-linear-to-br from-bgDark via-[#11162a] to-bgDark"
    >
      {/* Brain Pulse */}
      <motion.div
        className="relative flex h-24 w-24 items-center justify-center"
        aria-hidden
      >
        <motion.div
          className="absolute h-full w-full rounded-full border-4 border-slate-200/30"
          animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
        />
        <motion.div
          className="absolute h-full w-full rounded-full border-4 border-slate-200/50"
          animate={{ scale: [1, 1.25], opacity: [0.8, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, delay: 0.4 }}
        />
        <div className="z-10 flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-lg">
          🤖
        </div>
      </motion.div>

      {/* Text */}
      <div className="text-center">
        <p className="text-lg text-slate-200 font-semibold">{label}</p>
        <p className="mt-1 text-sm text-muted-foreground text-white">
          AI interviewer is thinking…
        </p>
      </div>

      {/* Progress Dots */}
      <div className="flex gap-2" aria-hidden>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-2 w-2 rounded-full bg-slate-200"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              delay: i * 0.2,
            }}
          />
        ))}
      </div>
    </div>
  );
}

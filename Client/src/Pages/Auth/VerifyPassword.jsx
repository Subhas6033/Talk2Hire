import React, { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "../../Hooks/useAuthHook";
import { motion, AnimatePresence } from "motion/react";
import {
  ShieldCheck,
  KeyRound,
  CheckCircle2,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

// ─────────────────────────────────────────────────────────────────────────────
// Primitives
// ─────────────────────────────────────────────────────────────────────────────

const Loader = () => (
  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
);

const DotGrid = () => (
  <div
    className="pointer-events-none absolute inset-0 opacity-[0.055]"
    style={{
      backgroundImage: "radial-gradient(circle, #6366f1 1px, transparent 1px)",
      backgroundSize: "28px 28px",
    }}
  />
);

const Blob = ({ className, gradient }) => (
  <div
    className={`pointer-events-none absolute rounded-full blur-[110px] ${className}`}
    style={{ background: gradient }}
  />
);

const PrimaryBtn = ({ children, className = "", disabled, ...props }) => (
  <button
    disabled={disabled}
    className={[
      "inline-flex items-center justify-center gap-2 rounded-xl",
      "bg-gradient-to-br from-indigo-500 to-violet-600 text-white",
      "text-sm font-semibold tracking-wide px-6 py-3",
      "shadow-[0_4px_15px_rgba(99,102,241,0.35)]",
      "transition-all duration-200 select-none",
      "hover:-translate-y-px hover:shadow-[0_8px_25px_rgba(99,102,241,0.45)]",
      "active:translate-y-0 active:scale-[0.99]",
      "focus:outline-none focus:ring-2 focus:ring-indigo-400/50 focus:ring-offset-2",
      "disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0",
      "disabled:shadow-[0_4px_15px_rgba(99,102,241,0.25)]",
      className,
    ].join(" ")}
    {...props}
  >
    {children}
  </button>
);

const GhostBtn = ({ children, className = "", ...props }) => (
  <button
    className={[
      "inline-flex items-center justify-center gap-1.5 rounded-xl",
      "px-3 py-1.5 text-sm font-medium",
      "text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50/80",
      "transition-all duration-150",
      "focus:outline-none focus:ring-2 focus:ring-indigo-300/50",
      "disabled:opacity-40 disabled:cursor-not-allowed",
      className,
    ].join(" ")}
    {...props}
  >
    {children}
  </button>
);

// ─────────────────────────────────────────────────────────────────────────────
// Step dots
// ─────────────────────────────────────────────────────────────────────────────

const StepDots = ({ step }) => (
  <div className="flex items-center justify-center gap-2 mb-6">
    {[1, 2].map((s) => (
      <motion.div
        key={s}
        animate={{
          width: step === s ? 28 : 8,
          backgroundColor: step >= s ? "#6366f1" : "#e2e8f0",
        }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="h-2 rounded-full"
      />
    ))}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// OTP box input
// ─────────────────────────────────────────────────────────────────────────────

const OtpInput = ({ value = "", onChange, hasError, disabled }) => {
  const inputRefs = useRef([]);
  const digits = Array.from({ length: 4 }, (_, i) => value[i] || "");

  const handleKey = (e, idx) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = [...digits];
      if (next[idx]) {
        next[idx] = "";
        onChange(next.join(""));
      } else if (idx > 0) {
        next[idx - 1] = "";
        onChange(next.join(""));
        inputRefs.current[idx - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    } else if (e.key === "ArrowRight" && idx < 3) {
      inputRefs.current[idx + 1]?.focus();
    }
  };

  const handleChange = (e, idx) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (!raw) return;
    const char = raw[raw.length - 1];
    const next = [...digits];
    next[idx] = char;
    onChange(next.join(""));
    if (idx < 3) inputRefs.current[idx + 1]?.focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 4);
    onChange(pasted);
    const focusIdx = Math.min(pasted.length, 3);
    inputRefs.current[focusIdx]?.focus();
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        padding: "4px 0",
      }}
    >
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (inputRefs.current[i] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          disabled={disabled}
          onChange={(e) => handleChange(e, i)}
          onKeyDown={(e) => handleKey(e, i)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          style={{
            width: "56px",
            height: "56px",
            minWidth: "56px",
            minHeight: "56px",
            textAlign: "center",
            fontSize: "20px",
            fontWeight: "700",
            borderRadius: "14px",
            border: `2px solid ${hasError ? "#fca5a5" : d ? "#818cf8" : "#e2e8f0"}`,
            background: hasError ? "#fef2f2" : d ? "#eef2ff" : "#f8fafc",
            color: "#1e293b",
            outline: "none",
            transition: "border-color 0.15s, background 0.15s",
            flexShrink: 0,
            boxSizing: "border-box",
            display: "block",
            opacity: disabled ? 0.5 : 1,
            cursor: disabled ? "not-allowed" : "text",
          }}
        />
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// OTP countdown + resend
// ─────────────────────────────────────────────────────────────────────────────

const OTP_SECONDS = 120;

const OtpTimer = ({ resending }) => {
  const [seconds, setSeconds] = useState(OTP_SECONDS);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (seconds <= 0) {
      setExpired(true);
      return;
    }
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [seconds]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const pct = (seconds / OTP_SECONDS) * 100;
  const isWarning = seconds < 30;

  return (
    <div className="flex items-center justify-center gap-2 mt-1">
      {expired ? (
        <p className="text-xs text-slate-500">
          OTP expired.{" "}
          <button
            type="button"
            className="text-indigo-600 font-medium hover:underline inline-flex items-center gap-1"
            disabled={resending}
          >
            <RefreshCw size={11} className={resending ? "animate-spin" : ""} />
            {resending ? "Sending…" : "Go back and resend"}
          </button>
        </p>
      ) : (
        <div className="flex items-center gap-2">
          <svg width="18" height="18" className="-rotate-90 shrink-0">
            <circle
              cx="9"
              cy="9"
              r="7"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="2"
            />
            <circle
              cx="9"
              cy="9"
              r="7"
              fill="none"
              stroke={isWarning ? "#f87171" : "#6366f1"}
              strokeWidth="2"
              strokeDasharray={`${2 * Math.PI * 7}`}
              strokeDashoffset={`${2 * Math.PI * 7 * (1 - pct / 100)}`}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 1s linear, stroke 0.5s" }}
            />
          </svg>
          <span
            className={`text-xs font-mono font-semibold tabular-nums ${isWarning ? "text-red-500" : "text-slate-500"}`}
          >
            {mm}:{ss}
          </span>
          <span className="text-xs text-slate-400">until expiry</span>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Password strength bar
// ─────────────────────────────────────────────────────────────────────────────

const getStrength = (pw = "") => {
  if (!pw) return { score: 0, label: "", color: "" };
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1)
    return { score, label: "Weak", color: "bg-red-400", text: "text-red-500" };
  if (score <= 2)
    return {
      score,
      label: "Fair",
      color: "bg-amber-400",
      text: "text-amber-500",
    };
  if (score <= 3)
    return {
      score,
      label: "Good",
      color: "bg-yellow-400",
      text: "text-yellow-600",
    };
  if (score === 4)
    return {
      score,
      label: "Strong",
      color: "bg-emerald-400",
      text: "text-emerald-600",
    };
  return {
    score,
    label: "Very strong",
    color: "bg-emerald-500",
    text: "text-emerald-600",
  };
};

const PasswordStrengthBar = ({ password }) => {
  const { score, label, color, text } = getStrength(password);
  if (!password) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i <= score ? color : "bg-slate-200"}`}
          />
        ))}
      </div>
      <p className={`text-[11px] font-semibold ${text}`}>{label}</p>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Error banner
// ─────────────────────────────────────────────────────────────────────────────

const ErrorBanner = ({ message }) =>
  message ? (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
      className="flex items-start gap-2.5 px-4 py-3 bg-red-50 border border-red-200/80 rounded-xl"
    >
      <svg
        className="w-4 h-4 text-red-500 mt-0.5 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <p className="text-xs font-medium text-red-600 leading-relaxed">
        {message}
      </p>
    </motion.div>
  ) : null;

// ─────────────────────────────────────────────────────────────────────────────
// Success screen
// ─────────────────────────────────────────────────────────────────────────────

const SuccessScreen = ({ onLogin }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.94 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    className="text-center py-4 space-y-5"
  >
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 280, damping: 17, delay: 0.08 }}
      className="flex justify-center"
    >
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-[0_8px_30px_rgba(52,211,153,0.40)]">
        <CheckCircle2 className="w-10 h-10 text-white" strokeWidth={1.8} />
      </div>
    </motion.div>
    <div>
      <h2 className="sora text-2xl font-bold text-slate-800 tracking-tight">
        Password updated!
      </h2>
      <p className="mt-2 text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">
        Your password has been reset successfully. Sign in with your new
        credentials.
      </p>
    </div>
    <PrimaryBtn onClick={onLogin} className="w-full">
      Back to Sign In
    </PrimaryBtn>
  </motion.div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

const slideVariants = {
  enter: (dir) => ({ opacity: 0, x: dir > 0 ? 52 : -52 }),
  center: { opacity: 1, x: 0 },
  exit: (dir) => ({ opacity: 0, x: dir > 0 ? -52 : 52 }),
};

const VerifyPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [otpValue, setOtpValue] = useState("");

  const {
    verifyOtp,
    updatePassword,
    verifyPasswordLoading: loading,
    verifyPasswordError: error,
    otpVerified,
    passwordReset,
    resetState,
    // Email carried over from the ForgotPassword page — no re-entry needed
    forgotPasswordEmail: email,
    hydrated,
  } = useAuth();

  // Guard: wait for Redux to hydrate, then redirect if no email in state.
  // Without the hydrated check this would fire on first render (email = null)
  // and immediately send the user away even though the state is about to load.
  useEffect(() => {
    if (hydrated && !email) {
      navigate("/forgot-password", { replace: true });
    }
  }, [hydrated, email, navigate]);

  // ── Step 1 form (OTP only) ───────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isValid },
  } = useForm({ mode: "onTouched", defaultValues: { otp: "" } });

  useEffect(() => {
    setValue("otp", otpValue, { shouldValidate: otpValue.length === 4 });
  }, [otpValue, setValue]);

  // ── Step 2 form ──────────────────────────────────────────────────────────
  const {
    register: reg2,
    handleSubmit: handleSubmit2,
    watch: watch2,
    formState: { errors: errors2, isValid: isValid2 },
  } = useForm({
    mode: "onTouched",
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  // Auto-advance to step 2 once OTP is verified
  useEffect(() => {
    if (otpVerified && step === 1) {
      setStep(2);
    }
  }, [otpVerified, step]);

  // email is already in Redux state — pass it directly, no local copy needed
  const onVerifyOtp = (data) => verifyOtp(email, data.otp);
  const onSetPassword = (data) =>
    updatePassword(email, data.newPassword, data.confirmPassword);

  // Don't render anything until Redux has rehydrated — prevents flash/redirect
  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50/60">
        <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
      </div>
    );
  }

  return (
    <>
      <title>Verify OTP | Talk2Hire Careers Portal</title>
      <meta
        name="description"
        content="Verify your OTP to securely reset your Talk2Hire account password."
      />
      <meta name="robots" content="noindex, nofollow" />
      <link rel="canonical" href="https://talk2hire.com/forgot-password" />
      <meta
        httpEquiv="Cache-Control"
        content="no-store, no-cache, must-revalidate"
      />
      <meta httpEquiv="Pragma" content="no-cache" />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=DM+Sans:wght@300;400;500&display=swap');
        @keyframes floatA { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-18px) scale(1.04)} }
        @keyframes floatB { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(14px) scale(0.97)} }
        @keyframes pulseRing {
          0%  {box-shadow:0 0 0 0   rgba(99,102,241,0.32)}
          70% {box-shadow:0 0 0 9px rgba(99,102,241,0)}
          100%{box-shadow:0 0 0 0   rgba(99,102,241,0)}
        }
        .blob-a{animation:floatA 9s ease-in-out infinite}
        .blob-b{animation:floatB 11s ease-in-out 1.5s infinite}
        .blob-c{animation:floatA 13s ease-in-out 3s infinite}
        .badge-pulse{animation:pulseRing 2s ease-out infinite}
        .sora{font-family:'Sora',sans-serif}
        .dm-sans{font-family:'DM Sans',sans-serif}
      `}</style>

      <section className="dm-sans relative min-h-screen overflow-hidden flex items-center justify-center px-4 py-16 bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50/60">
        <DotGrid />
        <Blob
          className="blob-a -top-28 -left-28 h-96 w-96 opacity-40"
          gradient="radial-gradient(circle,#f9a8d4 0%,#fde68a 100%)"
        />
        <Blob
          className="blob-b -bottom-28 -right-28 h-96 w-96 opacity-35"
          gradient="radial-gradient(circle,#a5b4fc 0%,#6ee7b7 100%)"
        />
        <Blob
          className="blob-c top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 opacity-[0.18]"
          gradient="radial-gradient(circle,#bae6fd 0%,#e0e7ff 100%)"
        />

        <motion.div
          className="relative w-full max-w-md"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="absolute -top-px left-10 right-10 h-px bg-gradient-to-r from-transparent via-indigo-400/50 to-transparent" />

          <div className="rounded-3xl p-8 sm:p-10 bg-white/78 backdrop-blur-2xl border border-white/85 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.04),0_24px_64px_-12px_rgba(99,102,241,0.12),inset_0_1px_0_rgba(255,255,255,0.95)] overflow-x-hidden">
            {passwordReset ? (
              <SuccessScreen onLogin={() => navigate("/login")} />
            ) : (
              <>
                {/* Header */}
                <div className="text-center mb-2">
                  <motion.div
                    className="flex justify-center mb-4"
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{
                      type: "spring",
                      stiffness: 280,
                      damping: 18,
                      delay: 0.1,
                    }}
                  >
                    <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br from-indigo-100 to-violet-100 border border-indigo-200/60 shadow-[0_4px_18px_rgba(99,102,241,0.18)]">
                      <AnimatePresence mode="wait">
                        {step === 1 ? (
                          <motion.div
                            key="shield"
                            initial={{ opacity: 0, rotate: -15 }}
                            animate={{ opacity: 1, rotate: 0 }}
                            exit={{ opacity: 0, rotate: 15 }}
                            transition={{ duration: 0.22 }}
                          >
                            <ShieldCheck
                              className="w-8 h-8 text-indigo-600"
                              strokeWidth={1.5}
                            />
                          </motion.div>
                        ) : (
                          <motion.div
                            key="key"
                            initial={{ opacity: 0, rotate: 15 }}
                            animate={{ opacity: 1, rotate: 0 }}
                            exit={{ opacity: 0, rotate: -15 }}
                            transition={{ duration: 0.22 }}
                          >
                            <KeyRound
                              className="w-8 h-8 text-indigo-600"
                              strokeWidth={1.5}
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <div className="absolute -top-px -right-px w-4 h-4 bg-gradient-to-br from-white/80 to-transparent rounded-bl-xl" />
                    </div>
                  </motion.div>

                  {/* Brand chip */}
                  <div className="flex justify-center mb-4">
                    <span className="sora inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-gradient-to-r from-indigo-100 to-violet-100 border border-indigo-200/60 text-[0.67rem] font-semibold tracking-widest uppercase text-indigo-600">
                      <span className="badge-pulse w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                      Talk2Hire
                    </span>
                  </div>

                  <StepDots step={step} />

                  <AnimatePresence mode="wait">
                    {step === 1 ? (
                      <motion.div
                        key="h1"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.22 }}
                      >
                        <h1 className="sora text-[1.6rem] font-bold text-slate-800 tracking-tight">
                          Verify your OTP
                        </h1>
                        <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">
                          Enter the 4-digit code sent to{" "}
                          <span className="font-semibold text-indigo-600">
                            {email}
                          </span>
                        </p>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="h2"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.22 }}
                      >
                        <h1 className="sora text-[1.6rem] font-bold text-slate-800 tracking-tight">
                          Set new password
                        </h1>
                        <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">
                          OTP verified — choose a strong password
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Step body */}
                <div className="mt-6">
                  <AnimatePresence mode="wait" custom={step}>
                    {/* ── Step 1 ── */}
                    {step === 1 && (
                      <motion.div
                        key="s1"
                        custom={1}
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{
                          duration: 0.38,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                      >
                        <form
                          onSubmit={handleSubmit(onVerifyOtp)}
                          className="space-y-5"
                        >
                          {/* Email display pill — read-only, no input needed */}
                          <div className="flex items-center justify-center">
                            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-200/80">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                              <span className="text-xs font-medium text-indigo-700 font-mono truncate max-w-[240px]">
                                {email}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <label className="block text-xs font-semibold text-slate-600 tracking-wide text-center">
                              One-Time Password
                            </label>
                            <input
                              type="hidden"
                              {...register("otp", {
                                required: "OTP is required",
                                pattern: {
                                  value: /^\d{4}$/,
                                  message: "OTP must be 4 digits",
                                },
                              })}
                            />
                            <OtpInput
                              value={otpValue}
                              onChange={setOtpValue}
                              hasError={!!errors.otp}
                              disabled={loading}
                            />
                            {errors.otp && (
                              <p className="text-center text-xs font-medium text-red-500">
                                {errors.otp.message}
                              </p>
                            )}
                            <OtpTimer resending={loading} />
                          </div>

                          <AnimatePresence>
                            {error && <ErrorBanner message={error} />}
                          </AnimatePresence>

                          <PrimaryBtn
                            type="submit"
                            disabled={!isValid || loading}
                            className="w-full"
                          >
                            {loading ? (
                              <>
                                <Loader />
                                Verifying…
                              </>
                            ) : (
                              "Verify OTP"
                            )}
                          </PrimaryBtn>
                        </form>

                        <div className="flex justify-center mt-4">
                          <GhostBtn
                            onClick={() => navigate("/forgot-password")}
                            className="text-xs"
                          >
                            <ArrowLeft size={13} /> Back to sign in
                          </GhostBtn>
                        </div>
                      </motion.div>
                    )}

                    {/* ── Step 2 ── */}
                    {step === 2 && (
                      <motion.div
                        key="s2"
                        custom={2}
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{
                          duration: 0.38,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                      >
                        {/* Verified email pill */}
                        <div className="flex items-center justify-center mb-5">
                          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                            <span className="text-xs font-medium text-emerald-700 font-mono truncate max-w-[220px]">
                              {email}
                            </span>
                          </div>
                        </div>

                        <form
                          onSubmit={handleSubmit2(onSetPassword)}
                          className="space-y-4"
                        >
                          {/* FormField import removed since email field is gone — kept for password fields */}
                          <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-slate-600 tracking-wide">
                              New Password
                            </label>
                            <input
                              type="password"
                              placeholder="Min. 6 characters"
                              className={[
                                "w-full px-4 py-2.5 rounded-xl border text-sm text-slate-800 outline-none transition-all duration-150",
                                "bg-slate-50/90 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/70",
                                errors2.newPassword
                                  ? "border-red-300"
                                  : "border-[#E2E8F0]",
                              ].join(" ")}
                              {...reg2("newPassword", {
                                required: "New password is required",
                                minLength: {
                                  value: 6,
                                  message:
                                    "Password must be at least 6 characters",
                                },
                              })}
                            />
                            {errors2.newPassword && (
                              <p className="text-xs font-medium text-red-500">
                                {errors2.newPassword.message}
                              </p>
                            )}
                          </div>

                          {watch2("newPassword") && (
                            <PasswordStrengthBar
                              password={watch2("newPassword")}
                            />
                          )}

                          <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-slate-600 tracking-wide">
                              Confirm Password
                            </label>
                            <input
                              type="password"
                              placeholder="Re-enter password"
                              className={[
                                "w-full px-4 py-2.5 rounded-xl border text-sm text-slate-800 outline-none transition-all duration-150",
                                "bg-slate-50/90 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/70",
                                errors2.confirmPassword
                                  ? "border-red-300"
                                  : "border-[#E2E8F0]",
                              ].join(" ")}
                              {...reg2("confirmPassword", {
                                required: "Please confirm your password",
                                validate: (v) =>
                                  v === watch2("newPassword") ||
                                  "Passwords do not match",
                              })}
                            />
                            {errors2.confirmPassword && (
                              <p className="text-xs font-medium text-red-500">
                                {errors2.confirmPassword.message}
                              </p>
                            )}
                          </div>

                          <AnimatePresence>
                            {error && <ErrorBanner message={error} />}
                          </AnimatePresence>

                          <PrimaryBtn
                            type="submit"
                            disabled={!isValid2 || loading}
                            className="w-full"
                          >
                            {loading ? (
                              <>
                                <Loader />
                                Updating…
                              </>
                            ) : (
                              "Update Password"
                            )}
                          </PrimaryBtn>
                        </form>

                        <div className="flex justify-center mt-4">
                          <GhostBtn
                            onClick={() => {
                              setStep(1);
                              setOtpValue("");
                              resetState();
                            }}
                            className="text-xs"
                          >
                            <ArrowLeft size={13} /> Back to OTP
                          </GhostBtn>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </section>
    </>
  );
};

export default VerifyPassword;

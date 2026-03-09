import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../../Hooks/useAuthHook";

/* ─────────────────────────────────────────────────────────────────────────────
   ICON PRIMITIVE
───────────────────────────────────────────────────────────────────────────── */
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
      d={[
        "M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.44-3.16Z",
        "M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.44-3.16Z",
      ]}
    />
  ),
  Zap: (p) => <Svg {...p} d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />,
  Shield: (p) => <Svg {...p} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  Rocket: (p) => (
    <Svg
      {...p}
      d={[
        "M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z",
        "M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z",
      ]}
    />
  ),
  Check: (p) => <Svg {...p} sw={2.5} d="M20 6 9 17l-5-5" />,
  ChevRight: (p) => <Svg {...p} d="m9 18 6-6-6-6" />,
  ChevLeft: (p) => <Svg {...p} d="m15 18-6-6 6-6" />,
  Alert: (p) => (
    <Svg
      {...p}
      d={["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M12 8v4", "M12 16h.01"]}
    />
  ),
  Mail: (p) => (
    <Svg
      {...p}
      d={[
        "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z",
        "M22 6l-10 7L2 6",
      ]}
    />
  ),
  Edit: (p) => (
    <Svg
      {...p}
      d={[
        "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7",
        "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
      ]}
    />
  ),
  User: (p) => (
    <Svg
      {...p}
      d={[
        "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2",
        "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
      ]}
    />
  ),
  Phone: (p) => (
    <Svg
      {...p}
      d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.34 2 2 0 0 1 3.6 1.12h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.5a16 16 0 0 0 6 6l.87-.87a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21.73 16"
    />
  ),
  MapPin: (p) => (
    <Svg
      {...p}
      d={[
        "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z",
        "M12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
      ]}
    />
  ),
  Code: (p) => <Svg {...p} d={["M16 18l6-6-6-6", "M8 6l-6 6 6 6"]} />,
  X: (p) => <Svg {...p} d="M18 6 6 18M6 6l12 12" />,
  Briefcase: (p) => (
    <Svg
      {...p}
      d={[
        "M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16",
        "M2 9h20",
        "M22 20H2",
        "M2 9a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9z",
      ]}
    />
  ),
  ArrowRight: (p) => <Svg {...p} d={["M5 12h14", "M12 5l7 7-7 7"]} />,
  CheckCircle: (p) => (
    <Svg
      {...p}
      d={["M22 11.08V12a10 10 0 1 1-5.93-9.14", "M22 4 12 14.01l-3-3"]}
    />
  ),
  RefreshCw: (p) => (
    <Svg
      {...p}
      d={[
        "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8",
        "M21 3v5h-5",
        "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16",
        "M8 16H3v5",
      ]}
    />
  ),
};

/* ─────────────────────────────────────────────────────────────────────────────
   SLIDE DATA
───────────────────────────────────────────────────────────────────────────── */
const SLIDES = [
  {
    key: "welcome",
    Icon: Ic.Sparkles,
    accent: "from-indigo-500 to-violet-600",
    accentSoft: "bg-indigo-50",
    accentBorder: "border-indigo-200",
    accentText: "text-indigo-600",
    iconBg: "bg-indigo-100",
    orb1: "bg-indigo-200/50",
    orb2: "bg-violet-200/40",
    tag: "Step 1 of 5",
    title: "Welcome to\nTalk2Hire",
    desc: "The AI-powered hiring platform that matches top talent with the right opportunities — faster than ever.",
    features: [
      "Real-time voice interviews",
      "Intelligent question generation",
      "Instant feedback & scoring",
    ],
    stat: { value: "12K+", label: "Candidates hired" },
  },
  {
    key: "analysis",
    Icon: Ic.Brain,
    accent: "from-sky-500 to-indigo-600",
    accentSoft: "bg-sky-50",
    accentBorder: "border-sky-200",
    accentText: "text-sky-600",
    iconBg: "bg-sky-100",
    orb1: "bg-sky-200/50",
    orb2: "bg-indigo-200/40",
    tag: "Step 2 of 5",
    title: "AI-Powered\nAnalysis",
    desc: "Our AI is scanning your resume right now, building a deep understanding of your skills and career trajectory.",
    features: [
      "Resume parsing & extraction",
      "Domain detection",
      "Custom question generation",
    ],
    stat: { value: "98%", label: "Extraction accuracy" },
  },
  {
    key: "instant",
    Icon: Ic.Zap,
    accent: "from-amber-500 to-orange-500",
    accentSoft: "bg-amber-50",
    accentBorder: "border-amber-200",
    accentText: "text-amber-600",
    iconBg: "bg-amber-100",
    orb1: "bg-amber-200/50",
    orb2: "bg-orange-200/40",
    tag: "Step 3 of 5",
    title: "Instant Profile\nSetup",
    desc: "No tedious forms. We automatically extract your information and pre-fill your candidate profile.",
    features: [
      "One-click resume upload",
      "Automatic data extraction",
      "Smart profile completion",
    ],
    stat: { value: "30s", label: "Average setup time" },
  },
  {
    key: "secure",
    Icon: Ic.Shield,
    accent: "from-emerald-500 to-teal-600",
    accentSoft: "bg-emerald-50",
    accentBorder: "border-emerald-200",
    accentText: "text-emerald-600",
    iconBg: "bg-emerald-100",
    orb1: "bg-emerald-200/50",
    orb2: "bg-teal-200/40",
    tag: "Step 4 of 5",
    title: "Secure\n& Private",
    desc: "Enterprise-grade encryption keeps your resume and personal data safe. Your privacy is our priority.",
    features: [
      "End-to-end encryption",
      "GDPR compliant",
      "Privacy-first approach",
    ],
    stat: { value: "256-bit", label: "Encryption" },
  },
  {
    key: "ready",
    Icon: Ic.Rocket,
    accent: "from-violet-500 to-purple-600",
    accentSoft: "bg-violet-50",
    accentBorder: "border-violet-200",
    accentText: "text-violet-600",
    iconBg: "bg-violet-100",
    orb1: "bg-violet-200/50",
    orb2: "bg-purple-200/40",
    tag: "Step 5 of 5",
    title: "Almost\nReady!",
    desc: "Your profile is being prepared. In a moment you'll review your extracted information and complete setup.",
    features: [
      "Start interviewing now",
      "Track your progress",
      "Improve with AI feedback",
    ],
    stat: { value: "95%", label: "Interview success" },
  },
];

const LOADING_MESSAGES = [
  "Uploading your resume…",
  "Analysing your resume…",
  "Extracting your skills…",
  "Identifying your expertise…",
  "Preparing your profile…",
  "Almost there…",
];

/* ─────────────────────────────────────────────────────────────────────────────
   SMALL REUSABLES
───────────────────────────────────────────────────────────────────────────── */
const TextInput = ({
  label,
  icon: IconComp,
  error,
  hint,
  badge,
  disabled,
  ...props
}) => (
  <div className="space-y-1.5">
    <div className="flex items-center gap-2">
      <label
        className="text-xs font-bold text-slate-600 uppercase tracking-widest"
        style={{ fontFamily: "'Syne', sans-serif" }}
      >
        {label}
      </label>
      {badge}
    </div>
    <div className="relative">
      {IconComp && (
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
          <IconComp size={15} />
        </div>
      )}
      <input
        disabled={disabled}
        className={`w-full ${IconComp ? "pl-10" : "pl-4"} pr-4 py-3 rounded-2xl border-2 text-sm font-medium text-slate-800 placeholder-slate-300 focus:outline-none transition-all bg-white disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed ${error ? "border-rose-300 focus:border-rose-400 bg-rose-50/30" : "border-slate-200 focus:border-indigo-300 focus:bg-indigo-50/20"}`}
        {...props}
      />
    </div>
    {hint && !error && <p className="text-xs text-slate-400">{hint}</p>}
    {error && (
      <p className="text-xs text-rose-500 flex items-center gap-1">
        <Ic.Alert size={10} /> {error}
      </p>
    )}
  </div>
);

const EmailDisplay = ({ email, onEdit, disabled }) => (
  <motion.div
    initial={{ opacity: 0, y: 6, scale: 0.97 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: 6, scale: 0.97 }}
    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    className="flex items-center gap-3 p-3.5 rounded-2xl bg-emerald-50 border-2 border-emerald-200"
  >
    <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0 shadow-sm">
      <Ic.Mail size={15} className="text-white" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-0.5">
        ✦ AI Extracted
      </p>
      <p className="text-sm font-bold text-slate-800 truncate">{email}</p>
    </div>
    {!disabled && (
      <motion.button
        type="button"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onEdit}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border-2 border-emerald-200 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-all shrink-0 shadow-sm"
      >
        <Ic.Edit size={11} /> Edit
      </motion.button>
    )}
  </motion.div>
);

const EmailEditor = ({ value, onChange, onSave, onCancel, error }) => (
  <motion.div
    initial={{ opacity: 0, y: 6, scale: 0.97 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: 6, scale: 0.97 }}
    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    className="space-y-2"
  >
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Ic.Mail
          size={15}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          autoFocus
          type="email"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSave();
            if (e.key === "Escape") onCancel();
          }}
          placeholder="your@email.com"
          className={`w-full pl-10 pr-4 py-3 rounded-2xl border-2 text-sm font-medium text-slate-800 placeholder-slate-300 focus:outline-none transition-all bg-white ${error ? "border-rose-300 focus:border-rose-400" : "border-indigo-300 focus:border-indigo-500"}`}
        />
      </div>
      <motion.button
        type="button"
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        onClick={onSave}
        className="flex items-center gap-1.5 px-4 py-3 rounded-2xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors shadow-md"
      >
        <Ic.Check size={13} /> Save
      </motion.button>
      <button
        type="button"
        onClick={onCancel}
        className="p-3 rounded-2xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
      >
        <Ic.X size={14} />
      </button>
    </div>
    {error && (
      <p className="text-xs text-rose-500 flex items-center gap-1">
        <Ic.Alert size={10} /> {error}
      </p>
    )}
    <p className="text-xs text-slate-400">Enter to save · Esc to cancel</p>
  </motion.div>
);

/* ─────────────────────────────────────────────────────────────────────────────
   OTP MODAL
───────────────────────────────────────────────────────────────────────────── */
const OtpModal = ({
  maskedEmail,
  onVerified,
  onResend,
  isResending,
  error,
  isVerifying,
}) => {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const inputRefs = useRef([]);
  const hasAutoSubmitted = useRef(false);

  const otp = digits.join("");

  // Auto-submit when all 6 digits filled
  useEffect(() => {
    if (otp.length === 6 && !hasAutoSubmitted.current) {
      hasAutoSubmitted.current = true;
      onVerified(otp);
    }
    if (otp.length < 6) hasAutoSubmitted.current = false;
  }, [otp, onVerified]);

  const handleChange = (i, val) => {
    // Only allow digits
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = digit;
    setDigits(next);
    if (digit && i < 5) {
      inputRefs.current[i + 1]?.focus();
    }
  };

  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace") {
      if (digits[i]) {
        const next = [...digits];
        next[i] = "";
        setDigits(next);
      } else if (i > 0) {
        inputRefs.current[i - 1]?.focus();
      }
    }
    if (e.key === "ArrowLeft" && i > 0) inputRefs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < 5) inputRefs.current[i + 1]?.focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (!pasted) return;
    const next = [...digits];
    for (let i = 0; i < 6; i++) next[i] = pasted[i] || "";
    setDigits(next);
    const focusIdx = Math.min(pasted.length, 5);
    inputRefs.current[focusIdx]?.focus();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-60 flex items-center justify-center px-4"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl shadow-indigo-200/50 overflow-hidden"
      >
        {/* Top gradient band */}
        <div className="bg-linear-to-r from-indigo-600 via-violet-600 to-purple-600 px-8 pt-8 pb-7 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-4 shadow-inner">
            <Ic.Mail size={24} className="text-white" />
          </div>
          <h3
            className="text-xl font-black text-white mb-1"
            style={{ fontFamily: "'Syne', sans-serif" }}
          >
            Verify Your Email
          </h3>
          <p className="text-indigo-200 text-sm">We sent a 6-digit code to</p>
          <p className="text-white font-bold text-sm mt-0.5">{maskedEmail}</p>
        </div>

        {/* Body */}
        <div className="px-8 py-7 space-y-6">
          {/* OTP inputs */}
          <div className="flex justify-center gap-2.5" onPaste={handlePaste}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => (inputRefs.current[i] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className={`w-11 h-13 text-center text-lg font-black rounded-2xl border-2 focus:outline-none transition-all ${
                  d
                    ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 bg-white text-slate-800"
                } focus:border-indigo-400 focus:bg-indigo-50/30`}
                style={{ height: "52px" }}
                autoFocus={i === 0}
              />
            ))}
          </div>

          {/* Status / Error */}
          <AnimatePresence>
            {isVerifying && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-center gap-2.5 py-3 rounded-2xl bg-indigo-50 border border-indigo-200"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-4 h-4 border-2 border-indigo-300 border-t-indigo-600 rounded-full"
                />
                <span className="text-sm font-semibold text-indigo-600">
                  Verifying your code…
                </span>
              </motion.div>
            )}
            {error && !isVerifying && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200"
              >
                <Ic.Alert size={15} className="text-rose-500 shrink-0" />
                <p className="text-sm text-rose-700">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Resend */}
          <div className="text-center">
            <p className="text-sm text-slate-500 mb-2">
              Didn't receive the code?
            </p>
            <button
              type="button"
              onClick={onResend}
              disabled={isResending}
              className="flex items-center gap-2 mx-auto px-4 py-2 rounded-xl border-2 border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isResending ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full"
                />
              ) : (
                <Ic.RefreshCw size={13} />
              )}
              {isResending ? "Sending…" : "Resend Code"}
            </button>
          </div>

          <p className="text-xs text-slate-400 text-center">
            Enter the code above and it will verify automatically
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
};

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────────────────────── */
const OnboardingFlow = ({ isOpen, onComplete }) => {
  const navigate = useNavigate();
  const { getCurrentUser } = useAuth();

  // step: 0=carousel, 1=otp (full-screen, blocks everything), 2=form
  const [step, setStep] = useState(0);
  const [slide, setSlide] = useState(0);
  const [slideDir, setSlideDir] = useState(1);
  const [autoPlay, setAutoPlay] = useState(true);
  const [isDataLoading, setDataLoad] = useState(true);
  const [loadMsg, setLoadMsg] = useState(LOADING_MESSAGES[0]);
  const [regError, setRegError] = useState(null);

  // OTP state
  const [maskedEmail, setMaskedEmail] = useState("");
  const [otpError, setOtpError] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // Email edit state
  const [emailDisplay, setEmailDisplay] = useState("");
  const [emailEditing, setEmailEditing] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");
  const [emailEditErr, setEmailEditErr] = useState(null);

  // Track session id locally for OTP calls
  const sessionIdRef = useRef(null);
  // Prevent OTP from being sent more than once
  const otpSentRef = useRef(false);
  // Track OTP verification so carousel skip/finish cannot bypass it
  const otpVerifiedRef = useRef(false);

  const API_URL = import.meta?.env?.VITE_BACKEND_URL || "";

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({
    mode: "onTouched",
    defaultValues: {
      fullName: "",
      mobile: "",
      email: "",
      location: "",
      skills: "",
    },
  });

  // ── Auto-play carousel ────────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 0 || !autoPlay) return;
    const t = setInterval(() => {
      setSlide((p) => (p < SLIDES.length - 1 ? p + 1 : p));
    }, 3500);
    return () => clearInterval(t);
  }, [step, autoPlay]);

  // ── Rotate loading messages ───────────────────────────────────────────────
  useEffect(() => {
    if (!isDataLoading) return;
    let i = 0;
    const t = setInterval(() => {
      i = (i + 1) % LOADING_MESSAGES.length;
      setLoadMsg(LOADING_MESSAGES[i]);
    }, 2000);
    return () => clearInterval(t);
  }, [isDataLoading]);

  // ── Verify OTP ────────────────────────────────────────────────────────────
  const handleVerifyOtp = async (otp) => {
    // If sessionIdRef not yet set, try reading from sessionStorage as fallback
    const sid =
      sessionIdRef.current || sessionStorage.getItem("registrationSessionId");
    if (!sid) {
      setOtpError("Session expired. Please restart registration.");
      return;
    }
    // Keep sessionIdRef in sync
    sessionIdRef.current = sid;

    setIsVerifying(true);
    setOtpError(null);
    try {
      // Send OTP as integer to match DB column type (INT)
      const otpInt = parseInt(otp, 10);
      if (isNaN(otpInt) || otp.length !== 6) {
        throw new Error("Invalid OTP format. Please enter all 6 digits.");
      }
      console.log("[OTP Verify] sessionId:", sid, "otp:", otpInt);
      const res = await fetch(
        `${API_URL}/api/v1/auth/verify-registration-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ sessionId: sid, otp: otpInt }),
        },
      );
      const json = await res.json();
      console.log("[OTP Verify] response:", res.status, json);
      if (!res.ok) {
        throw new Error(json.message || json.data?.message || "Invalid OTP");
      }
      // Confirm backend actually marked it verified
      const verified = json?.data?.verified ?? json?.verified ?? true;
      if (!verified) {
        throw new Error("OTP verification failed. Please try again.");
      }
      setIsVerifying(false);
      otpVerifiedRef.current = true;
      setStep(2); // move to form
    } catch (e) {
      setIsVerifying(false);
      otpVerifiedRef.current = false;
      setOtpError(e.message || "Invalid or expired OTP. Please try again.");
    }
  };

  // ── Resend OTP ────────────────────────────────────────────────────────────
  const handleResendOtp = async () => {
    if (!sessionIdRef.current) return;
    setIsResending(true);
    setOtpError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/send-registration-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionId: sessionIdRef.current }),
      });
      if (!res.ok) throw new Error("Failed to resend");
      const data = await res.json();
      setMaskedEmail(data?.data?.email || maskedEmail);
    } catch {}
    setIsResending(false);
  };

  // ── Polling ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    // Reset guards for a fresh registration attempt
    otpSentRef.current = false;
    otpVerifiedRef.current = false;
    let checkT, pollT;

    // sendOtp is inlined here to avoid stale closure — never reference outside state setters
    const doSendOtp = async (sid, apiUrl, retries = 3) => {
      if (otpSentRef.current) return; // prevent duplicate sends
      otpSentRef.current = true;
      try {
        const res = await fetch(`${apiUrl}/api/v1/auth/send-registration-otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ sessionId: sid }),
        });
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.message || "Failed to send OTP");
        }
        const json = await res.json();
        setMaskedEmail(json?.data?.email || "your email");
        setStep(1); // show OTP modal — THIS is what makes it appear
      } catch (err) {
        otpSentRef.current = false; // allow retry
        if (retries > 0) {
          // Retry after 1.5s — extraction may not be fully committed to DB yet
          setTimeout(() => doSendOtp(sid, apiUrl, retries - 1), 1500);
        } else {
          // All retries exhausted — skip to form but show warning
          setRegError(
            `Could not send OTP: ${err.message}. You may proceed but email is unverified.`,
          );
          setStep(2);
        }
      }
    };

    const waitForSession = () => {
      // Check immediately first (sessionId may already be set before component mounts)
      const sidNow = sessionStorage.getItem("registrationSessionId");
      if (sidNow) {
        sessionIdRef.current = sidNow;
        poll(sidNow);
        return;
      }
      // Otherwise poll until it appears (set by backgroundUpload)
      let waited = 0;
      checkT = setInterval(() => {
        waited += 500;
        const sid = sessionStorage.getItem("registrationSessionId");
        if (sid) {
          clearInterval(checkT);
          sessionIdRef.current = sid;
          poll(sid);
        } else if (waited >= 30000) {
          // 30s timeout — give up and show error
          clearInterval(checkT);
          setDataLoad(false);
          setRegError("Upload timed out. Please go back and try again.");
          setStep(2);
        }
      }, 500);
    };

    const poll = (sid) => {
      let attempts = 0,
        found = false;
      pollT = setInterval(async () => {
        attempts++;
        try {
          const res = await fetch(
            `${API_URL}/api/v1/auth/extraction-status/${sid}`,
            { credentials: "include" },
          );
          if (!res.ok) return;
          const { data } = await res.json();
          if (data.status === "completed" && data.extractedData && !found) {
            found = true;
            clearInterval(pollT);
            const ex = data.extractedData;
            setValue("fullName", ex.fullName || "");
            setValue("email", ex.email || "");
            setValue("mobile", ex.mobile || "");
            setValue("location", ex.location || "");
            setValue("skills", ex.cvSkills?.join(", ") || "");
            setEmailDisplay(ex.email || "");
            setEmailDraft(ex.email || "");
            setDataLoad(false);
            // Send OTP — inlined to avoid stale closure
            setTimeout(() => doSendOtp(sid, API_URL), 1500);
          } else if (data.status === "failed") {
            clearInterval(pollT);
            setDataLoad(false);
            setRegError(data.error || "Failed to extract resume data");
            setStep(2);
          }
        } catch {}
        if (attempts >= 60 && !found) {
          clearInterval(pollT);
          setDataLoad(false);
          setStep(2);
        }
      }, 1000);
    };

    waitForSession();
    return () => {
      clearInterval(checkT);
      clearInterval(pollT);
    };
  }, [isOpen, API_URL, setValue]);

  // ── Carousel nav ──────────────────────────────────────────────────────────
  const goToSlide = (i) => {
    setSlideDir(i > slide ? 1 : -1);
    setSlide(i);
    setAutoPlay(false);
  };
  const nextSlide = () => {
    if (slide === SLIDES.length - 1) {
      // Only advance to form if OTP is already verified; otherwise OTP modal will appear automatically
      if (otpVerifiedRef.current) setStep(2);
      return;
    }
    setSlideDir(1);
    setSlide((p) => p + 1);
    setAutoPlay(false);
  };
  const prevSlide = () => {
    if (slide === 0) return;
    setSlideDir(-1);
    setSlide((p) => p - 1);
    setAutoPlay(false);
  };

  // ── Email edit helpers ────────────────────────────────────────────────────
  const openEmailEdit = () => {
    setEmailDraft(emailDisplay);
    setEmailEditErr(null);
    setEmailEditing(true);
  };
  const saveEmailEdit = () => {
    if (!emailDraft || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailDraft)) {
      setEmailEditErr("Please enter a valid email address");
      return;
    }
    setEmailDisplay(emailDraft);
    setValue("email", emailDraft);
    setEmailEditing(false);
    setEmailEditErr(null);
  };
  const cancelEmailEdit = () => {
    setEmailDraft(emailDisplay);
    setEmailEditing(false);
    setEmailEditErr(null);
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleProfileSubmit = async (data) => {
    // Guard: block if OTP not verified yet (show friendly message instead of backend 403)
    if (!otpVerifiedRef.current) {
      setRegError(
        "Please verify your email with the OTP before completing registration.",
      );
      return;
    }
    try {
      setRegError(null);
      // Use sessionIdRef (set during polling) as the single source of truth
      const sid =
        sessionIdRef.current || sessionStorage.getItem("registrationSessionId");
      if (!sid)
        throw new Error("Session ID not found. Please restart registration.");
      const res = await fetch(`${API_URL}/api/v1/auth/complete-registration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionId: sid, ...data, email: emailDisplay }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Registration failed");
      }
      sessionStorage.removeItem("registrationSessionId");
      sessionStorage.removeItem("showOnboarding");
      await getCurrentUser();
      onComplete();
      navigate("/", { replace: true });
    } catch (e) {
      setRegError(
        e.message || "Failed to complete registration. Please try again.",
      );
    }
  };

  if (!isOpen) return null;

  const s = SLIDES[slide];

  /* ══════════════════════════════════════════════════════════════════════════
     STEP 0 — CAROUSEL  (with optional OTP modal overlay on step 1)
  ══════════════════════════════════════════════════════════════════════════ */
  if (step === 0 || step === 1)
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800;900&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
          @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
          @keyframes spin-ring { to{transform:rotate(360deg)} }
          .float { animation: float 4s ease-in-out infinite; }
          .spin-ring { animation: spin-ring 14s linear infinite; }
          .spin-ring-rev { animation: spin-ring 18s linear infinite reverse; }
        `}</style>

        <div
          className="fixed inset-0 z-50 overflow-hidden"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          {/* Background */}
          <div className="absolute inset-0 bg-linear-to-br from-slate-100 via-white to-indigo-50/60" />
          <div
            className={`absolute -top-48 -left-48 w-150 h-150 rounded-full ${s.orb1} blur-[130px] transition-all duration-1000 pointer-events-none`}
          />
          <div
            className={`absolute -bottom-48 -right-48 w-125 h-125 rounded-full ${s.orb2} blur-[110px] transition-all duration-1000 pointer-events-none`}
          />
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.03]"
            style={{
              backgroundImage:
                "radial-gradient(circle, #6366f1 1px, transparent 1px)",
              backgroundSize: "30px 30px",
            }}
          />
          <div className="absolute top-6 right-6 w-64 h-64 rounded-full border border-indigo-200/40 pointer-events-none spin-ring" />
          <div className="absolute top-16 right-16 w-44 h-44 rounded-full border border-violet-200/30 pointer-events-none spin-ring-rev" />

          <div className="relative z-10 h-full flex flex-col">
            {/* Nav bar */}
            <div className="flex-none flex items-center justify-between px-6 sm:px-10 py-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-linear-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-300/50">
                  <Ic.Briefcase size={14} className="text-white" />
                </div>
                <span
                  className="text-base font-black text-slate-900"
                  style={{ fontFamily: "'Syne', sans-serif" }}
                >
                  Talk2Hire
                </span>
              </div>
              <button
                onClick={() => {
                  if (otpVerifiedRef.current) setStep(2);
                }}
                className={`text-xs font-semibold transition-colors border px-3 py-1.5 rounded-xl ${otpVerifiedRef.current ? "text-slate-400 hover:text-slate-700 border-slate-200 bg-white/70 hover:bg-white cursor-pointer" : "text-slate-300 border-slate-100 bg-white/40 cursor-not-allowed"}`}
                title={
                  otpVerifiedRef.current ? "" : "Please verify your email first"
                }
              >
                {otpVerifiedRef.current
                  ? "Skip to profile →"
                  : "Verify email to continue"}
              </button>
            </div>

            {/* Progress bar */}
            <div className="flex-none px-6 sm:px-10 pb-3">
              <div className="max-w-xl mx-auto">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-400">
                    {s.tag}
                  </span>
                </div>
                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <motion.div
                    animate={{
                      width: `${((slide + 1) / SLIDES.length) * 100}%`,
                    }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className={`h-full rounded-full bg-linear-to-r ${s.accent}`}
                  />
                </div>
              </div>
            </div>

            {/* Slide content */}
            <div className="flex-1 flex items-center justify-center px-4 sm:px-8 min-h-0">
              <AnimatePresence mode="wait" custom={slideDir}>
                <motion.div
                  key={slide}
                  custom={slideDir}
                  variants={{
                    enter: (d) => ({ opacity: 0, x: d > 0 ? 50 : -50 }),
                    center: { opacity: 1, x: 0 },
                    exit: (d) => ({ opacity: 0, x: d > 0 ? -50 : 50 }),
                  }}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                  className="w-full max-w-4xl mx-auto"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-10 items-center">
                    {/* Left: text */}
                    <div className="lg:col-span-3 space-y-5 text-center lg:text-left">
                      <div
                        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full ${s.accentSoft} border ${s.accentBorder}`}
                      >
                        <div
                          className={`w-5 h-5 rounded-lg ${s.iconBg} flex items-center justify-center`}
                        >
                          <s.Icon size={11} className={s.accentText} />
                        </div>
                        <span
                          className={`text-xs font-bold ${s.accentText} uppercase tracking-widest`}
                        >
                          {s.tag}
                        </span>
                      </div>
                      <h2
                        className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 leading-[1.05] tracking-tight"
                        style={{ fontFamily: "'Syne', sans-serif" }}
                      >
                        {s.title.split("\n").map((line, i) => (
                          <span key={i}>
                            {i === 1 ? (
                              <span
                                className={`bg-linear-to-r ${s.accent} bg-clip-text text-transparent`}
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
                      <p className="text-slate-500 text-base leading-relaxed max-w-md mx-auto lg:mx-0">
                        {s.desc}
                      </p>
                      <div className="space-y-2.5">
                        {s.features.map((f, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.09, duration: 0.4 }}
                            className="flex items-center gap-3 justify-center lg:justify-start"
                          >
                            <div
                              className={`w-5 h-5 rounded-full ${s.iconBg} flex items-center justify-center shrink-0`}
                            >
                              <Ic.Check size={10} className={s.accentText} />
                            </div>
                            <span className="text-sm font-medium text-slate-700">
                              {f}
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                    {/* Right: visual */}
                    <div className="lg:col-span-2 flex flex-col items-center gap-5">
                      <motion.div
                        initial={{ scale: 0.85, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                        className={`w-28 h-28 rounded-3xl bg-linear-to-br ${s.accent} flex items-center justify-center shadow-2xl float`}
                        style={{
                          boxShadow: "0 24px 60px rgba(99,102,241,0.25)",
                        }}
                      >
                        <s.Icon size={52} className="text-white" />
                      </motion.div>
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.4 }}
                        className={`w-full max-w-xs p-5 rounded-2xl ${s.accentSoft} border ${s.accentBorder} text-center`}
                      >
                        <p
                          className={`text-4xl font-black ${s.accentText} mb-1`}
                          style={{ fontFamily: "'Syne', sans-serif" }}
                        >
                          {s.stat.value}
                        </p>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          {s.stat.label}
                        </p>
                      </motion.div>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer controls */}
            <div className="flex-none px-6 sm:px-10 pb-5 pt-3">
              <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
                <div className="flex gap-2 items-center">
                  {SLIDES.map((_, i) => (
                    <button key={i} onClick={() => goToSlide(i)}>
                      <motion.div
                        animate={{
                          width: i === slide ? 28 : 8,
                          backgroundColor: i === slide ? "#1e293b" : "#cbd5e1",
                        }}
                        transition={{ duration: 0.3 }}
                        className="h-2 rounded-full"
                        style={{ width: i === slide ? 28 : 8 }}
                      />
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2.5">
                  {slide > 0 && (
                    <button
                      onClick={prevSlide}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white border-2 border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-colors shadow-sm"
                    >
                      <Ic.ChevLeft size={14} /> Back
                    </button>
                  )}
                  <motion.button
                    whileHover={{
                      scale: 1.03,
                      boxShadow: "0 10px 28px rgba(99,102,241,0.3)",
                    }}
                    whileTap={{ scale: 0.97 }}
                    onClick={nextSlide}
                    className={`flex items-center gap-2 px-7 py-3 rounded-xl bg-linear-to-r ${s.accent} text-white font-black text-sm shadow-lg transition-all`}
                    style={{ fontFamily: "'Syne', sans-serif" }}
                  >
                    {slide === SLIDES.length - 1
                      ? otpVerifiedRef.current
                        ? "Review My Profile"
                        : "Almost ready…"
                      : "Next"}
                    <Ic.ChevRight size={14} />
                  </motion.button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* OTP Modal overlaid on carousel */}
        <AnimatePresence>
          {step === 1 && (
            <OtpModal
              maskedEmail={maskedEmail}
              onVerified={handleVerifyOtp}
              onResend={handleResendOtp}
              isResending={isResending}
              error={otpError}
              isVerifying={isVerifying}
            />
          )}
        </AnimatePresence>
      </>
    );

  /* ══════════════════════════════════════════════════════════════════════════
     STEP 2 — REVIEW FORM
  ══════════════════════════════════════════════════════════════════════════ */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800;900&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        * { box-sizing: border-box; }
      `}</style>

      <div
        className="fixed inset-0 z-50 overflow-hidden flex flex-col"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        {/* Background */}
        <div className="absolute inset-0 bg-linear-to-br from-slate-100 via-indigo-50/50 to-violet-100/40" />
        <div className="absolute -top-40 -left-40 w-125 h-125 rounded-full bg-indigo-200/40 blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-violet-200/40 blur-[100px] pointer-events-none" />
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.025]"
          style={{
            backgroundImage:
              "radial-gradient(circle, #6366f1 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* Top bar */}
        <div className="relative z-10 flex-none flex items-center justify-between px-6 sm:px-10 py-4 border-b border-slate-200/60 bg-white/60 backdrop-blur-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-linear-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-300/50">
              <Ic.Briefcase size={14} className="text-white" />
            </div>
            <span
              className="text-base font-black text-slate-900"
              style={{ fontFamily: "'Syne', sans-serif" }}
            >
              Talk2Hire
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <span className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[10px] font-black">
              1
            </span>
            <span className="text-indigo-600">Carousel</span>
            <div className="w-8 h-px bg-slate-300" />
            <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-black">
              <Ic.Check size={9} />
            </span>
            <span className="text-emerald-600">Email Verified</span>
            <div className="w-8 h-px bg-slate-300" />
            <span className="w-5 h-5 rounded-full bg-linear-to-br from-indigo-600 to-violet-600 text-white flex items-center justify-center text-[10px] font-black">
              3
            </span>
            <span className="font-bold text-slate-800">Review Profile</span>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="relative z-10 flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <form
              onSubmit={handleSubmit(handleProfileSubmit)}
              className="space-y-6"
            >
              {/* Page header */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="flex flex-col sm:flex-row items-start sm:items-center gap-4"
              >
                <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-200 shrink-0">
                  <Ic.CheckCircle size={26} className="text-white" />
                </div>
                <div>
                  <h3
                    className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight"
                    style={{ fontFamily: "'Syne', sans-serif" }}
                  >
                    Review Your Profile
                  </h3>
                  <p className="text-slate-500 text-sm mt-1">
                    We've auto-filled your details from your resume — check
                    everything and edit as needed.
                  </p>
                </div>
                <div className="sm:ml-auto flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-indigo-50 border border-indigo-200 shrink-0">
                  <Ic.Sparkles size={13} className="text-indigo-500" />
                  <span className="text-xs font-bold text-indigo-600">
                    AI-filled profile
                  </span>
                </div>
              </motion.div>

              {/* Loading card */}
              <AnimatePresence>
                {isDataLoading && (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="p-8 rounded-3xl bg-white/80 backdrop-blur-sm border border-slate-200 shadow-md shadow-slate-200/50 text-center"
                  >
                    <div className="relative inline-flex mb-5">
                      <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{
                            duration: 1.2,
                            repeat: Infinity,
                            ease: "linear",
                          }}
                          className="w-7 h-7 border-2 border-white/30 border-t-white rounded-full"
                        />
                      </div>
                      <motion.div
                        animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="absolute inset-0 rounded-2xl bg-indigo-400/20"
                      />
                    </div>
                    <motion.p
                      animate={{ opacity: [1, 0.5, 1] }}
                      transition={{ duration: 1.8, repeat: Infinity }}
                      className="text-lg font-bold text-slate-700 mb-1"
                      style={{ fontFamily: "'Syne', sans-serif" }}
                    >
                      {loadMsg}
                    </motion.p>
                    <p className="text-sm text-slate-400">
                      Our AI is working its magic on your resume
                    </p>
                    <div className="flex justify-center gap-1.5 mt-5">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          animate={{ y: [0, -6, 0] }}
                          transition={{
                            duration: 0.7,
                            delay: i * 0.15,
                            repeat: Infinity,
                          }}
                          className={`w-2.5 h-2.5 rounded-full ${["bg-indigo-400", "bg-violet-400", "bg-pink-400"][i]}`}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error banner */}
              <AnimatePresence>
                {regError && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-start gap-3 p-4 rounded-2xl bg-rose-50 border border-rose-200"
                  >
                    <Ic.Alert
                      size={16}
                      className="text-rose-500 mt-0.5 shrink-0"
                    />
                    <p className="text-sm text-rose-700">{regError}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Form grid */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.5 }}
                className={`grid grid-cols-1 lg:grid-cols-2 gap-5 transition-opacity ${isDataLoading ? "opacity-40 pointer-events-none" : "opacity-100"}`}
              >
                {/* Left card */}
                <div className="p-6 rounded-3xl bg-white/85 backdrop-blur-sm border border-slate-200 shadow-sm shadow-slate-100 space-y-5">
                  <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
                      <Ic.User size={13} className="text-indigo-600" />
                    </div>
                    <span
                      className="text-xs font-black text-slate-600 uppercase tracking-widest"
                      style={{ fontFamily: "'Syne', sans-serif" }}
                    >
                      Personal Info
                    </span>
                  </div>
                  <TextInput
                    label="Full Name"
                    icon={Ic.User}
                    placeholder="John Doe"
                    disabled={isDataLoading}
                    error={errors.fullName?.message}
                    {...register("fullName", {
                      required: "Full name is required",
                    })}
                  />
                  <TextInput
                    label="Mobile Number"
                    icon={Ic.Phone}
                    placeholder="+1 (555) 000-0000"
                    disabled={isDataLoading}
                    error={errors.mobile?.message}
                    {...register("mobile")}
                  />
                  {/* Email */}
                  <div className="space-y-1.5">
                    <label
                      className="block text-xs font-bold text-slate-600 uppercase tracking-widest"
                      style={{ fontFamily: "'Syne', sans-serif" }}
                    >
                      Email Address
                    </label>
                    <AnimatePresence mode="wait">
                      {emailDisplay && !emailEditing ? (
                        <EmailDisplay
                          key="display"
                          email={emailDisplay}
                          onEdit={openEmailEdit}
                          disabled={isDataLoading}
                        />
                      ) : emailEditing ? (
                        <EmailEditor
                          key="editor"
                          value={emailDraft}
                          onChange={(v) => {
                            setEmailDraft(v);
                            setEmailEditErr(null);
                          }}
                          onSave={saveEmailEdit}
                          onCancel={cancelEmailEdit}
                          error={emailEditErr}
                        />
                      ) : (
                        <TextInput
                          key="input"
                          label=""
                          icon={Ic.Mail}
                          placeholder="your@email.com"
                          type="email"
                          disabled={isDataLoading}
                          error={errors.email?.message}
                          {...register("email", {
                            required: "Email is required",
                          })}
                        />
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Right card */}
                <div className="p-6 rounded-3xl bg-white/85 backdrop-blur-sm border border-slate-200 shadow-sm shadow-slate-100 space-y-5">
                  <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                    <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
                      <Ic.Code size={13} className="text-violet-600" />
                    </div>
                    <span
                      className="text-xs font-black text-slate-600 uppercase tracking-widest"
                      style={{ fontFamily: "'Syne', sans-serif" }}
                    >
                      Professional Info
                    </span>
                  </div>
                  <TextInput
                    label="Location"
                    icon={Ic.MapPin}
                    placeholder="City, Country"
                    disabled={isDataLoading}
                    error={errors.location?.message}
                    {...register("location")}
                  />
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <label
                        className="text-xs font-bold text-slate-600 uppercase tracking-widest"
                        style={{ fontFamily: "'Syne', sans-serif" }}
                      >
                        Skills
                      </label>
                      {!isDataLoading && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                          <Ic.Check size={9} /> Auto-detected
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <Ic.Code
                        size={14}
                        className="absolute left-3.5 top-3.5 text-slate-400"
                      />
                      <textarea
                        rows={5}
                        disabled={isDataLoading}
                        placeholder="React, Node.js, Python…"
                        className="w-full pl-10 pr-4 py-3 rounded-2xl border-2 border-slate-200 bg-white text-sm font-medium text-slate-800 placeholder-slate-300 focus:outline-none focus:border-indigo-300 focus:bg-indigo-50/10 transition-all resize-none disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                        {...register("skills", {
                          required: "Skills are required",
                        })}
                      />
                    </div>
                    {errors.skills && (
                      <p className="text-xs text-rose-500 flex items-center gap-1">
                        <Ic.Alert size={10} /> {errors.skills.message}
                      </p>
                    )}
                    <p className="text-xs text-slate-400">
                      Separate skills with commas · Edit or add more
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Action bar */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.5 }}
                className="flex flex-col sm:flex-row gap-3 justify-end pb-2"
              >
                <button
                  type="button"
                  onClick={() => {
                    sessionStorage.removeItem("registrationSessionId");
                    sessionStorage.removeItem("showOnboarding");
                    onComplete();
                    navigate("/");
                  }}
                  className="px-6 py-3.5 rounded-2xl border-2 border-slate-200 bg-white text-slate-600 text-sm font-bold hover:border-slate-300 hover:bg-slate-50 transition-all shadow-sm"
                >
                  Skip for now
                </button>
                <motion.button
                  type="submit"
                  disabled={isDataLoading}
                  whileHover={
                    !isDataLoading
                      ? {
                          y: -2,
                          boxShadow: "0 14px 36px rgba(99,102,241,0.35)",
                        }
                      : {}
                  }
                  whileTap={!isDataLoading ? { scale: 0.98 } : {}}
                  className="flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-2xl bg-linear-to-r from-indigo-600 to-violet-600 text-white text-sm font-black shadow-lg shadow-indigo-200 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ fontFamily: "'Syne', sans-serif" }}
                >
                  {isDataLoading ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                        className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                      />
                      Please wait…
                    </>
                  ) : (
                    <>
                      <Ic.CheckCircle size={15} />
                      Complete Registration
                      <Ic.ArrowRight size={14} />
                    </>
                  )}
                </motion.button>
              </motion.div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default OnboardingFlow;

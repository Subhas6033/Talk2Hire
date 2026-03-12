import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { useMicrosoftUserAuth } from "../../Hooks/useMicrosoftAuth";
import { useAuth } from "../../Hooks/useAuthHook";
import { GoogleLogin } from "@react-oauth/google";

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
  Eye: (p) => (
    <Svg
      {...p}
      d={[
        "M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z",
        "M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
      ]}
    />
  ),
  EyeOff: (p) => (
    <Svg
      {...p}
      d={[
        "M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94",
        "M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19",
        "M1 1l22 22",
      ]}
    />
  ),
  Upload: (p) => (
    <Svg
      {...p}
      d={[
        "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",
        "M17 8l-5-5-5 5",
        "M12 3v12",
      ]}
    />
  ),
  File: (p) => (
    <Svg
      {...p}
      d={[
        "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z",
        "M14 2v6h6",
      ]}
    />
  ),
  X: (p) => <Svg {...p} d="M18 6 6 18M6 6l12 12" />,
  Sparkles: (p) => (
    <Svg
      {...p}
      d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
    />
  ),
  Alert: (p) => (
    <Svg
      {...p}
      d={["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M12 8v4", "M12 16h.01"]}
    />
  ),
  Shield: (p) => <Svg {...p} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  Zap: (p) => <Svg {...p} d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />,
  Check: (p) => <Svg {...p} sw={2.5} d="M20 6 9 17l-5-5" />,
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
  Lock: (p) => (
    <Svg
      {...p}
      d={[
        "M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z",
        "M7 11V7a5 5 0 0 1 10 0v4",
      ]}
    />
  ),
  ArrowRight: (p) => <Svg {...p} d={["M5 12h14", "M12 5l7 7-7 7"]} />,
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
  Target: (p) => (
    <Svg
      {...p}
      d={[
        "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z",
        "M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z",
        "M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
      ]}
    />
  ),
  Trophy: (p) => (
    <Svg
      {...p}
      d={[
        "M6 9H4.5a2.5 2.5 0 0 1 0-5H6",
        "M18 9h1.5a2.5 2.5 0 0 0 0-5H18",
        "M4 22h16",
        "M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.23 7 22",
        "M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.23 17 22",
        "M18 2H6v7a6 6 0 0 0 12 0V2z",
      ]}
    />
  ),
  Users: (p) => (
    <Svg
      {...p}
      d={[
        "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2",
        "M23 21v-2a4 4 0 0 0-3-3.87",
        "M16 3.13a4 4 0 0 1 0 7.75",
        "M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
      ]}
    />
  ),
};

const MicrosoftLogo = () => (
  <svg width="18" height="18" viewBox="0 0 21 21" fill="none">
    <rect x="1" y="1" width="9" height="9" fill="#f25022" />
    <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
    <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
    <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
  </svg>
);

const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

function generateStrongPassword() {
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowercase = "abcdefghjkmnpqrstuvwxyz";
  const numbers = "23456789";
  const special = "@#$%^&*!";
  const all = uppercase + lowercase + numbers + special;
  const pick = (charset) => charset[Math.floor(Math.random() * charset.length)];
  const required = [
    pick(uppercase),
    pick(uppercase),
    pick(lowercase),
    pick(lowercase),
    pick(numbers),
    pick(numbers),
    pick(special),
    pick(special),
    pick(all),
    pick(all),
  ];
  for (let i = required.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [required[i], required[j]] = [required[j], required[i]];
  }
  return required.join("");
}

const Field = ({ label, hint, error, children }) => (
  <div>
    <label
      className="block text-sm font-bold text-slate-700 mb-2"
      style={{ fontFamily: "'Syne', sans-serif" }}
    >
      {label}
    </label>
    {children}
    {hint && !error && <p className="text-xs text-slate-400 mt-1.5">{hint}</p>}
    <AnimatePresence>
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className="text-xs text-rose-500 mt-1.5 flex items-center gap-1"
        >
          <Ic.Alert size={11} className="text-rose-400" /> {error}
        </motion.p>
      )}
    </AnimatePresence>
  </div>
);

const FeatureCard = ({ icon: IconComp, title, desc, accent, delay }) => (
  <motion.div
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    className="flex items-start gap-4 p-4 rounded-2xl bg-white/60 backdrop-blur-sm border border-white/80 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-default"
  >
    <div
      className={`w-10 h-10 rounded-xl ${accent} flex items-center justify-center shrink-0 shadow-sm`}
    >
      <IconComp size={17} className="text-white" />
    </div>
    <div>
      <h4
        className="font-bold text-slate-800 text-sm mb-0.5"
        style={{ fontFamily: "'Syne', sans-serif" }}
      >
        {title}
      </h4>
      <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
    </div>
  </motion.div>
);

const EmailExtracted = ({ email, onEdit }) => (
  <motion.div
    initial={{ opacity: 0, y: 8, scale: 0.97 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: 8, scale: 0.97 }}
    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    className="flex items-center gap-3 p-3.5 rounded-2xl bg-emerald-50 border-2 border-emerald-200"
  >
    <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0 shadow-sm">
      <Ic.Mail size={15} className="text-white" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-0.5">
        ✦ AI Extracted Email
      </p>
      <p className="text-sm font-bold text-slate-800 truncate">{email}</p>
    </div>
    <motion.button
      whileHover={{ scale: 1.05, boxShadow: "0 4px 12px rgba(16,185,129,0.2)" }}
      whileTap={{ scale: 0.95 }}
      onClick={onEdit}
      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border-2 border-emerald-200 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-all shrink-0 shadow-sm"
    >
      <Ic.Edit size={11} /> Edit
    </motion.button>
  </motion.div>
);

const EmailEditor = ({ value, onChange, onSave, onCancel, error }) => (
  <motion.div
    initial={{ opacity: 0, y: 8, scale: 0.97 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: 8, scale: 0.97 }}
    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
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
          className={`w-full pl-10 pr-4 py-3 rounded-2xl border-2 text-sm font-medium text-slate-800 placeholder-slate-300 focus:outline-none transition-all bg-white ${error ? "border-rose-300 focus:border-rose-400 bg-rose-50/30" : "border-indigo-300 focus:border-indigo-400 focus:bg-indigo-50/20"}`}
        />
      </div>
      <motion.button
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        onClick={onSave}
        className="flex items-center gap-1.5 px-4 py-3 rounded-2xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors shrink-0 shadow-md"
      >
        <Ic.Check size={14} /> Save
      </motion.button>
      <motion.button
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        onClick={onCancel}
        className="p-3 rounded-2xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
      >
        <Ic.X size={14} />
      </motion.button>
    </div>
    {error && (
      <p className="text-xs text-rose-500 flex items-center gap-1">
        <Ic.Alert size={10} /> {error}
      </p>
    )}
    <p className="text-xs text-slate-400">
      Press Enter to save · Esc to cancel
    </p>
  </motion.div>
);

const RegistrationForm = () => {
  const navigate = useNavigate();
  const { loginWithMicrosoft, redirecting } = useMicrosoftUserAuth();
  const { loginWithGoogle, googleLoading, googleError } = useAuth();

  const [resumeFile, setResumeFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setExtracting] = useState(false);

  const [extractedEmail, setExtractedEmail] = useState(null);
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");
  const [emailEditError, setEmailEditError] = useState(null);

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [suggestedPassword] = useState(() => generateStrongPassword());

  const [fieldErrors, setFieldErrors] = useState({});
  const [uploadError, setUploadError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const API_URL = import.meta?.env?.VITE_BACKEND_URL || "";

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      sessionStorage.removeItem("showOnboarding");
      await loginWithGoogle(credentialResponse).unwrap();
      navigate("/", { replace: true });
    } catch (err) {
      console.error("Google signup failed:", err);
    }
  };

  const processFile = (file) => {
    setFieldErrors((e) => ({ ...e, resume: null }));
    setUploadError(null);
    if (!file) {
      setResumeFile(null);
      return;
    }
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowed.includes(file.type)) {
      setFieldErrors((e) => ({
        ...e,
        resume: "Only PDF or Word files (.doc, .docx) are allowed",
      }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFieldErrors((e) => ({
        ...e,
        resume: "File size must be less than 5MB",
      }));
      return;
    }
    setResumeFile(file);
    setExtractedEmail(null);
    setEditingEmail(false);
    setExtracting(true);
    setTimeout(() => {
      setExtractedEmail("candidate@example.com");
      setEmailDraft("candidate@example.com");
      setExtracting(false);
      setFieldErrors((e) => ({ ...e, email: null }));
    }, 1200);
  };

  const removeResume = () => {
    setResumeFile(null);
    setExtractedEmail(null);
    setEditingEmail(false);
    setEmailDraft("");
    setExtracting(false);
    const f = document.getElementById("resume-upload");
    if (f) f.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    processFile(e.dataTransfer.files[0]);
  };

  const openEmailEdit = () => {
    setEmailDraft(extractedEmail || "");
    setEmailEditError(null);
    setEditingEmail(true);
  };
  const saveEmailEdit = () => {
    if (!emailDraft || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailDraft)) {
      setEmailEditError("Please enter a valid email address");
      return;
    }
    setExtractedEmail(emailDraft);
    setEditingEmail(false);
    setEmailEditError(null);
    setFieldErrors((e) => ({ ...e, email: null }));
  };
  const cancelEmailEdit = () => {
    setEmailDraft(extractedEmail || "");
    setEditingEmail(false);
    setEmailEditError(null);
  };

  const handlePasswordFocus = () => {
    if (!password) {
      setPassword(suggestedPassword);
      setShowPassword(true);
      setFieldErrors((er) => ({ ...er, password: null }));
    }
  };
  const handlePasswordChange = (val) => {
    setPassword(val);
    setFieldErrors((er) => ({ ...er, password: null }));
  };

  const handleContinue = async () => {
    const errors = {};
    if (!resumeFile) errors.resume = "Please upload your resume to continue";
    if (!extractedEmail)
      errors.email =
        "We couldn't extract your email — please try a different file";
    if (!password || password.length < 6)
      errors.password = "Password must be at least 6 characters";
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }
    setIsUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("password", password);
      fd.append("email", extractedEmail);
      fd.append("resume", resumeFile);
      const res = await fetch(`${API_URL}/api/v1/auth/upload-resume`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Upload failed. Please try again.");
      }
      const result = await res.json();
      if (!result.data?.sessionId)
        throw new Error("No session returned from server.");
      sessionStorage.setItem("registrationSessionId", result.data.sessionId);
      sessionStorage.setItem("showOnboarding", "true");
      navigate("/", { replace: true });
    } catch (err) {
      setIsUploading(false);
      setUploadError(err.message || "Something went wrong. Please try again.");
    }
  };

  const inputCls = (err) =>
    `w-full px-4 py-3 rounded-2xl border-2 text-sm font-medium text-slate-800 placeholder-slate-300 focus:outline-none transition-all ${err ? "border-rose-300 focus:border-rose-400 bg-rose-50/30" : "border-slate-200 bg-white focus:border-indigo-300 focus:bg-white"}`;

  const strengthLevel =
    password.length >= 12
      ? 4
      : password.length >= 8
        ? 3
        : password.length >= 6
          ? 2
          : password.length > 0
            ? 1
            : 0;
  const strengthLabel = ["", "Too short", "Weak", "Good", "Strong"][
    strengthLevel
  ];
  const strengthColor = [
    "",
    "bg-rose-400",
    "bg-amber-400",
    "bg-blue-400",
    "bg-emerald-400",
  ][strengthLevel];

  const isBusy = isUploading || redirecting || googleLoading;

  return (
    <>
      <title>Create Your Profile | Talk2Hire AI Job Platform</title>
      <meta
        name="description"
        content="Upload your resume and create your Talk2Hire profile in seconds. Our AI extracts your details and matches you with the right job opportunities instantly."
      />
      <meta
        name="keywords"
        content="AI job matching, resume upload platform, create job profile, online interview preparation, Talk2Hire signup"
      />
      <meta name="robots" content="index, follow" />
      <link rel="canonical" href="https://talk2hire.com/signup" />
      <meta property="og:title" content="Create Your Profile | Talk2Hire" />
      <meta
        property="og:description"
        content="Upload your resume and let AI instantly match you with top opportunities on Talk2Hire."
      />
      <meta property="og:type" content="website" />
      <meta property="og:url" content="https://talk2hire.com/signup" />
      <meta
        property="og:image"
        content="https://talk2hire.com/talk2hirelogo.png"
      />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="Create Your Profile | Talk2Hire" />
      <meta
        name="twitter:description"
        content="Smart resume upload. Instant AI job matching. Start your career journey with Talk2Hire."
      />
      <meta
        name="twitter:image"
        content="https://talk2hire.com/talk2hirelogo.png"
      />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100..900;1,100..900&family=Sour+Gummy:ital,wght@0,100..900;1,100..900&display=swap');
        * { box-sizing: border-box; }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes spin-slow { to { transform: rotate(360deg); } }
        .float { animation: float 4s ease-in-out infinite; }
        .spin-slow { animation: spin-slow 12s linear infinite; }
      `}</style>

      <div
        className="min-h-screen relative overflow-hidden"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        <div className="absolute inset-0 bg-linear-to-br from-slate-100 via-indigo-50/70 to-violet-100/60" />
        <div className="absolute -top-40 -left-40 w-150 h-150 rounded-full bg-indigo-200/40 blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-125 h-125 rounded-full bg-violet-200/50 blur-[100px] pointer-events-none" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-sky-200/30 blur-[80px] pointer-events-none" />
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.035]"
          style={{
            backgroundImage:
              "radial-gradient(circle, #6366f1 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="absolute top-10 right-10 w-72 h-72 rounded-full border border-indigo-200/40 pointer-events-none spin-slow" />
        <div
          className="absolute top-20 right-20 w-52 h-52 rounded-full border border-violet-200/30 pointer-events-none"
          style={{ animation: "spin-slow 18s linear infinite reverse" }}
        />

        <div className="relative z-10 min-h-screen flex flex-col">
          <div className="flex-1 flex items-center px-4 sm:px-6 lg:px-10 py-6">
            <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 xl:gap-20 items-center">
              {/* LEFT */}
              <motion.div
                initial={{ opacity: 0, x: -28 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                className="space-y-8 order-2 lg:order-1"
              >
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-100/80 border border-indigo-300/60 shadow-sm backdrop-blur-sm">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                  <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
                    AI-Powered Hiring Portal
                  </span>
                </div>
                <div>
                  <h1
                    className="text-4xl sm:text-5xl xl:text-[3.4rem] font-black text-slate-900 leading-[1.05] tracking-tight mb-5"
                    style={{ fontFamily: "'Syne', sans-serif" }}
                  >
                    Your next great
                    <br />
                    career starts
                    <br />
                    <span className="bg-linear-to-r from-indigo-600 via-violet-600 to-purple-600 bg-clip-text text-transparent">
                      right here
                    </span>
                  </h1>
                  <p className="text-base text-slate-600 leading-relaxed max-w-md">
                    Upload your resume and let our AI instantly match you with
                    top opportunities. No lengthy forms — just smart, fast, and
                    personalized job matching.
                  </p>
                </div>
                <div className="space-y-3">
                  <FeatureCard
                    icon={Ic.Target}
                    title="Smart Job Matching"
                    accent="bg-linear-to-br from-indigo-500 to-indigo-700"
                    desc="AI scans your resume and surfaces roles perfectly aligned to your skills and experience"
                    delay={0.15}
                  />
                  <FeatureCard
                    icon={Ic.Zap}
                    title="Instant Profile Creation"
                    accent="bg-linear-to-br from-amber-500 to-orange-500"
                    desc="Your profile is built automatically from your resume — ready to apply in under a minute"
                    delay={0.25}
                  />
                  <FeatureCard
                    icon={Ic.Shield}
                    title="Confidential & Secure"
                    accent="bg-linear-to-br from-emerald-500 to-teal-600"
                    desc="Your resume and personal data are encrypted and never shared without your consent"
                    delay={0.35}
                  />
                </div>
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45, duration: 0.5 }}
                  className="grid grid-cols-3 gap-3 pt-1"
                >
                  {[
                    { icon: Ic.Users, val: "12K+", lab: "Candidates placed" },
                    { icon: Ic.Trophy, val: "95%", lab: "Interview success" },
                    { icon: Ic.Briefcase, val: "500+", lab: "Hiring partners" },
                  ].map(({ icon: IconComp, val, lab }) => (
                    <div
                      key={lab}
                      className="p-4 bg-white/70 backdrop-blur-sm rounded-2xl border border-white/90 shadow-sm text-center hover:-translate-y-0.5 transition-transform cursor-default"
                    >
                      <div className="flex justify-center mb-1.5">
                        <IconComp size={15} className="text-indigo-400" />
                      </div>
                      <p
                        className="text-xl font-black text-slate-900"
                        style={{ fontFamily: "'Syne', sans-serif" }}
                      >
                        {val}
                      </p>
                      <p className="text-xs text-slate-500 font-medium mt-0.5 leading-tight">
                        {lab}
                      </p>
                    </div>
                  ))}
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.5 }}
                  className="inline-flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/70 backdrop-blur-sm border border-white/90 shadow-sm"
                >
                  <div className="flex -space-x-2">
                    {["bg-indigo-400", "bg-violet-400", "bg-pink-400"].map(
                      (c, i) => (
                        <div
                          key={i}
                          className={`w-7 h-7 rounded-full ${c} border-2 border-white flex items-center justify-center text-white text-xs font-bold`}
                        >
                          {["A", "B", "C"][i]}
                        </div>
                      ),
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-700">
                      Joined by 12,000+ job seekers
                    </p>
                    <p className="text-xs text-slate-400">This month alone</p>
                  </div>
                </motion.div>
              </motion.div>

              {/* RIGHT */}
              <motion.div
                initial={{ opacity: 0, x: 28 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                className="order-1 lg:order-2"
              >
                <div className="rounded-3xl overflow-hidden shadow-2xl shadow-indigo-200/40 border border-white/80 backdrop-blur-sm">
                  {/* Header band */}
                  <div className="bg-linear-to-r from-indigo-600 via-violet-600 to-purple-600 px-8 pt-8 pb-7">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-inner float">
                        <Ic.Sparkles size={22} className="text-white" />
                      </div>
                      <div>
                        <h2
                          className="text-xl font-black text-white"
                          style={{ fontFamily: "'Syne', sans-serif" }}
                        >
                          Create Your Profile
                        </h2>
                        <p className="text-indigo-200 text-xs font-medium">
                          Start your journey to the perfect role
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {[
                        "Upload Resume",
                        "AI Extracts Info",
                        "Set Password",
                      ].map((s, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-1.5 flex-1"
                        >
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${i === 0 ? "bg-white text-indigo-600" : "bg-white/25 text-white/70"}`}
                          >
                            {i + 1}
                          </div>
                          <span
                            className={`text-xs font-semibold truncate ${i === 0 ? "text-white" : "text-white/50"}`}
                          >
                            {s}
                          </span>
                          {i < 2 && (
                            <div className="w-3 h-px bg-white/25 shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Form body */}
                  <div className="bg-white/95 backdrop-blur-sm px-8 py-7 space-y-5">
                    {/* Microsoft + Google side by side */}
                    <div className="flex gap-3">
                      <motion.button
                        whileHover={{
                          y: -2,
                          boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
                        }}
                        whileTap={{ scale: 0.98 }}
                        onClick={loginWithMicrosoft}
                        disabled={isBusy}
                        className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white border-2 border-slate-200 hover:border-slate-300 text-slate-700 font-semibold text-sm shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {redirecting ? (
                          <>
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{
                                duration: 1,
                                repeat: Infinity,
                                ease: "linear",
                              }}
                              className="w-4 h-4 border-2 border-slate-300 border-t-indigo-500 rounded-full"
                            />
                            <span className="hidden sm:inline">
                              Redirecting…
                            </span>
                          </>
                        ) : (
                          <>
                            <MicrosoftLogo /> <span>Microsoft</span>
                          </>
                        )}
                      </motion.button>

                      <div className="flex-1 relative">
                        <button
                          disabled={isBusy}
                          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white border-2 border-slate-200 hover:border-red-300 text-slate-700 font-semibold text-sm shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed pointer-events-none"
                        >
                          {googleLoading ? (
                            <>
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{
                                  duration: 1,
                                  repeat: Infinity,
                                  ease: "linear",
                                }}
                                className="w-4 h-4 border-2 border-slate-300 border-t-red-500 rounded-full"
                              />
                              <span className="hidden sm:inline">
                                Signing in…
                              </span>
                            </>
                          ) : (
                            <>
                              <GoogleLogo /> <span>Google</span>
                            </>
                          )}
                        </button>
                        <div
                          className="absolute inset-0 opacity-0 overflow-hidden"
                          style={{ borderRadius: "1rem" }}
                        >
                          <GoogleLogin
                            onSuccess={handleGoogleSuccess}
                            onError={() => {}}
                            useOneTap={false}
                            width="500"
                            size="large"
                          />
                        </div>
                      </div>
                    </div>

                    {googleError && (
                      <p className="text-xs text-rose-500 flex items-center gap-1 -mt-2">
                        <Ic.Alert size={11} className="text-rose-400" />{" "}
                        {googleError}
                      </p>
                    )}

                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-slate-200" />
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                        or sign up with resume
                      </span>
                      <div className="flex-1 h-px bg-slate-200" />
                    </div>

                    {/* Resume Upload */}
                    <Field
                      label="Upload Your Resume"
                      error={fieldErrors.resume}
                    >
                      <AnimatePresence mode="wait">
                        {!resumeFile ? (
                          <motion.label
                            key="dropzone"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            htmlFor="resume-upload"
                            onDragOver={(e) => {
                              e.preventDefault();
                              setIsDragging(true);
                            }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                            className={`flex flex-col items-center justify-center w-full h-36 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${isDragging ? "border-indigo-400 bg-indigo-50" : fieldErrors.resume ? "border-rose-300 bg-rose-50/30 hover:border-rose-400" : "border-slate-200 bg-slate-50/60 hover:border-indigo-300 hover:bg-indigo-50/40"}`}
                          >
                            <motion.div
                              animate={
                                isDragging ? { scale: 1.12 } : { scale: 1 }
                              }
                              className="flex flex-col items-center gap-2 pointer-events-none"
                            >
                              <div
                                className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-colors ${isDragging ? "bg-indigo-100" : "bg-slate-100"}`}
                              >
                                <Ic.Upload
                                  size={20}
                                  className={
                                    isDragging
                                      ? "text-indigo-600"
                                      : "text-slate-500"
                                  }
                                />
                              </div>
                              <div className="text-center">
                                <span className="text-sm font-semibold text-slate-700 block">
                                  {isDragging
                                    ? "Drop your resume here"
                                    : "Click to upload or drag & drop"}
                                </span>
                                <span className="text-xs text-slate-400 mt-0.5 block">
                                  PDF, DOC, DOCX · Max 5MB
                                </span>
                              </div>
                            </motion.div>
                            <input
                              id="resume-upload"
                              type="file"
                              accept=".pdf,.doc,.docx"
                              onChange={(e) => processFile(e.target.files[0])}
                              className="hidden"
                              disabled={isBusy}
                            />
                          </motion.label>
                        ) : (
                          <motion.div
                            key="file-preview"
                            initial={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.96 }}
                            className="flex items-center gap-3 p-4 bg-indigo-50 border-2 border-indigo-200 rounded-2xl"
                          >
                            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-sm">
                              <Ic.File size={16} className="text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-800 truncate">
                                {resumeFile.name}
                              </p>
                              <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                                {(resumeFile.size / 1024).toFixed(1)} KB
                                {isExtracting && (
                                  <span className="flex items-center gap-1 text-indigo-500 font-semibold">
                                    <motion.span
                                      animate={{ opacity: [1, 0.3, 1] }}
                                      transition={{
                                        duration: 1,
                                        repeat: Infinity,
                                      }}
                                    >
                                      ✦ Extracting info…
                                    </motion.span>
                                  </span>
                                )}
                                {extractedEmail && !isExtracting && (
                                  <span className="text-emerald-600 font-semibold">
                                    ✓ Info extracted
                                  </span>
                                )}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {extractedEmail && !isExtracting && (
                                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                                  <Ic.Check
                                    size={11}
                                    className="text-emerald-600"
                                  />
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={removeResume}
                                disabled={isBusy}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all disabled:opacity-40"
                              >
                                <Ic.X size={15} />
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </Field>

                    {/* Extracted Email */}
                    <AnimatePresence>
                      {(extractedEmail || isExtracting) && (
                        <motion.div
                          key="email-section"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="pt-1 space-y-1.5">
                            <label
                              className="block text-sm font-bold text-slate-700"
                              style={{ fontFamily: "'Syne', sans-serif" }}
                            >
                              Extracted Email
                            </label>
                            <AnimatePresence mode="wait">
                              {isExtracting ? (
                                <motion.div
                                  key="extracting"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border-2 border-slate-200"
                                >
                                  <div className="w-9 h-9 rounded-xl bg-slate-200 flex items-center justify-center shrink-0">
                                    <motion.div
                                      animate={{ rotate: 360 }}
                                      transition={{
                                        duration: 1,
                                        repeat: Infinity,
                                        ease: "linear",
                                      }}
                                      className="w-4 h-4 border-2 border-slate-400 border-t-indigo-500 rounded-full"
                                    />
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-0.5">
                                      Scanning resume…
                                    </p>
                                    <p className="text-sm text-slate-400 font-medium">
                                      AI is extracting your email
                                    </p>
                                  </div>
                                </motion.div>
                              ) : editingEmail ? (
                                <EmailEditor
                                  key="editor"
                                  value={emailDraft}
                                  onChange={(v) => {
                                    setEmailDraft(v);
                                    setEmailEditError(null);
                                  }}
                                  onSave={saveEmailEdit}
                                  onCancel={cancelEmailEdit}
                                  error={emailEditError}
                                />
                              ) : (
                                <EmailExtracted
                                  key="display"
                                  email={extractedEmail}
                                  onEdit={openEmailEdit}
                                />
                              )}
                            </AnimatePresence>
                            {fieldErrors.email &&
                              !editingEmail &&
                              !isExtracting && (
                                <p className="text-xs text-rose-500 flex items-center gap-1 mt-1">
                                  <Ic.Alert
                                    size={11}
                                    className="text-rose-400"
                                  />{" "}
                                  {fieldErrors.email}
                                </p>
                              )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Password */}
                    <Field
                      label="Create Password"
                      hint="Must be at least 6 characters"
                      error={fieldErrors.password}
                    >
                      <div className="relative">
                        <Ic.Lock
                          size={15}
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => handlePasswordChange(e.target.value)}
                          onFocus={handlePasswordFocus}
                          disabled={isBusy}
                          placeholder="Create a secure password"
                          className={`${inputCls(fieldErrors.password)} pl-10 pr-12`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          disabled={isBusy}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 transition-colors rounded-lg hover:bg-slate-100"
                        >
                          {showPassword ? (
                            <Ic.EyeOff size={15} />
                          ) : (
                            <Ic.Eye size={15} />
                          )}
                        </button>
                      </div>
                      <AnimatePresence>
                        {password && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden mt-2 space-y-1.5"
                          >
                            <div className="flex gap-1">
                              {[1, 2, 3, 4].map((i) => (
                                <motion.div
                                  key={i}
                                  animate={{
                                    backgroundColor:
                                      i <= strengthLevel ? "" : "#f1f5f9",
                                  }}
                                  className={`h-1 flex-1 rounded-full transition-colors duration-400 ${i <= strengthLevel ? strengthColor : "bg-slate-100"}`}
                                />
                              ))}
                            </div>
                            <p className="text-xs text-slate-400">
                              {strengthLabel} password
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </Field>

                    {/* Global error */}
                    <AnimatePresence>
                      {uploadError && (
                        <motion.div
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          className="flex items-start gap-3 p-4 rounded-2xl bg-rose-50 border border-rose-200"
                        >
                          <Ic.Alert
                            size={16}
                            className="text-rose-500 shrink-0 mt-0.5"
                          />
                          <p className="text-sm text-rose-700">{uploadError}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Submit */}
                    <motion.button
                      whileHover={
                        !isBusy
                          ? {
                              y: -2,
                              boxShadow: "0 16px 40px rgba(99,102,241,0.4)",
                            }
                          : {}
                      }
                      whileTap={!isBusy ? { scale: 0.98 } : {}}
                      onClick={handleContinue}
                      disabled={isBusy}
                      className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl bg-linear-to-r from-indigo-600 via-violet-600 to-purple-600 text-white font-bold text-sm shadow-lg shadow-indigo-300/50 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                      style={{ fontFamily: "'Syne', sans-serif" }}
                    >
                      {isUploading ? (
                        <>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{
                              duration: 1,
                              repeat: Infinity,
                              ease: "linear",
                            }}
                            className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                          />
                          Uploading resume…
                        </>
                      ) : (
                        <>
                          <Ic.Sparkles size={15} /> Create My Profile{" "}
                          <Ic.ArrowRight size={15} />
                        </>
                      )}
                    </motion.button>

                    <p className="text-xs text-slate-400 text-center leading-relaxed">
                      By continuing, you agree to our{" "}
                      <button className="text-indigo-500 hover:text-indigo-700 underline underline-offset-2 transition-colors">
                        Terms of Service
                      </button>{" "}
                      and{" "}
                      <button className="text-indigo-500 hover:text-indigo-700 underline underline-offset-2 transition-colors">
                        Privacy Policy
                      </button>
                    </p>
                  </div>

                  {/* Footer band */}
                  <div className="bg-linear-to-r from-slate-50 via-indigo-50/60 to-violet-50/60 px-8 py-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-center">
                    <p className="text-sm text-slate-500">
                      Already hired before?{" "}
                      <button
                        onClick={() => navigate("/login")}
                        className="font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
                      >
                        Sign in to your account
                      </button>
                    </p>
                    <span className="hidden sm:block text-slate-300">·</span>
                    <p className="text-sm text-slate-500">
                      Hiring?{" "}
                      <button
                        onClick={() => navigate("/login/company")}
                        className="font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
                      >
                        Company portal →
                      </button>
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default RegistrationForm;

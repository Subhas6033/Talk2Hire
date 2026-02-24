import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCompany } from "../Hooks/useCompanyAuthHook";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] },
  }),
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const TABS = ["overview", "contact", "settings"];

const VALUE_ICONS = {
  Innovation: (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
      />
    </svg>
  ),
  Integrity: (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  ),
  Impact: (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </svg>
  ),
  Inclusivity: (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  ),
};

const VALUE_COLORS = [
  {
    bg: "bg-violet-50",
    border: "border-violet-100",
    text: "text-violet-600",
    icon: "bg-violet-100",
  },
  {
    bg: "bg-sky-50",
    border: "border-sky-100",
    text: "text-sky-600",
    icon: "bg-sky-100",
  },
  {
    bg: "bg-emerald-50",
    border: "border-emerald-100",
    text: "text-emerald-600",
    icon: "bg-emerald-100",
  },
  {
    bg: "bg-rose-50",
    border: "border-rose-100",
    text: "text-rose-600",
    icon: "bg-rose-100",
  },
];

function Avatar({ logo, name, size = 108, isUploading }) {
  const initials = (name || "Co")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {logo ? (
        <img
          src={logo}
          alt="Company Logo"
          style={{ width: size, height: size }}
          className="rounded-2xl object-cover shadow-md ring-4 ring-white"
        />
      ) : (
        <div
          style={{ width: size, height: size }}
          className="rounded-2xl bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md ring-4 ring-white"
        >
          <span
            className="text-white font-black tracking-tight"
            style={{ fontSize: size * 0.33 }}
          >
            {initials}
          </span>
        </div>
      )}
      {isUploading && (
        <div
          style={{ width: size, height: size }}
          className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center"
        >
          <svg
            className="w-8 h-8 text-white animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </div>
      )}
    </div>
  );
}

function Tag({ label, color = "indigo" }) {
  const cls = {
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
    violet: "bg-violet-50 text-violet-600 border-violet-100",
    sky: "bg-sky-50 text-sky-600 border-sky-100",
  };
  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-semibold border ${cls[color] ?? cls.indigo}`}
    >
      {label}
    </span>
  );
}

function InfoField({ label, value }) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
          {label}
        </label>
      )}
      <p className="text-gray-700 text-sm leading-relaxed">
        {value || <span className="text-gray-300 italic">Not provided</span>}
      </p>
    </div>
  );
}

function InfoCard({ children, className = "" }) {
  return (
    <div
      className={`bg-white rounded-2xl border border-gray-100 p-6 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

function Skeleton({ className = "" }) {
  return (
    <div className={`animate-pulse bg-gray-100 rounded-xl ${className}`} />
  );
}

function PageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 p-5 md:p-10">
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
          <div className="flex gap-6 items-start">
            <Skeleton className="w-28 h-28 rounded-2xl" />
            <div className="flex-1 space-y-3 pt-1">
              <Skeleton className="h-8 w-52" />
              <Skeleton className="h-4 w-40" />
              <div className="flex gap-2 pt-1">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  );
}

export default function CompanyProfile() {
  const {
    company,
    loading,
    error,
    hydrated,
    updateCompanyLogo,
    getCurrentCompany,
    clearError,
  } = useCompany();

  const [tab, setTab] = useState("overview");
  const [toast, setToast] = useState(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const fileRef = useRef();

  // Fetch fresh data on mount so the page always reflects server state after navigation
  useEffect(() => {
    getCurrentCompany();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (error) {
      showToast("error", error);
      clearError();
    }
  }, [error]); // eslint-disable-line react-hooks/exhaustive-deps

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3200);
  };

  const handleLogoChange = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;

    // Show optimistic preview immediately before the upload resolves
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target.result);
    reader.readAsDataURL(file);

    setIsUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("logo", file);
      const result = await updateCompanyLogo(formData);
      if (result?.error) {
        setLogoPreview(null);
        showToast("error", result.payload || "Failed to upload logo.");
      } else {
        showToast("success", "Logo updated!");
        setLogoPreview(null);
      }
    } catch {
      setLogoPreview(null);
      showToast("error", "Something went wrong. Please try again.");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const currentLogo = logoPreview || company?.logo;
  const values = Array.isArray(company?.values)
    ? company.values
    : ["Innovation", "Integrity", "Impact", "Inclusivity"];

  if (!hydrated || loading || (!company && hydrated)) {
    return <PageSkeleton />;
  }

  return (
    <div
      className="min-h-screen bg-gray-50 overflow-x-hidden"
      style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}
    >
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-48 -right-48 w-160 h-160 bg-indigo-100/50 rounded-full blur-3xl" />
        <div className="absolute -bottom-48 -left-48 w-130 h-130 bg-violet-100/40 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-100 h-100 bg-sky-50/50 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.93 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.93 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-semibold ${
                toast.type === "success"
                  ? "bg-emerald-500 text-white shadow-emerald-200"
                  : "bg-red-500 text-white shadow-red-200"
              }`}
            >
              {toast.type === "success" ? (
                <svg
                  className="w-4 h-4 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                <svg
                  className="w-4 h-4 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              )}
              {toast.msg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hero card */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="mb-5"
        >
          <motion.div
            variants={fadeUp}
            className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden"
          >
            <div className="h-1.5 w-full bg-linear-to-r from-indigo-500 via-violet-500 to-purple-400" />
            <div className="p-7 md:p-9">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                {/* Logo upload — only editable element on this page */}
                <div className="relative shrink-0">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoChange}
                  />
                  <motion.div
                    whileHover={{ scale: isUploadingLogo ? 1 : 1.04 }}
                    transition={{ type: "spring", stiffness: 280 }}
                  >
                    <Avatar
                      logo={currentLogo}
                      name={company?.companyName || "Company"}
                      size={100}
                      isUploading={isUploadingLogo}
                    />
                  </motion.div>
                  <motion.button
                    whileHover={{ scale: 1.18 }}
                    whileTap={{ scale: 0.88 }}
                    onClick={() => !isUploadingLogo && fileRef.current.click()}
                    disabled={isUploadingLogo}
                    title="Change company logo"
                    className="absolute -bottom-2 -right-2 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUploadingLogo ? (
                      <svg
                        className="w-3.5 h-3.5 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    )}
                  </motion.button>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="mb-3">
                    <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight leading-tight">
                      {company?.companyName || "Your Company"}
                    </h1>
                    {company?.companyAddress && (
                      <p className="text-gray-400 text-sm mt-1 italic">
                        {company.companyAddress}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {company?.industry && (
                      <Tag label={company.industry} color="indigo" />
                    )}
                    {company?.companySize && (
                      <Tag label={company.companySize} color="violet" />
                    )}
                    {company?.companyLocation && (
                      <Tag label={company.companyLocation} color="sky" />
                    )}
                  </div>
                </div>

                <div className="shrink-0 self-start sm:self-center">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-50 text-gray-400 border border-gray-100">
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                    Read Only
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Stats row */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5"
        >
          {[
            {
              label: "Company Size",
              value: company?.companySize || "—",
              bg: "bg-indigo-50",
              icon: (
                <svg
                  className="w-5 h-5 text-indigo-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.8}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              ),
            },
            {
              label: "Register No.",
              value: company?.companyRegisterNumber || "—",
              bg: "bg-violet-50",
              icon: (
                <svg
                  className="w-5 h-5 text-violet-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.8}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              ),
            },
            {
              label: "Industry",
              value: company?.industry || "—",
              bg: "bg-sky-50",
              icon: (
                <svg
                  className="w-5 h-5 text-sky-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.8}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              ),
            },
            {
              label: "Location",
              value: company?.companyLocation || "—",
              bg: "bg-emerald-50",
              icon: (
                <svg
                  className="w-5 h-5 text-emerald-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.8}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              ),
            },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              variants={fadeUp}
              custom={i}
              whileHover={{
                y: -3,
                boxShadow: "0 12px 28px rgba(99,102,241,0.1)",
              }}
              transition={{ type: "spring", stiffness: 350 }}
              className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm"
            >
              <div
                className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mb-3`}
              >
                {s.icon}
              </div>
              <p className="text-gray-900 font-bold text-sm leading-snug line-clamp-1">
                {s.value}
              </p>
              <p className="text-xs text-gray-400 font-medium mt-0.5 uppercase tracking-widest">
                {s.label}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* Tabs */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="flex gap-1 mb-5 bg-white border border-gray-100 rounded-2xl p-1.5 w-fit shadow-sm"
        >
          {TABS.map((t) => (
            <motion.button
              key={t}
              onClick={() => setTab(t)}
              className={`relative px-5 py-2 rounded-xl text-sm font-semibold capitalize transition-colors duration-200 ${tab === t ? "text-white" : "text-gray-400 hover:text-gray-700"}`}
            >
              {tab === t && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute inset-0 bg-indigo-600 rounded-xl shadow-md shadow-indigo-200"
                  style={{ zIndex: 0 }}
                  transition={{ type: "spring", stiffness: 420, damping: 30 }}
                />
              )}
              <span className="relative z-10">{t}</span>
            </motion.button>
          ))}
        </motion.div>

        <AnimatePresence mode="wait">
          {tab === "overview" && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-4"
            >
              <InfoCard>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">
                  Company Address
                </h3>
                <InfoField value={company?.companyAddress} />
              </InfoCard>
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  {
                    label: "Industry",
                    value: company?.industry,
                    iconBg: "bg-indigo-50",
                    iconColor: "text-indigo-500",
                    icon: (
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                        />
                      </svg>
                    ),
                  },
                  {
                    label: "Company Size",
                    value: company?.companySize,
                    iconBg: "bg-violet-50",
                    iconColor: "text-violet-500",
                    icon: (
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    ),
                  },
                  {
                    label: "Register Number",
                    value: company?.companyRegisterNumber,
                    iconBg: "bg-sky-50",
                    iconColor: "text-sky-500",
                    icon: (
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    ),
                  },
                  {
                    label: "Location",
                    value: company?.companyLocation,
                    iconBg: "bg-emerald-50",
                    iconColor: "text-emerald-500",
                    icon: (
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    ),
                  },
                ].map(({ label, value, icon, iconBg, iconColor }) => (
                  <InfoCard key={label}>
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl ${iconBg} ${iconColor} flex items-center justify-center shrink-0 mt-0.5`}
                      >
                        {icon}
                      </div>
                      <InfoField label={label} value={value} />
                    </div>
                  </InfoCard>
                ))}
              </div>
            </motion.div>
          )}

          {tab === "contact" && (
            <motion.div
              key="contact"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="grid md:grid-cols-3 gap-4"
            >
              {[
                {
                  label: "Website",
                  value: company?.companySite,
                  bg: "bg-indigo-50",
                  text: "text-indigo-600",
                  icon: (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.8}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                      />
                    </svg>
                  ),
                },
                {
                  label: "Email Address",
                  value: company?.companyMail,
                  bg: "bg-violet-50",
                  text: "text-violet-600",
                  icon: (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.8}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  ),
                },
                {
                  label: "Phone Number",
                  value: company?.companyMobile,
                  bg: "bg-emerald-50",
                  text: "text-emerald-600",
                  icon: (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.8}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                      />
                    </svg>
                  ),
                },
              ].map(({ label, value, icon, bg, text }) => (
                <motion.div
                  key={label}
                  whileHover={{ y: -3 }}
                  transition={{ type: "spring", stiffness: 350 }}
                >
                  <InfoCard className="h-full">
                    <div
                      className={`w-11 h-11 rounded-2xl ${bg} ${text} flex items-center justify-center mb-4`}
                    >
                      {icon}
                    </div>
                    <InfoField label={label} value={value} />
                  </InfoCard>
                </motion.div>
              ))}
            </motion.div>
          )}

          {tab === "settings" && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-4"
            >
              <InfoCard>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-5">
                  Core Values
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {values.map((v, i) => {
                    const c = VALUE_COLORS[i % VALUE_COLORS.length];
                    return (
                      <motion.div
                        key={v + i}
                        initial={{ opacity: 0, scale: 0.88 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{
                          delay: i * 0.07,
                          duration: 0.35,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                        whileHover={{ y: -5, scale: 1.03 }}
                        className={`${c.bg} border ${c.border} rounded-2xl p-5 flex flex-col items-center gap-2.5 cursor-default`}
                      >
                        <div
                          className={`w-10 h-10 rounded-xl ${c.icon} ${c.text} flex items-center justify-center`}
                        >
                          {VALUE_ICONS[v] || (
                            <span className="font-black text-lg">
                              {(v || "?")[0]}
                            </span>
                          )}
                        </div>
                        <span
                          className={`${c.text} font-semibold text-sm text-center leading-tight`}
                        >
                          {v}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              </InfoCard>

              <InfoCard>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">
                  Danger Zone
                </h3>
                <div className="flex items-center justify-between p-4 rounded-xl bg-red-50 border border-red-100">
                  <div>
                    <p className="text-sm font-semibold text-red-700">
                      Delete Company Account
                    </p>
                    <p className="text-xs text-red-400 mt-0.5">
                      Permanent action — this cannot be undone.
                    </p>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.96 }}
                    className="ml-4 px-4 py-2 rounded-xl bg-red-500 text-white text-xs font-bold shadow-sm hover:bg-red-600 transition-colors shrink-0"
                  >
                    Delete Account
                  </motion.button>
                </div>
              </InfoCard>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center text-gray-300 text-xs mt-12"
        >
          {company?.companyName || "Company"} · Profile ·{" "}
          {new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
          })}
        </motion.p>
      </div>
    </div>
  );
}

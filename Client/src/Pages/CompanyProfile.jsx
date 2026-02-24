import React, { useEffect, useState, useRef } from "react";
import { useCompany } from "../Hooks/useCompanyAuthHook";
import { motion, AnimatePresence } from "motion/react";

// ─── Animation Variants ───────────────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.15 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 28, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
};

const fieldVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
};

const switchVariants = {
  hidden: { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: "easeOut" } },
  exit: { opacity: 0, x: 12, transition: { duration: 0.18 } },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const getInitials = (name) =>
  name
    ? name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "CO";

// ─── Sub-components ───────────────────────────────────────────────────────────

const InfoRow = ({ icon, label, value }) => (
  <motion.div
    variants={fieldVariants}
    className="flex items-start gap-4 py-4 border-b border-gray-100 last:border-0"
  >
    <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 text-base">
      {icon}
    </div>
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-0.5">
        {label}
      </p>
      <p className="text-sm font-medium text-gray-800 break-all">
        {value || (
          <span className="text-gray-300 italic font-normal">Not provided</span>
        )}
      </p>
    </div>
  </motion.div>
);

const EditField = ({ icon, label, name, value, onChange }) => (
  <motion.div variants={fieldVariants} className="group">
    <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
      <span>{icon}</span> {label}
    </label>
    <input
      type="text"
      name={name}
      value={value}
      onChange={onChange}
      placeholder={`Enter ${label.toLowerCase()}`}
      className="w-full bg-white border border-gray-200 text-gray-800 rounded-xl px-4 py-2.5 text-sm
        placeholder-gray-300 outline-none transition-all duration-200
        focus:border-gray-400 focus:ring-4 focus:ring-gray-100 hover:border-gray-300"
    />
  </motion.div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const CompanyProfile = () => {
  const {
    company,
    loading,
    error,
    hydrated,
    isAuthenticated,
    getCurrentCompany,
    updateCompany,
    updateCompanyLocal,
    clearError,
  } = useCompany();

  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const hasFetched = useRef(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    website: "",
    address: "",
    description: "",
    logo: "",
    industry: "",
    size: "",
    founded: "",
  });

  // ── Fetch guard: only if hydrated + authenticated + no data yet ──
  useEffect(() => {
    if (hydrated && isAuthenticated && !company && !hasFetched.current) {
      hasFetched.current = true;
      getCurrentCompany();
    }
  }, [hydrated, isAuthenticated, company]);

  // ── Sync hook data → form ──
  useEffect(() => {
    if (company) {
      setFormData({
        name: company.name || "",
        email: company.email || "",
        phone: company.phone || "",
        website: company.website || "",
        address: company.address || "",
        description: company.description || "",
        logo: company.logo || "",
        industry: company.industry || "",
        size: company.size || "",
        founded: company.founded || "",
      });
    }
  }, [company]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData((prev) => ({ ...prev, logo: reader.result }));
      updateCompanyLocal({ logo: reader.result });
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    await updateCompany(formData);
    setSaving(false);
    setSaved(true);
    setEditMode(false);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleCancel = () => {
    if (company) {
      setFormData({
        name: company.name || "",
        email: company.email || "",
        phone: company.phone || "",
        website: company.website || "",
        address: company.address || "",
        description: company.description || "",
        logo: company.logo || "",
        industry: company.industry || "",
        size: company.size || "",
        founded: company.founded || "",
      });
    }
    setEditMode(false);
  };

  // ── Loading ──
  if (!hydrated || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
            className="w-9 h-9 rounded-full border-[3px] border-gray-200 border-t-gray-700"
          />
          <p className="text-sm text-gray-400 font-medium tracking-wide">
            Loading profile…
          </p>
        </div>
      </div>
    );
  }

  const initials = getInitials(formData.name);

  // Fields shown in view mode
  const infoFields = [
    { icon: "✉️", label: "Email", value: formData.email },
    { icon: "📞", label: "Phone", value: formData.phone },
    { icon: "🌐", label: "Website", value: formData.website },
    { icon: "📍", label: "Address", value: formData.address },
    { icon: "🏭", label: "Industry", value: formData.industry },
    { icon: "👥", label: "Size", value: formData.size },
    { icon: "📅", label: "Founded", value: formData.founded },
  ];

  // Fields shown in edit mode
  const editFields = [
    { icon: "🏢", label: "Company Name", name: "name" },
    { icon: "✉️", label: "Email", name: "email" },
    { icon: "📞", label: "Phone", name: "phone" },
    { icon: "🌐", label: "Website", name: "website" },
    { icon: "📍", label: "Address", name: "address" },
    { icon: "🏭", label: "Industry", name: "industry" },
    { icon: "👥", label: "Company Size", name: "size" },
    { icon: "📅", label: "Founded", name: "founded" },
  ];

  // How many fields are filled
  const filledCount = Object.values(formData).filter(Boolean).length;
  const totalFields = Object.keys(formData).length;
  const fillPercent = Math.round((filledCount / totalFields) * 100);

  return (
    <div className="min-h-screen bg-gray-50/80">
      {/* Top accent line */}
      <div className="h-0.75 w-full bg-linear-to-r from-gray-900 via-gray-400 to-gray-100" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {/* ── Page Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center justify-between mb-8"
        >
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] font-semibold text-gray-400 mb-1">
              Company Settings
            </p>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Profile
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Saved toast */}
            <AnimatePresence>
              {saved && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.85, x: 10 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.85, x: 10 }}
                  transition={{ duration: 0.25 }}
                  className="flex items-center gap-1.5 text-xs font-semibold
                    text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Saved
                </motion.span>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {editMode ? (
                <motion.button
                  key="cancel-btn"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={handleCancel}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600
                    bg-white border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm"
                >
                  Cancel
                </motion.button>
              ) : (
                <motion.button
                  key="edit-btn"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setEditMode(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                    bg-gray-900 text-white hover:bg-gray-700 transition-colors shadow-sm"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
                    />
                  </svg>
                  Edit Profile
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* ── Error Banner ── */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: "auto", marginBottom: 24 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between text-sm text-red-600">
                <div className="flex items-center gap-2">
                  <span>⚠️</span>
                  {error}
                </div>
                <button
                  onClick={clearError}
                  className="text-red-400 hover:text-red-600 transition-colors ml-4"
                >
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Layout Grid ── */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          {/* ────────────────────────────────────────────────────────
              LEFT COLUMN — Identity Card
          ──────────────────────────────────────────────────────── */}
          <motion.div
            variants={cardVariants}
            className="lg:col-span-1 bg-white rounded-3xl border border-gray-100 shadow-sm p-6 flex flex-col items-center text-center"
          >
            {/* Logo / Avatar */}
            <div className="relative mb-5">
              <div
                className="w-24 h-24 rounded-2xl bg-linear-to-br from-gray-100 to-gray-200
                flex items-center justify-center overflow-hidden ring-4 ring-white shadow-md"
              >
                <AnimatePresence mode="wait">
                  {formData.logo ? (
                    <motion.img
                      key="logo-img"
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      transition={{ duration: 0.3 }}
                      src={formData.logo}
                      alt={`${formData.name || "Company"} logo`}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <motion.span
                      key="logo-initials"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-2xl font-black text-gray-400 select-none"
                    >
                      {initials}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>

              {/* Upload overlay in edit mode */}
              <AnimatePresence>
                {editMode && (
                  <motion.label
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 rounded-2xl bg-gray-900/55 flex flex-col items-center
                      justify-center cursor-pointer backdrop-blur-[2px]"
                  >
                    <svg
                      className="w-5 h-5 text-white mb-1"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                      />
                    </svg>
                    <span className="text-white text-[10px] font-bold tracking-wide">
                      UPLOAD
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoUpload}
                    />
                  </motion.label>
                )}
              </AnimatePresence>
            </div>

            {/* Name & email */}
            <motion.div variants={fieldVariants} className="w-full">
              <h2 className="text-lg font-bold text-gray-900 mb-0.5">
                {formData.name || (
                  <span className="text-gray-300 font-normal italic text-base">
                    Company Name
                  </span>
                )}
              </h2>
              <p className="text-sm text-gray-400 mb-4 break-all">
                {formData.email || "No email set"}
              </p>
            </motion.div>

            {/* Active badge */}
            <motion.div variants={fieldVariants}>
              <span
                className="inline-flex items-center gap-1.5 text-xs font-semibold
                text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Active Account
              </span>
            </motion.div>

            {/* Profile completeness bar */}
            <motion.div variants={fieldVariants} className="w-full mt-6">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
                  Profile
                </span>
                <span className="text-[11px] font-bold text-gray-600">
                  {fillPercent}%
                </span>
              </div>
              <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${fillPercent}%` }}
                  transition={{
                    duration: 0.8,
                    delay: 0.4,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="h-full bg-gray-800 rounded-full"
                />
              </div>
            </motion.div>

            {/* Quick stats — only render rows with data */}
            {(formData.industry || formData.size || formData.founded) && (
              <motion.div variants={fieldVariants} className="mt-5 w-full">
                {[
                  { label: "Industry", value: formData.industry },
                  { label: "Size", value: formData.size },
                  { label: "Founded", value: formData.founded },
                ]
                  .filter((r) => r.value)
                  .map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between text-sm py-2.5 border-t border-gray-100"
                    >
                      <span className="text-gray-400 text-xs">{row.label}</span>
                      <span className="font-semibold text-gray-700 text-xs">
                        {row.value}
                      </span>
                    </div>
                  ))}
              </motion.div>
            )}

            {/* Remove logo */}
            <AnimatePresence>
              {editMode && formData.logo && (
                <motion.button
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  onClick={() => setFormData((p) => ({ ...p, logo: "" }))}
                  className="mt-4 text-xs text-red-400 hover:text-red-600 transition-colors font-medium"
                >
                  Remove logo
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>

          {/* ────────────────────────────────────────────────────────
              RIGHT COLUMN — Details / Edit Card
          ──────────────────────────────────────────────────────── */}
          <motion.div
            variants={cardVariants}
            className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm p-6"
          >
            <AnimatePresence mode="wait">
              {/* ── VIEW MODE ── */}
              {!editMode && (
                <motion.div
                  key="view-mode"
                  variants={switchVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-base font-bold text-gray-900">
                      Company Details
                    </h3>
                    <span className="text-[11px] text-gray-400 font-medium">
                      {filledCount} of {totalFields} fields filled
                    </span>
                  </div>

                  <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                  >
                    {infoFields.map((f) => (
                      <InfoRow key={f.label} {...f} />
                    ))}
                  </motion.div>

                  {/* Description block */}
                  <motion.div
                    variants={fieldVariants}
                    className="mt-6 pt-5 border-t border-gray-100"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-1.5">
                      <span>📝</span> About the Company
                    </p>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {formData.description || (
                        <span className="text-gray-300 italic">
                          No description added yet. Click "Edit Profile" to add
                          one.
                        </span>
                      )}
                    </p>
                  </motion.div>
                </motion.div>
              )}

              {/* ── EDIT MODE ── */}
              {editMode && (
                <motion.div
                  key="edit-mode"
                  variants={switchVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <h3 className="text-base font-bold text-gray-900">
                      Editing Profile
                    </h3>
                  </div>

                  <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4"
                  >
                    {editFields.map((f) => (
                      <EditField
                        key={f.name}
                        {...f}
                        value={formData[f.name]}
                        onChange={handleChange}
                      />
                    ))}
                  </motion.div>

                  {/* Description textarea */}
                  <motion.div variants={fieldVariants} className="mb-6">
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
                      <span>📝</span> Description
                    </label>
                    <textarea
                      name="description"
                      rows={4}
                      value={formData.description}
                      onChange={handleChange}
                      placeholder="Describe your company, mission, and values…"
                      className="w-full bg-white border border-gray-200 text-gray-800 rounded-xl px-4 py-3 text-sm
                        placeholder-gray-300 outline-none resize-none transition-all duration-200
                        focus:border-gray-400 focus:ring-4 focus:ring-gray-100 hover:border-gray-300"
                    />
                  </motion.div>

                  {/* Save / footer */}
                  <div className="flex items-center justify-between pt-5 border-t border-gray-100">
                    <p className="text-xs text-gray-400">
                      Changes are saved to your account
                    </p>

                    <motion.button
                      whileHover={{ scale: saving ? 1 : 1.02 }}
                      whileTap={{ scale: saving ? 1 : 0.97 }}
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 text-white text-sm font-semibold
                        rounded-xl hover:bg-gray-700 transition-colors shadow-sm disabled:opacity-60"
                    >
                      <AnimatePresence mode="wait">
                        {saving ? (
                          <motion.span
                            key="saving-state"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex items-center gap-2"
                          >
                            <motion.span
                              animate={{ rotate: 360 }}
                              transition={{
                                repeat: Infinity,
                                duration: 0.8,
                                ease: "linear",
                              }}
                              className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full block"
                            />
                            Saving…
                          </motion.span>
                        ) : (
                          <motion.span
                            key="save-state"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex items-center gap-2"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2.5}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                            Save Changes
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default CompanyProfile;

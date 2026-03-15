import { useRef, useEffect, useState } from "react";
import { useProfile } from "../Hooks/userProfileHook";
import { Button, Modal, PreviousInterview } from "../Components/index";
import { FormField } from "../Components/Common/Input";
import { PerformanceGraph } from "./index.pages";

// ─── Small helpers ────────────────────────────────────────────────────────────

const Spinner = ({ size = 16, className = "" }) => (
  <svg
    style={{ width: size, height: size }}
    className={`animate-spin ${className}`}
    viewBox="0 0 24 24"
    fill="none"
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
      d="M4 12a8 8 0 018-8v8H4z"
    />
  </svg>
);

const SkeletonBlock = ({ className = "" }) => (
  <div className={`animate-pulse rounded-xl bg-slate-200 ${className}`} />
);

// ─── ProfilePage ──────────────────────────────────────────────────────────────

const ProfilePage = () => {
  const { profile, loading, updating, updateError, loadProfile, uploadFiles } =
    useProfile();

  // local UI state
  const [mounted, setMounted] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [selectedResume, setSelectedResume] = useState(null);
  const [resumeError, setResumeError] = useState("");
  const [isPasswordModalOpen, setPasswordModalOpen] = useState(false);
  const [isResumeModalOpen, setResumeModalOpen] = useState(false);

  // password fields (UI only — wire to your change-password endpoint as needed)
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const fileInputRef = useRef();
  const resumeInputRef = useRef();

  // Load profile on mount
  useEffect(() => {
    loadProfile();
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  // Sync preview URL with fresh profile image
  useEffect(() => {
    if (profile?.profile_image_path) setPreviewUrl(profile.profile_image_path);
  }, [profile?.profile_image_path]);

  // ── Image handlers ─────────────────────────────────────────────────────────

  const handleImageFile = (file) => {
    if (!file) return;
    setSelectedImage(file);
    setPreviewUrl(URL.createObjectURL(file));
  };
  const handleImageChange = (e) => handleImageFile(e.target.files[0]);
  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (e) => {
    e.preventDefault();
    handleImageFile(e.dataTransfer.files[0]);
  };

  const handleUploadImage = async () => {
    if (!selectedImage) return;
    const fd = new FormData();
    fd.append("profileImage", selectedImage);
    try {
      await uploadFiles(fd).unwrap();
      setSelectedImage(null);
    } catch {
      // updateError from Redux is shown in the UI
    }
  };

  const cancelImageChange = () => {
    setSelectedImage(null);
    setPreviewUrl(profile?.profile_image_path || null);
  };

  // ── Resume handlers ────────────────────────────────────────────────────────

  const handleResumeChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      setResumeError("Please upload a PDF file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setResumeError("File size must be less than 5MB");
      return;
    }
    setResumeError("");
    setSelectedResume(file);
  };

  const handleUploadResume = async () => {
    if (!selectedResume) {
      setResumeError("Please select a resume file");
      return;
    }
    const fd = new FormData();
    fd.append("resume", selectedResume);
    try {
      await uploadFiles(fd).unwrap();
      setSelectedResume(null);
      setResumeModalOpen(false);
    } catch (err) {
      setResumeError(err?.message || "Failed to upload resume");
    }
  };

  // ── Password handler (UI-only shell — plug in your endpoint) ──────────────

  const handlePasswordUpdate = () => {
    setPasswordError("");
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("All fields are required");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }
    // TODO: dispatch your change-password thunk here
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordModalOpen(false);
  };

  // ── Loading skeleton ───────────────────────────────────────────────────────

  if (loading && !profile) {
    return (
      <div
        className="min-h-screen"
        style={{
          background:
            "linear-gradient(145deg,#f5f3ff 0%,#fafafa 35%,#f0fdf4 100%)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <SkeletonBlock className="h-10 w-48" />
          <SkeletonBlock className="h-44 w-full rounded-3xl" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <SkeletonBlock key={i} className="h-28" />
            ))}
          </div>
          <SkeletonBlock className="h-64 w-full rounded-3xl" />
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const firstLetter = profile.fullName?.charAt(0)?.toUpperCase();

  // ── Derived display values ─────────────────────────────────────────────────

  const stats = [
    {
      label: "Interviews Given",
      value: profile.totalInterview ?? 0,
      gradient: "from-violet-500 to-purple-600",
      border: "border-violet-100",
      text: "text-violet-600",
      icon: (
        <svg
          className="w-5 h-5 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 10l4.553-2.069A1 1 0 0121 8.867v6.266a1 1 0 01-1.447.902L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      ),
    },
    {
      label: "Last Score",
      value:
        profile.interviewScore != null ? `${profile.interviewScore}%` : "N/A",
      gradient: "from-amber-400 to-orange-500",
      border: "border-amber-100",
      text: "text-amber-600",
      icon: (
        <svg
          className="w-5 h-5 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
          />
        </svg>
      ),
    },
    {
      label: "Avg. Time",
      value: profile.averageTime ?? "N/A",
      gradient: "from-sky-400 to-blue-600",
      border: "border-sky-100",
      text: "text-sky-600",
      icon: (
        <svg
          className="w-5 h-5 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    {
      label: "Performance",
      value: profile.performance ?? "N/A",
      gradient: "from-emerald-400 to-teal-600",
      border: "border-emerald-100",
      text: "text-emerald-600",
      icon: (
        <svg
          className="w-5 h-5 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
          />
        </svg>
      ),
    },
  ];

  const bioFields = [
    {
      label: "Full Name",
      value: profile.fullName,
      accentColor: "bg-violet-400",
    },
    {
      label: "Email Address",
      value: profile.email,
      accentColor: "bg-blue-400",
    },
    {
      label: "Total Interviews",
      value: profile.totalInterview ?? 0,
      accentColor: "bg-purple-400",
    },
    {
      label: "Last Score",
      value:
        profile.interviewScore != null ? `${profile.interviewScore}%` : "N/A",
      accentColor: "bg-amber-400",
    },
    {
      label: "Average Time",
      value: profile.averageTime ?? "N/A",
      accentColor: "bg-sky-400",
    },
    {
      label: "Overall Performance",
      value: profile.performance ?? "N/A",
      accentColor: "bg-emerald-400",
    },
  ];

  const anim = (delay) => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? "translateY(0)" : "translateY(20px)",
    transition: `all 0.7s ease-out ${delay}ms`,
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <title>My Profile | Talk2Hire Careers Portal</title>
      <meta
        name="description"
        content="Manage your Talk2Hire account, update your resume, track interview performance, and monitor your AI interview progress."
      />
      <meta name="robots" content="noindex, nofollow, noarchive" />

      <div
        className="min-h-screen"
        style={{
          background:
            "linear-gradient(145deg,#f5f3ff 0%,#fafafa 35%,#f0fdf4 100%)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-6 sm:space-y-8">
          {/* ── Page title ── */}
          <div style={anim(60)}>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              My Profile
            </h1>
            <p className="text-sm text-gray-500 pl-4 mt-1">
              Manage your account, resume, and preferences.
            </p>
          </div>

          {/* ── Hero banner ── */}
          <div
            className="rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl border border-violet-200/40"
            style={{
              background:
                "linear-gradient(135deg,#6d28d9 0%,#7c3aed 45%,#4f46e5 100%)",
              ...anim(130),
            }}
          >
            <div className="relative px-5 sm:px-8 lg:px-10 pt-7 pb-6 flex flex-col sm:flex-row items-center sm:items-end gap-5 sm:gap-8">
              {/* Avatar */}
              <div className="relative shrink-0 group">
                <div
                  className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden cursor-pointer border-4 border-white/25 shadow-2xl hover:border-white/50 hover:scale-105 transition-all duration-300"
                  onClick={() => fileInputRef.current.click()}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-white/20">
                      <span className="text-4xl sm:text-5xl font-black text-white">
                        {firstLetter}
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/35 flex items-center justify-center transition-all duration-300">
                    <svg
                      className="w-7 h-7 text-white opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 transition-all duration-300"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </div>
                </div>
                <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-400 rounded-full border-2 border-white shadow ring-2 ring-emerald-300/50 animate-pulse" />
              </div>

              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                className="hidden"
                onChange={handleImageChange}
              />

              {/* Name / email */}
              <div className="flex-1 text-center sm:text-left pb-1 min-w-0">
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight leading-tight">
                  {profile.fullName}
                </h2>
                <p className="text-purple-200 text-sm mt-1 truncate">
                  {profile.email}
                </p>

                {/* Image action buttons */}
                {selectedImage && (
                  <div className="flex gap-2 mt-3 justify-center sm:justify-start flex-wrap">
                    <button
                      onClick={handleUploadImage}
                      disabled={updating}
                      className="flex items-center gap-1.5 px-4 py-2 bg-white text-violet-700 text-xs font-bold rounded-xl hover:bg-violet-50 transition-all duration-200 shadow-lg disabled:opacity-60 hover:scale-105 active:scale-95"
                    >
                      {updating ? (
                        <Spinner size={14} />
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
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                      {updating ? "Saving…" : "Save Photo"}
                    </button>
                    <button
                      onClick={cancelImageChange}
                      disabled={updating}
                      className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-xs font-bold rounded-xl transition-all duration-200 disabled:opacity-60 border border-white/20"
                    >
                      Cancel
                    </button>
                  </div>
                )}
                {!selectedImage && (
                  <p className="text-purple-300/60 text-xs mt-2 hidden sm:block">
                    Click avatar to change photo
                  </p>
                )}
                {updateError && (
                  <p className="text-red-300 text-xs mt-2">{updateError}</p>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex flex-row sm:flex-col lg:flex-row gap-2 shrink-0 pb-1 flex-wrap justify-center">
                <button
                  onClick={() => setPasswordModalOpen(true)}
                  className="flex items-center gap-2 px-4 sm:px-5 py-2.5 bg-white/15 hover:bg-white/25 text-white text-xs font-bold rounded-xl border border-white/30 hover:border-white/50 backdrop-blur-sm transition-all duration-200 hover:scale-105 active:scale-95"
                >
                  <svg
                    className="w-3.5 h-3.5 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                    />
                  </svg>
                  <span className="whitespace-nowrap">Update Password</span>
                </button>
                <button
                  onClick={() => setResumeModalOpen(true)}
                  className="flex items-center gap-2 px-4 sm:px-5 py-2.5 bg-white text-violet-700 text-xs font-bold rounded-xl hover:bg-violet-50 transition-all duration-200 shadow-lg hover:scale-105 active:scale-95"
                >
                  <svg
                    className="w-3.5 h-3.5 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span className="whitespace-nowrap">Update Resume</span>
                </button>
              </div>
            </div>
            <div className="h-1 bg-linear-to-r from-violet-300/40 via-white/20 to-indigo-300/40" />
          </div>

          {/* ── Stat cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {stats.map((stat, i) => (
              <div
                key={stat.label}
                className={`relative bg-white rounded-2xl border ${stat.border} shadow-sm overflow-hidden group hover:shadow-lg hover:-translate-y-1 cursor-default transition-all duration-300`}
                style={anim(220 + i * 80)}
              >
                <div className={`h-1 w-full bg-linear-to-r ${stat.gradient}`} />
                <div className="p-4 sm:p-5">
                  <div
                    className={`w-10 h-10 rounded-xl bg-linear-to-br ${stat.gradient} flex items-center justify-center shadow-md mb-3 group-hover:scale-110 transition-transform duration-300`}
                  >
                    {stat.icon}
                  </div>
                  <p className="text-xl sm:text-2xl font-black text-gray-900 leading-none">
                    {stat.value}
                  </p>
                  <p className={`text-xs font-semibold mt-1.5 ${stat.text}`}>
                    {stat.label}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Bio & Details ── */}
          <div
            className="bg-white rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm overflow-hidden"
            style={anim(500)}
          >
            <div
              className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-center gap-3"
              style={{
                background: "linear-gradient(90deg,#f5f3ff 0%,#fdf4ff 100%)",
              }}
            >
              <div className="w-8 h-8 rounded-xl bg-linear-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-800">
                  Bio & Details
                </h2>
                <p className="text-xs text-gray-400">
                  Your personal information
                </p>
              </div>
            </div>
            <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {bioFields.map((item, i) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 p-3.5 sm:p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 hover:shadow-sm transition-all duration-200 cursor-default"
                  style={anim(520 + i * 60)}
                >
                  <div
                    className={`w-1.5 h-10 rounded-full ${item.accentColor} shrink-0`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      {item.label}
                    </p>
                    <p className="text-sm font-bold text-gray-800 truncate mt-0.5">
                      {item.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Previous interviews ── */}
          <div style={anim(700)}>
            <PreviousInterview />
            <PerformanceGraph />
          </div>
        </div>
      </div>

      {/* ── Password modal ── */}
      <Modal
        isOpen={isPasswordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        title="Update Password"
        size="sm"
        footer={
          <button
            onClick={handlePasswordUpdate}
            className="inline-flex items-center gap-2 px-6 h-10 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-sm font-semibold shadow transition-all duration-200 cursor-pointer"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            Save Password
          </button>
        }
      >
        <div className="space-y-4">
          <FormField
            label="Current Password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <FormField
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <FormField
            label="Confirm New Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          {passwordError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
              <svg
                className="w-4 h-4 text-red-500 shrink-0"
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
              <p className="text-red-600 text-sm font-medium">
                {passwordError}
              </p>
            </div>
          )}
        </div>
      </Modal>

      {/* ── Resume modal ── */}
      <Modal
        isOpen={isResumeModalOpen}
        onClose={() => {
          setResumeModalOpen(false);
          setSelectedResume(null);
          setResumeError("");
        }}
        title="Update Resume"
        size="sm"
        footer={
          <div className="flex gap-3">
            <button
              onClick={handleUploadResume}
              disabled={updating || !selectedResume}
              className="flex items-center gap-2 px-6 py-2.5 bg-linear-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white text-sm font-bold rounded-xl shadow-md transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {updating ? (
                <Spinner size={14} className="text-white" />
              ) : (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              )}
              {updating ? "Uploading…" : "Upload Resume"}
            </button>
            <button
              onClick={() => {
                setResumeModalOpen(false);
                setSelectedResume(null);
                setResumeError("");
              }}
              disabled={updating}
              className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold rounded-xl transition-all duration-200 disabled:opacity-50 hover:scale-105 active:scale-95"
            >
              Cancel
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Select Resume{" "}
              <span className="text-xs font-normal text-gray-400">
                (PDF only, max 5MB)
              </span>
            </label>
            <input
              type="file"
              accept="application/pdf"
              ref={resumeInputRef}
              className="hidden"
              onChange={handleResumeChange}
            />
            <div
              onClick={() => resumeInputRef.current.click()}
              className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 group ${selectedResume ? "border-emerald-300 bg-emerald-50/60" : "border-gray-200 bg-gray-50 hover:border-violet-400 hover:bg-violet-50/40"}`}
            >
              {selectedResume ? (
                <div className="space-y-2">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-linear-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-md">
                    <svg
                      className="w-7 h-7 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <p className="text-gray-800 font-bold text-sm">
                    {selectedResume.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {(selectedResume.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <span className="inline-block text-xs font-bold text-emerald-600 bg-emerald-100 px-3 py-1 rounded-full">
                    ✓ Ready to upload
                  </span>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-linear-to-br from-violet-100 to-purple-100 border border-violet-200 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <svg
                      className="w-7 h-7 text-violet-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.8}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                  </div>
                  <p className="text-gray-700 text-sm font-semibold">
                    Click to browse
                  </p>
                  <p className="text-gray-400 text-xs">
                    or drag and drop your PDF here
                  </p>
                </div>
              )}
            </div>
          </div>

          {resumeError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
              <svg
                className="w-4 h-4 text-red-500 shrink-0"
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
              <p className="text-red-600 text-sm font-medium">{resumeError}</p>
            </div>
          )}

          {profile?.resume &&
            profile?.resume_upload_status === "completed" &&
            !selectedResume && (
              <div className="flex items-center gap-3 p-3 bg-linear-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-linear-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0 shadow-sm">
                  <svg
                    className="w-4 h-4 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Current resume</p>
                  <p className="text-sm font-bold text-emerald-700">
                    Uploaded successfully ✓
                  </p>
                </div>
              </div>
            )}
        </div>
      </Modal>
    </>
  );
};

export default ProfilePage;

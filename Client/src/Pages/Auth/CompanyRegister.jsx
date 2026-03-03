import React, { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { useCompany } from "../../Hooks/useCompanyAuthHook";

const CompanyRegister = () => {
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { registerCompany, loading, error } = useCompany();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    control,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm({ mode: "onTouched" });

  const totalSteps = 3;
  const stepFields = {
    1: ["companyName", "industry", "companySize"],
    2: ["companyMail", "companyMobile", "companySite"],
    3: [
      "companyAddress",
      "companyLocation",
      "companyRegisterNumber",
      "password",
    ],
  };

  const handleNext = async () => {
    const valid = await trigger(stepFields[step]);
    if (valid) setStep((s) => Math.min(s + 1, totalSteps));
  };

  const onSubmit = async (data) => {
    try {
      await registerCompany({
        companyName: data.companyName,
        industry: data.industry,
        companySize: data.companySize,
        companyMail: data.companyMail,
        companyMobile: data.companyMobile,
        companySite: data.companySite,
        companyAddress: data.companyAddress,
        companyLocation: data.companyLocation,
        companyRegisterNumber: data.companyRegisterNumber,
        password: data.password,
      }).unwrap();
      setSubmitted(true);
      setTimeout(() => navigate("/company/dashboard"), 1500);
    } catch (err) {
      console.error("Registration failed:", err);
    }
  };

  const industries = [
    "Technology",
    "Finance",
    "Healthcare",
    "Retail",
    "Manufacturing",
    "Education",
    "Media",
    "Real Estate",
    "Consulting",
    "Other",
  ];
  const countries = [
    "United States",
    "United Kingdom",
    "Germany",
    "France",
    "Canada",
    "Australia",
    "Japan",
    "Singapore",
    "India",
    "Brazil",
  ];
  const sizes = ["1–10", "11–50", "51–200", "201–500", "500+"];
  const progress = submitted ? 100 : Math.round((step / totalSteps) * 100);

  const inputCls = (hasError) =>
    `w-full px-4 py-3 rounded-xl text-sm outline-none transition-all border font-secondary ${
      hasError
        ? "border-rose-400/60 bg-rose-50 text-rose-800 focus:ring-2 focus:ring-rose-300/40 placeholder-rose-300"
        : "border-slate-200 bg-white/70 text-slate-800 focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-300/30 placeholder-slate-400"
    }`;

  const Field = ({ label, error, children }) => (
    <div className="mb-5">
      <label className="block text-xs font-semibold text-slate-500 mb-1.5 tracking-wide uppercase">
        {label}
      </label>
      {children}
      {error && (
        <p className="mt-1.5 text-xs text-rose-500 flex items-center gap-1">
          ⚠ {error.message}
        </p>
      )}
    </div>
  );

  return (
    <>
      {/* Basic SEO */}
      <title>Register Your Company | Talk2Hire Business Portal</title>

      <meta
        name="description"
        content="Create your company account on Talk2Hire to conduct AI-powered interviews, manage candidates, and streamline your hiring process."
      />

      <meta
        name="keywords"
        content="company registration, recruiter signup, business hiring platform, AI interview software, Talk2Hire employer account"
      />

      <meta name="robots" content="index, follow" />

      <link rel="canonical" href="https://talk2hire.com/signup/company" />

      {/* Open Graph */}
      <meta property="og:title" content="Register Your Company | Talk2Hire" />
      <meta
        property="og:description"
        content="Sign up your company on Talk2Hire and start conducting AI-powered interviews today."
      />
      <meta property="og:type" content="website" />
      <meta property="og:url" content="https://talk2hire.com/signup/company" />
      <meta
        property="og:image"
        content="https://talk2hire.com/talk2hirelogo.jpeg"
      />

      {/* Twitter */}
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content="Company Registration | Talk2Hire" />
      <meta
        name="twitter:description"
        content="Create your company account and start hiring smarter with Talk2Hire."
      />
      <meta
        name="twitter:image"
        content="https://talk2hire.com/talk2hirelogo.jpeg"
      />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700&family=DM+Sans:wght@300;400;500&display=swap');

        .cr-root * { font-family: 'DM Sans', sans-serif; }
        .cr-root h1, .cr-root h2 { font-family: 'Sora', sans-serif; }

        @keyframes crFadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes crBgFade { from { opacity:0; } to { opacity:1; } }

        @keyframes floatA {
          0%,100% { transform: translate(0,0) scale(1); }
          33%      { transform: translate(20px,-16px) scale(1.05); }
          66%      { transform: translate(-12px,14px) scale(0.96); }
        }
        @keyframes floatB {
          0%,100% { transform: translate(0,0) scale(1); }
          40%      { transform: translate(-18px,18px) scale(1.04); }
          70%      { transform: translate(14px,-10px) scale(0.97); }
        }
        @keyframes floatC {
          0%,100% { transform: translate(0,0) rotate(0deg); }
          50%      { transform: translate(10px,-22px) rotate(5deg); }
        }
        @keyframes meshDrift {
          0%,100% { background-position: 0% 50%; }
          50%      { background-position: 100% 50%; }
        }
        @keyframes shimmerBar {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes pulseDot {
          0%,100% { box-shadow: 0 0 0 0 rgba(217,119,6,0.5); }
          50%      { box-shadow: 0 0 0 6px rgba(217,119,6,0); }
        }
        @keyframes popIn {
          from { transform: scale(0.5); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateX(16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes spinnerRing {
          to { transform: rotate(360deg); }
        }

        .cr-blob-a { animation: floatA 12s ease-in-out infinite; }
        .cr-blob-b { animation: floatB 14s ease-in-out infinite 2s; }
        .cr-blob-c { animation: floatC 10s ease-in-out infinite 1s; }

        .cr-bg    { animation: crBgFade .6s ease both; }
        .cr-card  { animation: crFadeUp .55s cubic-bezier(.22,1,.36,1) .05s both; }
        .cr-head  { animation: crFadeUp .55s cubic-bezier(.22,1,.36,1) .15s both; }
        .cr-body  { animation: crFadeUp .55s cubic-bezier(.22,1,.36,1) .25s both; }

        .step-enter { animation: fadeSlide .3s ease forwards; }
        .pop-in     { animation: popIn .5s cubic-bezier(0.34,1.56,0.64,1) forwards; }

        /* Mesh background */
        .cr-mesh {
          background: linear-gradient(
            135deg,
            #fdf8f0 0%, #fef9ec 20%, #f0f7ff 50%, #f5f0ff 80%, #fdf8f0 100%
          );
          background-size: 300% 300%;
          animation: meshDrift 18s ease infinite;
        }

        /* Dot grid */
        .cr-dots {
          background-image: radial-gradient(circle, rgba(217,119,6,0.12) 1px, transparent 1px);
          background-size: 26px 26px;
        }

        /* Card glass */
        .cr-card-glass {
          background: rgba(255,255,255,0.75);
          backdrop-filter: blur(28px) saturate(1.8);
          -webkit-backdrop-filter: blur(28px) saturate(1.8);
          border: 1px solid rgba(255,255,255,0.9);
          box-shadow:
            0 1px 0 0 rgba(255,255,255,0.95) inset,
            0 8px 32px -4px rgba(180,140,60,0.12),
            0 24px 64px -12px rgba(99,102,241,0.08);
          border-radius: 28px;
          overflow: hidden;
        }

        /* Shimmer accent bar */
        .cr-accent-bar {
          height: 3px;
          background: linear-gradient(90deg, #f59e0b, #d97706, #fbbf24, #d97706, #f59e0b);
          background-size: 200% auto;
          animation: shimmerBar 3s linear infinite;
        }

        /* Card header area */
        .cr-card-header {
          background: linear-gradient(135deg,
            rgba(255,251,235,0.9) 0%,
            rgba(255,255,255,0.7) 100%
          );
          border-bottom: 1px solid rgba(217,119,6,0.12);
        }

        /* Badge */
        .cr-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: linear-gradient(135deg, #fef3c7, #fde68a);
          border: 1px solid rgba(217,119,6,0.25);
          border-radius: 999px;
          padding: 4px 14px;
          font-size: 0.68rem;
          font-weight: 600;
          letter-spacing: .1em;
          color: #92400e;
          text-transform: uppercase;
          font-family: 'Sora', sans-serif;
        }
        .cr-badge-dot {
          width: 6px; height: 6px;
          background: #d97706;
          border-radius: 50%;
          animation: pulseDot 2s ease-out infinite;
        }

        /* Progress bar track */
        .cr-progress-track {
          background: rgba(203,213,225,0.4);
          height: 4px;
        }
        .cr-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #f59e0b, #d97706);
          background-size: 200% auto;
          animation: shimmerBar 2s linear infinite;
          transition: width .5s ease-in-out;
          border-radius: 999px;
        }

        /* Step dot active */
        .step-dot-active {
          background: linear-gradient(135deg, #f59e0b, #d97706);
          color: #fff;
          border: none;
          box-shadow: 0 0 16px rgba(217,119,6,0.4);
        }
        .step-dot-done {
          background: rgba(217,119,6,0.12);
          color: #d97706;
          border: 1.5px solid rgba(217,119,6,0.35);
        }
        .step-dot-pending {
          background: rgba(203,213,225,0.4);
          color: #94a3b8;
          border: 1.5px solid rgba(203,213,225,0.6);
        }

        /* Size toggle */
        .size-toggle {
          display: flex;
          border-radius: 14px;
          overflow: hidden;
          border: 1.5px solid rgba(203,213,225,0.7);
          background: rgba(248,250,252,0.8);
        }
        .size-btn {
          flex: 1;
          padding: 10px 0;
          font-size: 0.75rem;
          font-weight: 500;
          transition: all .2s;
          border-right: 1px solid rgba(203,213,225,0.5);
          color: #94a3b8;
          background: transparent;
        }
        .size-btn:last-child { border-right: none; }
        .size-btn:hover { color: #d97706; background: rgba(253,243,199,0.5); }
        .size-btn-active {
          background: linear-gradient(135deg, #fef3c7, #fde68a) !important;
          color: #92400e !important;
          font-weight: 600;
        }

        /* Buttons */
        .btn-gold {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%);
          background-size: 200% auto;
          border-radius: 14px;
          font-family: 'Sora', sans-serif;
          font-weight: 600;
          font-size: 0.875rem;
          color: #fff;
          border: none;
          transition: transform .15s, box-shadow .2s, background-position .4s;
          box-shadow: 0 4px 20px rgba(217,119,6,0.35);
          letter-spacing: .02em;
        }
        .btn-gold:hover:not(:disabled) {
          background-position: right center;
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(217,119,6,0.45);
        }
        .btn-gold:active:not(:disabled) { transform: translateY(0); }
        .btn-gold:disabled { opacity: .6; cursor: not-allowed; }

        .btn-back {
          border: 1.5px solid rgba(203,213,225,0.8);
          border-radius: 14px;
          color: #64748b;
          background: rgba(248,250,252,0.7);
          font-size: 0.875rem;
          transition: all .15s;
        }
        .btn-back:hover { border-color: #d97706; color: #d97706; background: rgba(253,243,199,0.3); }

        /* Spinner */
        .cr-spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.35);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spinnerRing .7s linear infinite;
          display: inline-block;
        }

        /* Error banner */
        .error-banner {
          background: rgba(255,241,242,0.9);
          border: 1px solid rgba(251,113,133,0.4);
          border-radius: 12px;
          padding: 10px 14px;
        }

        /* Select options */
        .cr-root select option { background: #fff; color: #1e293b; }

        /* Input focus */
        .cr-root input:focus, .cr-root select:focus { outline: none; }

        /* Divider */
        .cr-divider { border: none; border-top: 1px solid rgba(203,213,225,0.5); }

        /* Success icon */
        .success-icon {
          background: linear-gradient(135deg, #fef3c7, #fde68a);
          border: 2px solid rgba(217,119,6,0.3);
          border-radius: 50%;
          width: 80px; height: 80px;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.8rem;
          box-shadow: 0 8px 24px rgba(217,119,6,0.2);
        }

        /* Step connector line */
        .step-line-done { background: rgba(217,119,6,0.35); }
        .step-line-pending { background: rgba(203,213,225,0.5); }
      `}</style>

      <div className="cr-root cr-mesh min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden cr-bg">
        {/* Dot grid */}
        <div className="pointer-events-none absolute inset-0 cr-dots opacity-100" />

        {/* Animated blobs */}
        <div
          className="cr-blob-a pointer-events-none absolute -top-32 -right-32 w-105 h-105 rounded-full opacity-35 blur-[110px]"
          style={{
            background: "radial-gradient(circle, #fde68a 0%, #fca5a5 100%)",
          }}
        />
        <div
          className="cr-blob-b pointer-events-none absolute -bottom-24 -left-24 w-95 h-95 rounded-full opacity-30 blur-[100px]"
          style={{
            background: "radial-gradient(circle, #a5b4fc 0%, #6ee7b7 100%)",
          }}
        />
        <div
          className="cr-blob-c pointer-events-none absolute top-1/3 right-1/4 w-60 h-60 rounded-full opacity-20 blur-[80px]"
          style={{
            background: "radial-gradient(circle, #fbbf24 0%, #c4b5fd 100%)",
          }}
        />

        {/* Card */}
        <div className="relative z-10 w-full max-w-lg cr-card">
          <div className="cr-card-glass">
            {/* Top shimmer bar */}
            <div className="cr-accent-bar" />

            {/* Progress track */}
            <div className="cr-progress-track mx-8 mt-6 rounded-full overflow-hidden">
              <div
                className="cr-progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>

            {submitted ? (
              /* ── Success State ── */
              <div className="px-10 py-14 text-center">
                <div className="pop-in success-icon mx-auto mb-6">✦</div>
                <h2 className="text-2xl font-bold text-slate-800 mb-3">
                  Registration Complete
                </h2>
                <div
                  className="w-10 h-0.5 mx-auto mb-4 rounded-full"
                  style={{
                    background: "linear-gradient(90deg, #f59e0b, transparent)",
                  }}
                />
                <p className="text-sm text-slate-500 leading-7 max-w-xs mx-auto">
                  Your company profile has been submitted. Redirecting to your
                  dashboard...
                </p>
              </div>
            ) : (
              <>
                {/* ── Header ── */}
                <div className="cr-card-header px-9 pt-8 pb-7 cr-head">
                  <div className="mb-5">
                    <span className="cr-badge">
                      <span className="cr-badge-dot" />
                      Business Portal
                    </span>
                  </div>

                  <h1 className="text-[1.9rem] font-bold text-slate-800 leading-snug tracking-tight mb-1">
                    Register Your
                    <br />
                    Company
                  </h1>
                  <p className="text-xs text-slate-500 font-light">
                    Complete all three steps to get started
                  </p>

                  {/* Step indicators */}
                  <div className="flex items-center mt-7">
                    {[
                      { n: 1, label: "Profile" },
                      { n: 2, label: "Contact" },
                      { n: 3, label: "Details" },
                    ].map(({ n, label }, i) => {
                      const state =
                        n < step ? "done" : n === step ? "active" : "pending";
                      return (
                        <React.Fragment key={n}>
                          {i > 0 && (
                            <div
                              className={`flex-1 h-px mx-2 max-w-12 transition-all duration-500 ${n <= step ? "step-line-done" : "step-line-pending"}`}
                            />
                          )}
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all shrink-0 ${
                                state === "active"
                                  ? "step-dot-active"
                                  : state === "done"
                                    ? "step-dot-done"
                                    : "step-dot-pending"
                              }`}
                            >
                              {state === "done" ? "✓" : n}
                            </div>
                            <span
                              className="text-[11px] font-medium tracking-wide transition-colors"
                              style={{
                                color:
                                  state === "active"
                                    ? "#d97706"
                                    : state === "done"
                                      ? "rgba(217,119,6,0.65)"
                                      : "#94a3b8",
                              }}
                            >
                              {label}
                            </span>
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>

                {/* ── Form Body ── */}
                <form onSubmit={handleSubmit(onSubmit)}>
                  <div className="px-9 pt-8 pb-9 cr-body">
                    {/* API Error */}
                    {error && (
                      <div className="error-banner flex items-start gap-2.5 mb-5">
                        <span className="text-rose-500 mt-0.5 shrink-0">⚠</span>
                        <p className="text-xs text-rose-600 leading-relaxed">
                          {error}
                        </p>
                      </div>
                    )}

                    {/* Step 1 — Company Profile */}
                    {step === 1 && (
                      <div className="step-enter" key="s1">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-6">
                          Company Profile
                        </p>

                        <Field
                          label="Company Name *"
                          error={errors.companyName}
                        >
                          <input
                            className={inputCls(!!errors.companyName)}
                            placeholder="Acme Corporation"
                            {...register("companyName", {
                              required: "Company name is required",
                              minLength: {
                                value: 2,
                                message: "At least 2 characters",
                              },
                            })}
                          />
                        </Field>

                        <Field label="Industry *" error={errors.industry}>
                          <div className="relative">
                            <select
                              className={
                                inputCls(!!errors.industry) +
                                " cursor-pointer appearance-none pr-8"
                              }
                              {...register("industry", {
                                required: "Please select an industry",
                              })}
                            >
                              <option value="">Select industry...</option>
                              {industries.map((i) => (
                                <option key={i} value={i}>
                                  {i}
                                </option>
                              ))}
                            </select>
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
                              ▾
                            </span>
                          </div>
                        </Field>

                        <Field
                          label="Company Size *"
                          error={errors.companySize}
                        >
                          <Controller
                            name="companySize"
                            control={control}
                            rules={{ required: "Please select company size" }}
                            render={({ field }) => (
                              <div className="size-toggle">
                                {sizes.map((s) => (
                                  <button
                                    type="button"
                                    key={s}
                                    onClick={() => field.onChange(s)}
                                    className={`size-btn ${field.value === s ? "size-btn-active" : ""}`}
                                  >
                                    {s}
                                  </button>
                                ))}
                              </div>
                            )}
                          />
                        </Field>
                      </div>
                    )}

                    {/* Step 2 — Contact */}
                    {step === 2 && (
                      <div className="step-enter" key="s2">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-6">
                          Contact Information
                        </p>

                        <Field
                          label="Business Email *"
                          error={errors.companyMail}
                        >
                          <input
                            className={inputCls(!!errors.companyMail)}
                            placeholder="contact@company.com"
                            {...register("companyMail", {
                              required: "Email is required",
                              pattern: {
                                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                                message: "Enter a valid email address",
                              },
                            })}
                          />
                        </Field>

                        <div className="grid grid-cols-2 gap-4">
                          <Field
                            label="Phone Number *"
                            error={errors.companyMobile}
                          >
                            <input
                              className={inputCls(!!errors.companyMobile)}
                              placeholder="+91 9999999999"
                              {...register("companyMobile", {
                                required: "Phone is required",
                                pattern: {
                                  value: /^\d{10}$/,
                                  message: "Enter a valid 10-digit number",
                                },
                              })}
                            />
                          </Field>

                          <Field label="Website" error={errors.companySite}>
                            <input
                              className={inputCls(!!errors.companySite)}
                              placeholder="https://..."
                              {...register("companySite", {
                                pattern: {
                                  value: /^https?:\/\/.+/,
                                  message: "Must start with http(s)://",
                                },
                              })}
                            />
                          </Field>
                        </div>
                      </div>
                    )}

                    {/* Step 3 — Legal & Address */}
                    {step === 3 && (
                      <div className="step-enter" key="s3">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-6">
                          Legal & Address
                        </p>

                        <Field
                          label="Registered Address *"
                          error={errors.companyAddress}
                        >
                          <input
                            className={inputCls(!!errors.companyAddress)}
                            placeholder="123 Business Ave, Suite 100"
                            {...register("companyAddress", {
                              required: "Address is required",
                            })}
                          />
                        </Field>

                        <div className="grid grid-cols-2 gap-4">
                          <Field
                            label="Country *"
                            error={errors.companyLocation}
                          >
                            <div className="relative">
                              <select
                                className={
                                  inputCls(!!errors.companyLocation) +
                                  " cursor-pointer appearance-none pr-8"
                                }
                                {...register("companyLocation", {
                                  required: "Country is required",
                                })}
                              >
                                <option value="">Select...</option>
                                {countries.map((c) => (
                                  <option key={c} value={c}>
                                    {c}
                                  </option>
                                ))}
                              </select>
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
                                ▾
                              </span>
                            </div>
                          </Field>

                          <Field
                            label="Reg. Number *"
                            error={errors.companyRegisterNumber}
                          >
                            <input
                              className={inputCls(
                                !!errors.companyRegisterNumber,
                              )}
                              placeholder="XX-XXXXXXX"
                              {...register("companyRegisterNumber", {
                                required: "Registration number is required",
                                minLength: {
                                  value: 5,
                                  message: "Enter a valid registration number",
                                },
                              })}
                            />
                          </Field>
                        </div>

                        <Field label="Password *" error={errors.password}>
                          <div className="relative">
                            <input
                              type={showPassword ? "text" : "password"}
                              className={inputCls(!!errors.password) + " pr-16"}
                              placeholder="Min 8 chars, upper, lower, digit, symbol"
                              {...register("password", {
                                required: "Password is required",
                                minLength: {
                                  value: 8,
                                  message: "At least 8 characters",
                                },
                                validate: {
                                  hasUpper: (v) =>
                                    /[A-Z]/.test(v) || "Must include uppercase",
                                  hasLower: (v) =>
                                    /[a-z]/.test(v) || "Must include lowercase",
                                  hasDigit: (v) =>
                                    /\d/.test(v) || "Must include a digit",
                                  hasSpecial: (v) =>
                                    /[@$!%*?&]/.test(v) ||
                                    "Must include a special character",
                                },
                              })}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword((p) => !p)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400 hover:text-amber-600 transition-colors"
                            >
                              {showPassword ? "Hide" : "Show"}
                            </button>
                          </div>
                        </Field>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-3 mt-8">
                      {step > 1 && (
                        <button
                          type="button"
                          onClick={() => setStep((s) => s - 1)}
                          className="btn-back px-5 py-3"
                        >
                          ← Back
                        </button>
                      )}

                      {step < totalSteps ? (
                        <button
                          type="button"
                          onClick={handleNext}
                          className="btn-gold flex-1 py-3.5"
                        >
                          Continue →
                        </button>
                      ) : (
                        <button
                          type="submit"
                          disabled={isSubmitting || loading}
                          className="btn-gold flex-1 py-3.5 flex items-center justify-center gap-2"
                        >
                          {isSubmitting || loading ? (
                            <>
                              <span className="cr-spinner" />
                              Submitting...
                            </>
                          ) : (
                            "Submit Registration ✦"
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default CompanyRegister;

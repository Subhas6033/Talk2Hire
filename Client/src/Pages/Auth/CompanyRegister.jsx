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
      const result = await registerCompany({
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
      // Redirect to company dashboard after short delay
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

  const Field = ({ label, error, children }) => (
    <div className="mb-5">
      <label className="block text-xs font-medium text-amber-100/60 mb-1.5 tracking-wide font-secondary">
        {label}
      </label>
      {children}
      {error && (
        <p className="mt-1.5 text-xs text-rose-400 flex items-center gap-1 font-secondary">
          ⚠ {error.message}
        </p>
      )}
    </div>
  );

  const inputCls = (hasError) =>
    `w-full px-4 py-3 rounded-xl text-sm text-stone-100 outline-none transition-all placeholder-stone-600 border font-secondary ${
      hasError
        ? "bg-rose-950/30 border-rose-500/40 focus:ring-2 focus:ring-rose-500/20"
        : "bg-white/5 border-white/10 focus:border-amber-400/50 focus:bg-amber-400/5 focus:ring-2 focus:ring-amber-400/10"
    }`;

  return (
    <>
      <style>{`
        @keyframes popIn {
          from { transform: scale(0.5); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateX(14px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .step-enter { animation: fadeSlide 0.3s ease forwards; }
        .pop-in     { animation: popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        select option { background: #1c1f2e; color: #f0ece4; }
      `}</style>

      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-10 relative overflow-hidden font-secondary">
        <div
          className="absolute -top-48 -right-48 w-150 h-150 rounded-full opacity-15 pointer-events-none"
          style={{
            background: "radial-gradient(circle, #c9a96e, transparent 70%)",
            filter: "blur(100px)",
          }}
        />
        <div
          className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full opacity-10 pointer-events-none"
          style={{
            background: "radial-gradient(circle, #4a7c6f, transparent 70%)",
            filter: "blur(80px)",
          }}
        />

        <div className="relative z-10 w-full max-w-lg bg-slate-900 border border-white/[0.07] rounded-3xl overflow-hidden shadow-2xl">
          {/* Progress bar */}
          <div className="h-0.5 bg-white/5">
            <div
              className="h-full transition-all duration-500 ease-in-out"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, #c9a96e, #b08a4e)",
              }}
            />
          </div>

          {submitted ? (
            <div className="px-10 py-14 text-center">
              <div
                className="pop-in w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center text-3xl border-2"
                style={{
                  background: "rgba(201,169,110,0.1)",
                  borderColor: "rgba(201,169,110,0.3)",
                }}
              >
                ✦
              </div>
              <h2 className="text-2xl font-bold text-stone-100 mb-3 font-primary">
                Registration Complete
              </h2>
              <div
                className="w-10 h-0.5 mx-auto mb-4"
                style={{
                  background: "linear-gradient(90deg, #c9a96e, transparent)",
                }}
              />
              <p className="text-sm text-stone-400 leading-7 max-w-xs mx-auto font-secondary">
                Your company profile has been submitted. Redirecting to your
                dashboard...
              </p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div
                className="px-10 pt-9 pb-7 border-b border-white/6"
                style={{
                  background:
                    "linear-gradient(135deg, #1a1e28 0%, #151820 100%)",
                }}
              >
                <span
                  className="inline-flex items-center gap-1.5 text-[10px] font-medium tracking-widest uppercase px-3 py-1 rounded-full mb-5 border font-secondary"
                  style={{
                    color: "#c9a96e",
                    background: "rgba(201,169,110,0.1)",
                    borderColor: "rgba(201,169,110,0.2)",
                  }}
                >
                  ✦ Business Portal
                </span>
                <h1 className="text-3xl text-stone-100 leading-snug mb-1 font-primary font-bold">
                  Register Your
                  <br />
                  Company
                </h1>
                <p className="text-xs text-stone-400/60 font-light font-secondary">
                  Complete all three steps to get started
                </p>

                {/* Step Indicators */}
                <div className="flex items-center mt-7">
                  {[
                    { n: 1, label: "Profile" },
                    { n: 2, label: "Contact" },
                    { n: 3, label: "Details" },
                  ].map(({ n, label }, i) => {
                    const state =
                      n < step ? "done" : n === step ? "active" : "pending";
                    const dotStyle =
                      state === "active"
                        ? {
                            background: "#c9a96e",
                            color: "#080a0f",
                            border: "1.5px solid #c9a96e",
                            boxShadow: "0 0 16px rgba(201,169,110,0.4)",
                          }
                        : state === "done"
                          ? {
                              background: "rgba(201,169,110,0.15)",
                              color: "#c9a96e",
                              border: "1.5px solid rgba(201,169,110,0.4)",
                            }
                          : {
                              background: "rgba(255,255,255,0.04)",
                              color: "rgba(255,255,255,0.25)",
                              border: "1.5px solid rgba(255,255,255,0.1)",
                            };
                    const labelColor =
                      state === "active"
                        ? "#c9a96e"
                        : state === "done"
                          ? "rgba(201,169,110,0.6)"
                          : "rgba(255,255,255,0.2)";

                    return (
                      <React.Fragment key={n}>
                        {i > 0 && (
                          <div
                            className="flex-1 h-px mx-2 max-w-10"
                            style={{
                              background:
                                n <= step
                                  ? "rgba(201,169,110,0.3)"
                                  : "rgba(255,255,255,0.08)",
                              transition: "background 0.35s",
                            }}
                          />
                        )}
                        <div className="flex items-center gap-2">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all shrink-0 font-secondary"
                            style={dotStyle}
                          >
                            {state === "done" ? "✓" : n}
                          </div>
                          <span
                            className="text-[11px] font-medium tracking-wide transition-colors font-secondary"
                            style={{ color: labelColor }}
                          >
                            {label}
                          </span>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSubmit(onSubmit)}>
                <div className="px-10 pt-8 pb-9">
                  {/* API Error */}
                  {error && (
                    <div className="mb-5 p-3 rounded-xl bg-rose-950/30 border border-rose-500/40">
                      <p className="text-xs text-rose-400">⚠ {error}</p>
                    </div>
                  )}

                  {/* Step 1 — Company Profile */}
                  {step === 1 && (
                    <div className="step-enter" key="s1">
                      <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400/40 mb-6 font-secondary">
                        Company Profile
                      </p>

                      <Field label="Company Name *" error={errors.companyName}>
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
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-500 pointer-events-none">
                            ▾
                          </span>
                        </div>
                      </Field>

                      <Field label="Company Size *" error={errors.companySize}>
                        <Controller
                          name="companySize"
                          control={control}
                          rules={{ required: "Please select company size" }}
                          render={({ field }) => (
                            <div className="flex rounded-xl overflow-hidden border border-white/10 bg-white/5">
                              {sizes.map((s) => (
                                <button
                                  type="button"
                                  key={s}
                                  onClick={() => field.onChange(s)}
                                  className={`flex-1 py-2.5 text-xs font-medium transition-all border-r border-white/[0.07] last:border-r-0 font-secondary ${field.value === s ? "text-amber-400" : "text-stone-400 hover:text-stone-200"}`}
                                  style={
                                    field.value === s
                                      ? { background: "rgba(201,169,110,0.15)" }
                                      : {}
                                  }
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
                      <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400/40 mb-6 font-secondary">
                        Contact Information
                      </p>

                      {/* ✅ companyMail */}
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
                        {/* ✅ companyMobile */}
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

                        {/* ✅ companySite */}
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
                      <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400/40 mb-6 font-secondary">
                        Legal & Address
                      </p>

                      {/* ✅ companyAddress */}
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
                        {/* ✅ companyLocation */}
                        <Field label="Country *" error={errors.companyLocation}>
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
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-500 pointer-events-none">
                              ▾
                            </span>
                          </div>
                        </Field>

                        {/* ✅ companyRegisterNumber */}
                        <Field
                          label="Company Reg. Number *"
                          error={errors.companyRegisterNumber}
                        >
                          <input
                            className={inputCls(!!errors.companyRegisterNumber)}
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

                      {/* ✅ password — was missing entirely */}
                      <Field label="Password *" error={errors.password}>
                        <div className="relative">
                          <input
                            type={showPassword ? "text" : "password"}
                            className={inputCls(!!errors.password) + " pr-12"}
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
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 transition-colors text-xs"
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
                        className="px-5 py-3 rounded-xl text-sm border border-white/10 text-stone-400 hover:border-white/20 hover:text-stone-200 transition-all font-secondary"
                      >
                        ← Back
                      </button>
                    )}

                    {step < totalSteps ? (
                      <button
                        type="button"
                        onClick={handleNext}
                        className="flex-1 py-3.5 rounded-xl text-sm font-semibold text-slate-950 transition-all hover:-translate-y-0.5 active:translate-y-0 font-secondary"
                        style={{
                          background:
                            "linear-gradient(135deg, #c9a96e, #b08a4e)",
                          boxShadow: "0 4px 20px rgba(201,169,110,0.25)",
                        }}
                      >
                        Continue →
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={isSubmitting || loading}
                        className="flex-1 py-3.5 rounded-xl text-sm font-semibold text-slate-950 transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2 font-secondary"
                        style={{
                          background:
                            "linear-gradient(135deg, #c9a96e, #b08a4e)",
                          boxShadow: "0 4px 20px rgba(201,169,110,0.25)",
                        }}
                      >
                        {isSubmitting || loading ? (
                          <>
                            <svg
                              className="animate-spin w-4 h-4"
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
    </>
  );
};

export default CompanyRegister;

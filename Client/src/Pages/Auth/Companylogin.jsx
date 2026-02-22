import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, Building2, AlertCircle } from "lucide-react";
import { useCompany } from "../../Hooks/useCompanyAuthHook";

const Companylogin = () => {
  const [showPassword, setShowPassword] = useState(false);
  const { login, loading, error, clearError } = useCompany();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm({
    mode: "onTouched",
    defaultValues: { companyMail: "", password: "" },
  });

  const onSubmit = async (data) => {
    try {
      const result = await login({
        companyMail: data.companyMail,
        password: data.password,
      }).unwrap();

      // ✅ use actual role from response
      const role = result?.data?.role;
      if (role === "company") {
        navigate("/company/dashboard", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    } catch (err) {
      console.error("Company login failed:", err);
    }
  };

  const inputCls = (hasError) =>
    `w-full px-4 py-3 rounded-xl text-sm text-stone-100 outline-none transition-all 
     placeholder-stone-600 border font-secondary ${
       hasError
         ? "border-rose-500/40 bg-rose-950/30 focus:ring-2 focus:ring-rose-500/20"
         : "border-white/10 bg-white/5 focus:border-amber-400/50 focus:bg-amber-400/5 focus:ring-2 focus:ring-amber-400/10"
     }`;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-10 relative overflow-hidden font-secondary">
      {/* Ambient blobs */}
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

      <div className="relative z-10 w-full max-w-md">
        {/* Card */}
        <div className="bg-slate-900 border border-white/[0.07] rounded-3xl overflow-hidden shadow-2xl">
          {/* Top accent bar */}
          <div
            className="h-0.5"
            style={{ background: "linear-gradient(90deg, #c9a96e, #b08a4e)" }}
          />

          {/* Header */}
          <div
            className="px-10 pt-9 pb-7 border-b border-white/6"
            style={{
              background: "linear-gradient(135deg, #1a1e28 0%, #151820 100%)",
            }}
          >
            <span
              className="inline-flex items-center gap-1.5 text-[10px] font-medium tracking-widest uppercase px-3 py-1 rounded-full mb-6 border"
              style={{
                color: "#c9a96e",
                background: "rgba(201,169,110,0.1)",
                borderColor: "rgba(201,169,110,0.2)",
              }}
            >
              ✦ Business Portal
            </span>

            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: "rgba(201,169,110,0.1)",
                  border: "1px solid rgba(201,169,110,0.25)",
                }}
              >
                <Building2 size={20} style={{ color: "#c9a96e" }} />
              </div>
              <div>
                <h1 className="text-2xl text-stone-100 font-primary font-bold leading-tight">
                  Welcome Back
                </h1>
                <p className="text-xs text-stone-400/60 font-light">
                  Sign in to your company dashboard
                </p>
              </div>
            </div>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="px-10 pt-8 pb-9 space-y-5"
          >
            {/* API Error banner */}
            {error && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/30 animate-in fade-in duration-200">
                <AlertCircle
                  size={15}
                  className="text-rose-400 mt-0.5 shrink-0"
                />
                <p className="text-xs text-rose-400 leading-relaxed">{error}</p>
              </div>
            )}

            {/* Company Email */}
            <div>
              <label className="block text-xs font-medium text-amber-100/60 mb-1.5 tracking-wide">
                Business Email *
              </label>
              <input
                className={inputCls(!!errors.companyMail)}
                placeholder="contact@company.com"
                onChange={() => error && clearError()}
                {...register("companyMail", {
                  required: "Email is required",
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: "Enter a valid email address",
                  },
                })}
              />
              {errors.companyMail && (
                <p className="mt-1.5 text-xs text-rose-400 flex items-center gap-1">
                  ⚠ {errors.companyMail.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-amber-100/60 tracking-wide">
                  Password *
                </label>
                <Link
                  to="/verify-password"
                  className="text-[11px] transition-colors hover:underline"
                  style={{ color: "#c9a96e" }}
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className={inputCls(!!errors.password) + " pr-12"}
                  placeholder="••••••••"
                  onChange={() => error && clearError()}
                  {...register("password", {
                    required: "Password is required",
                    minLength: { value: 8, message: "At least 8 characters" },
                  })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 transition-colors p-1"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-xs text-rose-400 flex items-center gap-1">
                  ⚠ {errors.password.message}
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={!isValid || loading}
              className="w-full py-3.5 rounded-xl text-sm font-semibold text-slate-950 transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2 mt-2"
              style={{
                background: "linear-gradient(135deg, #c9a96e, #b08a4e)",
                boxShadow: "0 4px 20px rgba(201,169,110,0.25)",
              }}
            >
              {loading ? (
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
                  Signing in...
                </>
              ) : (
                "Sign In ✦"
              )}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-white/6" />
              <span className="text-[10px] text-stone-600 tracking-widest uppercase">
                or
              </span>
              <div className="flex-1 h-px bg-white/6" />
            </div>

            {/* Footer links */}
            <div className="space-y-2.5 text-center">
              <p className="text-xs text-stone-500">
                Don't have a company account?{" "}
                <Link
                  to="/signup/company"
                  className="font-medium transition-colors hover:underline"
                  style={{ color: "#c9a96e" }}
                >
                  Register here
                </Link>
              </p>
              <p className="text-xs text-stone-500">
                Not a company?{" "}
                <Link
                  to="/login"
                  className="font-medium transition-colors hover:underline"
                  style={{ color: "#c9a96e" }}
                >
                  User login
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Companylogin;

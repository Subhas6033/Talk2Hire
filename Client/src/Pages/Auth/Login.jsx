import React, { useEffect, useState } from "react";
import { Modal } from "../../Components/index";
import { FormField } from "../../Components/Common/Input";
import { Eye, EyeOff } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useAuth } from "../../Hooks/useAuthHook";
import { useSelector } from "react-redux";
import { motion } from "motion/react";

const Loader = () => (
  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-600" />
);

const DotGrid = () => (
  <div
    className="pointer-events-none absolute inset-0 opacity-[0.06]"
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

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 22 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.52, ease: [0.22, 1, 0.36, 1], delay },
});

const PrimaryBtn = ({ children, className = "", disabled, ...props }) => (
  <button
    disabled={disabled}
    className={[
      "inline-flex items-center justify-center gap-2 rounded-xl",
      "bg-linear-to-br from-indigo-500 to-violet-600 text-white",
      "text-sm font-semibold tracking-wide",
      "shadow-[0_4px_15px_rgba(99,102,241,0.35)]",
      "transition-all duration-200",
      "hover:-translate-y-px hover:shadow-[0_8px_25px_rgba(99,102,241,0.45)]",
      "active:translate-y-0",
      "focus:outline-none focus:ring-2 focus:ring-indigo-400/50 focus:ring-offset-1",
      "disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0",
      "disabled:shadow-[0_4px_15px_rgba(99,102,241,0.35)]",
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
      "text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50",
      "transition-all duration-150",
      "focus:outline-none focus:ring-2 focus:ring-indigo-300/50",
      "disabled:opacity-50 disabled:cursor-not-allowed",
      className,
    ].join(" ")}
    {...props}
  >
    {children}
  </button>
);

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const {
    login,
    loading,
    error,
    forgotPassword,
    forgotPasswordLoading,
    forgotPasswordError,
    forgotPasswordSuccess,
    forgotPasswordEmail,
    clearForgotPassword,
    clearPendingAutofillEmail,
  } = useAuth();

  const pendingEmail = useSelector((state) => state.auth.pendingAutofillEmail);
  const navigate = useNavigate();

  useEffect(() => {
    if (forgotPasswordSuccess && forgotPasswordEmail) {
      setIsModalOpen(false);
      navigate("/forgot-password");
    }
  }, [forgotPasswordSuccess, forgotPasswordEmail, navigate]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm({
    mode: "onTouched",
    defaultValues: {
      email: pendingEmail || "",
      password: "",
    },
  });

  useEffect(() => {
    if (!pendingEmail) return;
    reset({ email: pendingEmail, password: "" });
  }, [pendingEmail]);

  const onSubmit = async (data) => {
    try {
      const result = await login({
        email: data.email,
        password: data.password,
      }).unwrap();
      clearPendingAutofillEmail();
      const role = result?.data?.role;
      navigate(role === "company" ? "/company/dashboard" : "/", {
        replace: true,
      });
    } catch (err) {
      console.error("Login failed:", err);
    }
  };

  const {
    register: registerReset,
    handleSubmit: handleResetSubmit,
    formState: { errors: resetErrors, isValid: isResetValid },
  } = useForm({ mode: "onTouched", defaultValues: { resetEmail: "" } });

  const handleCloseModal = () => {
    if (forgotPasswordLoading) return;
    setIsModalOpen(false);
    clearForgotPassword();
  };

  const onResetSubmit = async (data) => {
    try {
      await forgotPassword(data.resetEmail).unwrap();
    } catch (err) {
      console.error("Error sending reset mail:", err);
    }
  };

  return (
    <>
      <title>User Login | Talk2Hire Careers Portal</title>
      <meta
        name="description"
        content="Sign in to your Talk2Hire account to continue AI-powered interview practice."
      />
      <meta name="robots" content="noindex, nofollow" />
      <link rel="canonical" href="https://talk2hire.com/login" />
      <meta property="og:title" content="User Login | Talk2Hire" />
      <meta property="og:type" content="website" />
      <meta property="og:url" content="https://talk2hire.com/login" />
      <meta name="twitter:card" content="summary" />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=DM+Sans:wght@300;400;500&display=swap');
        @keyframes floatA {
          0%,100% { transform: translateY(0) scale(1); }
          50%      { transform: translateY(-18px) scale(1.04); }
        }
        @keyframes floatB {
          0%,100% { transform: translateY(0) scale(1); }
          50%      { transform: translateY(14px) scale(0.97); }
        }
        @keyframes pulseRing {
          0%   { box-shadow: 0 0 0 0   rgba(99,102,241,0.3); }
          70%  { box-shadow: 0 0 0 8px rgba(99,102,241,0);   }
          100% { box-shadow: 0 0 0 0   rgba(99,102,241,0);   }
        }
        .blob-float-a { animation: floatA 9s ease-in-out infinite; }
        .blob-float-b { animation: floatB 11s ease-in-out 1.5s infinite; }
        .blob-float-c { animation: floatA 13s ease-in-out 3s infinite; }
        .badge-pulse   { animation: pulseRing 2s ease-out infinite; }
        .sora          { font-family: 'Sora', sans-serif; }
        .dm-sans       { font-family: 'DM Sans', sans-serif; }
      `}</style>

      <section className="dm-sans relative min-h-screen overflow-hidden flex items-center justify-center px-4 py-16 bg-linear-to-br from-slate-50 via-blue-50/40 to-indigo-50/60">
        <DotGrid />
        <Blob
          className="blob-float-a -top-28 -left-28 h-96 w-96 opacity-40"
          gradient="radial-gradient(circle,#f9a8d4 0%,#fde68a 100%)"
        />
        <Blob
          className="blob-float-b -bottom-28 -right-28 h-96 w-96 opacity-35"
          gradient="radial-gradient(circle,#a5b4fc 0%,#6ee7b7 100%)"
        />
        <Blob
          className="blob-float-c top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 opacity-20"
          gradient="radial-gradient(circle,#bae6fd 0%,#e0e7ff 100%)"
        />

        <motion.div className="relative w-full max-w-md" {...fadeUp(0)}>
          <div className="rounded-3xl p-8 sm:p-10 bg-white/75 backdrop-blur-2xl border border-white/80 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.04),0_20px_60px_-10px_rgba(99,102,241,0.10),inset_0_1px_0_rgba(255,255,255,0.9)]">
            <motion.div className="text-center mb-8" {...fadeUp(0.08)}>
              <div className="flex justify-center mb-5">
                <span className="sora inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-linear-to-r from-indigo-100 to-violet-100 border border-indigo-200/60 text-[0.68rem] font-semibold tracking-widest uppercase text-indigo-600">
                  <span className="badge-pulse w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                  Talk2Hire
                </span>
              </div>
              <h1 className="sora text-[1.75rem] font-bold text-slate-800 tracking-tight leading-tight">
                Welcome back
              </h1>
              <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                Sign in to continue your interview preparation
              </p>
            </motion.div>

            <motion.div {...fadeUp(0.16)}>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  label="Email Address"
                  type="email"
                  placeholder="you@example.com"
                  error={errors.email?.message}
                  {...register("email", {
                    required: "Email is required",
                    pattern: {
                      value: /^\S+@\S+\.\S+$/,
                      message: "Enter a valid email address",
                    },
                  })}
                />

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-600 tracking-wide">
                    Password
                  </label>
                  <div className="relative">
                    <FormField
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="pr-10"
                      error={errors.password?.message}
                      {...register("password", {
                        required: "Password is required",
                        minLength: {
                          value: 6,
                          message: "Password must be at least 6 characters",
                        },
                      })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-500 transition-colors duration-150 focus:outline-none"
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="text-center text-xs font-medium text-red-500">
                    {error}
                  </p>
                )}

                <PrimaryBtn
                  type="submit"
                  disabled={!isValid || loading}
                  className="w-full py-3 text-sm"
                >
                  {loading ? (
                    <>
                      <Loader />
                      Signing in…
                    </>
                  ) : (
                    "Sign In"
                  )}
                </PrimaryBtn>
              </form>

              <div className="flex justify-center mt-4">
                <GhostBtn onClick={() => setIsModalOpen(true)}>
                  Forgot password?
                </GhostBtn>
              </div>
            </motion.div>

            <div className="my-6 border-t border-slate-200/70" />

            <motion.div className="space-y-2 text-center" {...fadeUp(0.24)}>
              {[
                {
                  text: "Don't have an account?",
                  label: "Create one",
                  to: "/signup",
                },
                {
                  text: "Login as Company?",
                  label: "Sign in",
                  to: "/login/company",
                },
                {
                  text: "Register as Company?",
                  label: "Create one",
                  to: "/signup/company",
                },
              ].map(({ text, label, to }) => (
                <p key={to} className="text-sm text-slate-500">
                  {text}{" "}
                  <Link
                    to={to}
                    className="font-medium text-indigo-600 hover:text-indigo-700 hover:underline transition-colors duration-150"
                  >
                    {label}
                  </Link>
                </p>
              ))}
            </motion.div>
          </div>
        </motion.div>

        <Modal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          title="Reset your password"
          footer={
            <div className="flex flex-wrap items-center justify-end gap-3">
              {forgotPasswordError && (
                <p className="mr-auto text-xs font-medium text-red-500">
                  {forgotPasswordError}
                </p>
              )}
              <GhostBtn
                onClick={handleCloseModal}
                disabled={forgotPasswordLoading}
              >
                Cancel
              </GhostBtn>
              <PrimaryBtn
                type="submit"
                form="reset-password-form"
                disabled={!isResetValid || forgotPasswordLoading}
                className="px-5 py-2 text-sm"
              >
                {forgotPasswordLoading ? (
                  <>
                    <Loader />
                    Sending…
                  </>
                ) : (
                  "Send reset link"
                )}
              </PrimaryBtn>
            </div>
          }
        >
          <form
            id="reset-password-form"
            onSubmit={handleResetSubmit(onResetSubmit)}
            className="space-y-4"
          >
            <p className="text-sm text-slate-500 leading-relaxed">
              Enter your email address and we'll send you a password reset link.
            </p>
            <FormField
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              disabled={forgotPasswordLoading}
              error={resetErrors.resetEmail?.message}
              {...registerReset("resetEmail", {
                required: "Email is required",
                pattern: {
                  value: /^\S+@\S+\.\S+$/,
                  message: "Enter a valid email address",
                },
              })}
            />
          </form>
        </Modal>
      </section>
    </>
  );
};

export default Login;

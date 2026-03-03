import React, { useState } from "react";
import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
} from "../../Components/Common/Card";
import { Button, Modal } from "../../Components/index";
import { FormField } from "../../Components/Common/Input";
import { Eye, EyeOff } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useAuth } from "../../Hooks/useAuthHook";
import { usePassword } from "../../Hooks/usePassHook";

const Loader = () => (
  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-600" />
);

/* ─── Floating decorative blobs ─── */
const Blobs = () => (
  <>
    {/* Top-left warm peach blob */}
    <div
      className="pointer-events-none absolute -top-32 -left-32 h-105 w-105 rounded-full opacity-40 blur-[120px]"
      style={{
        background: "radial-gradient(circle, #f9a8d4 0%, #fde68a 100%)",
      }}
    />
    {/* Bottom-right cool indigo blob */}
    <div
      className="pointer-events-none absolute -bottom-32 -right-32 h-105 w-105 rounded-full opacity-35 blur-[120px]"
      style={{
        background: "radial-gradient(circle, #a5b4fc 0%, #6ee7b7 100%)",
      }}
    />
    {/* Centre subtle sky blob */}
    <div
      className="pointer-events-none absolute top-1/2 left-1/2 h-75 w-75 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-[100px]"
      style={{
        background: "radial-gradient(circle, #bae6fd 0%, #e0e7ff 100%)",
      }}
    />
  </>
);

/* ─── Subtle dot-grid background ─── */
const DotGrid = () => (
  <div
    className="pointer-events-none absolute inset-0 opacity-[0.07]"
    style={{
      backgroundImage: "radial-gradient(circle, #6366f1 1px, transparent 1px)",
      backgroundSize: "28px 28px",
    }}
  />
);

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMailSending, setIsMailSending] = useState(false);
  const { login, loading, error } = useAuth();
  const {
    sendForgotPasswordEmail,
    loading: forgotLoading,
    error: forgotError,
  } = usePassword();

  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm({
    mode: "onTouched",
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data) => {
    try {
      const result = await login({
        email: data.email,
        password: data.password,
      }).unwrap();
      const userRole = result?.data?.role;
      if (userRole === "company") {
        navigate("/company/dashboard", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    } catch (err) {
      console.error("Login failed:", err);
    }
  };

  const {
    register: registerReset,
    handleSubmit: handleResetSubmit,
    formState: { errors: resetErrors, isValid: isResetValid },
  } = useForm({
    mode: "onTouched",
    defaultValues: {
      resetEmail: "",
    },
  });

  const onResetSubmit = async (data) => {
    try {
      setIsMailSending(true);
      await sendForgotPasswordEmail(data.resetEmail).unwrap();
      setIsModalOpen(false);
      navigate("/verify-password");
    } catch (error) {
      console.error("Error sending reset mail:", error);
    } finally {
      setIsMailSending(false);
    }
  };

  return (
    <>
      {/* Basic SEO */}
      <title>User Login | Talk2Hire Careers Portal</title>

      <meta
        name="description"
        content="Sign in to your Talk2Hire account to continue AI-powered interview practice and track your progress."
      />

      <meta name="robots" content="noindex, nofollow" />

      <link rel="canonical" href="https://talk2hire.com/login" />

      {/* Open Graph */}
      <meta property="og:title" content="User Login | Talk2Hire" />
      <meta
        property="og:description"
        content="Access your Talk2Hire dashboard and continue preparing with AI mock interviews."
      />
      <meta property="og:type" content="website" />
      <meta property="og:url" content="https://talk2hire.com/login" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content="User Login | Talk2Hire" />
      <meta
        name="twitter:description"
        content="Sign in to Talk2Hire and continue your interview preparation journey."
      />

      {/* ── Keyframe animations injected once ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500&display=swap');

        .login-root * { font-family: 'DM Sans', sans-serif; }
        .login-root h1 { font-family: 'Sora', sans-serif; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes floatA {
          0%, 100% { transform: translateY(0px) scale(1); }
          50%       { transform: translateY(-18px) scale(1.04); }
        }
        @keyframes floatB {
          0%, 100% { transform: translateY(0px) scale(1); }
          50%       { transform: translateY(14px) scale(0.97); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes pulse-ring {
          0%   { box-shadow: 0 0 0 0 rgba(99,102,241,0.25); }
          70%  { box-shadow: 0 0 0 10px rgba(99,102,241,0); }
          100% { box-shadow: 0 0 0 0 rgba(99,102,241,0); }
        }

        .blob-a { animation: floatA 9s ease-in-out infinite; }
        .blob-b { animation: floatB 11s ease-in-out infinite 1.5s; }
        .blob-c { animation: floatA 13s ease-in-out infinite 3s; }

        .card-enter  { animation: fadeUp .55s cubic-bezier(.22,1,.36,1) both; }
        .header-enter{ animation: fadeUp .55s cubic-bezier(.22,1,.36,1) .12s both; }
        .form-enter  { animation: fadeUp .55s cubic-bezier(.22,1,.36,1) .22s both; }
        .footer-enter{ animation: fadeUp .55s cubic-bezier(.22,1,.36,1) .32s both; }
        .bg-enter    { animation: fadeIn .7s ease both; }

        /* Card glass effect */
        .login-card {
          background: rgba(255,255,255,0.72);
          backdrop-filter: blur(24px) saturate(1.6);
          -webkit-backdrop-filter: blur(24px) saturate(1.6);
          border: 1px solid rgba(255,255,255,0.85);
          box-shadow:
            0 4px 6px -1px rgba(0,0,0,0.04),
            0 20px 60px -10px rgba(99,102,241,0.10),
            0 1px 0 0 rgba(255,255,255,0.9) inset;
          border-radius: 24px;
        }

        /* Input fields */
        .login-root input[type="email"],
        .login-root input[type="password"],
        .login-root input[type="text"] {
          background: rgba(248,250,252,0.9);
          border: 1.5px solid rgba(203,213,225,0.8);
          border-radius: 12px;
          color: #1e293b;
          transition: border-color .2s, box-shadow .2s;
        }
        .login-root input:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.12);
          outline: none;
        }
        .login-root input::placeholder { color: #94a3b8; }

        /* Labels */
        .login-root label { color: #475569; font-weight: 500; font-size: 0.85rem; }

        /* Primary button */
        .btn-primary {
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          background-size: 200% auto;
          border-radius: 12px;
          font-family: 'Sora', sans-serif;
          font-weight: 600;
          letter-spacing: .02em;
          color: #fff;
          border: none;
          transition: transform .15s, box-shadow .15s, background-position .4s;
          box-shadow: 0 4px 15px rgba(99,102,241,0.35);
        }
        .btn-primary:hover:not(:disabled) {
          background-position: right center;
          transform: translateY(-1px);
          box-shadow: 0 8px 25px rgba(99,102,241,0.45);
        }
        .btn-primary:active:not(:disabled) { transform: translateY(0); }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

        /* Ghost button */
        .btn-ghost {
          background: transparent;
          color: #6366f1;
          border-radius: 10px;
          font-weight: 500;
          transition: background .15s, color .15s;
        }
        .btn-ghost:hover { background: rgba(99,102,241,0.08); }

        /* Divider */
        .divider {
          border: none;
          border-top: 1px solid rgba(203,213,225,0.6);
          margin: 0;
        }

        /* Brand badge */
        .brand-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: linear-gradient(135deg,#e0e7ff,#ede9fe);
          border: 1px solid rgba(129,140,248,0.35);
          border-radius: 999px;
          padding: 4px 14px;
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: .06em;
          color: #4f46e5;
          text-transform: uppercase;
          font-family: 'Sora', sans-serif;
        }
        .brand-dot {
          width: 6px; height: 6px;
          background: #6366f1;
          border-radius: 50%;
          animation: pulse-ring 2s ease-out infinite;
        }

        /* Error text */
        .error-text { color: #ef4444; font-size: 0.8rem; }

        /* Link style */
        .link-accent { color: #6366f1; font-weight: 500; transition: color .15s; }
        .link-accent:hover { color: #4f46e5; text-decoration: underline; }

        /* Muted text */
        .text-muted { color: #64748b; font-size: 0.875rem; }

        /* Eye toggle button */
        .eye-btn { color: #94a3b8; transition: color .15s; }
        .eye-btn:hover { color: #6366f1; }

        /* Modal override – white glass */
        .modal-glass {
          background: rgba(255,255,255,0.88) !important;
          backdrop-filter: blur(20px) !important;
          border: 1px solid rgba(255,255,255,0.9) !important;
          border-radius: 20px !important;
          color: #1e293b !important;
        }
      `}</style>

      <section className="login-root min-h-screen flex items-center justify-center px-4 py-16 relative overflow-hidden bg-linear-to-br from-slate-50 via-blue-50/40 to-indigo-50/60 bg-enter">
        {/* Dot grid texture */}
        <DotGrid />

        {/* Animated colour blobs */}
        <div
          className="blob-a absolute -top-28 -left-28 h-95 w-95 rounded-full opacity-40 blur-[110px]"
          style={{
            background: "radial-gradient(circle, #f9a8d4 0%, #fde68a 100%)",
          }}
        />
        <div
          className="blob-b absolute -bottom-28 -right-28 h-95 w-95 rounded-full opacity-35 blur-[110px]"
          style={{
            background: "radial-gradient(circle, #a5b4fc 0%, #6ee7b7 100%)",
          }}
        />
        <div
          className="blob-c absolute top-1/2 left-1/2 h-65 w-65 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-[90px]"
          style={{
            background: "radial-gradient(circle, #bae6fd 0%, #e0e7ff 100%)",
          }}
        />

        {/* Card */}
        <div className="relative w-full max-w-105 card-enter">
          <div className="login-card p-8 sm:p-10">
            {/* Header */}
            <div className="text-center mb-8 header-enter">
              <div className="flex justify-center mb-5">
                <span className="brand-badge">
                  <span className="brand-dot" />
                  Talk2Hire
                </span>
              </div>
              <h1 className="text-[1.8rem] font-bold text-slate-800 tracking-tight leading-tight">
                Welcome back
              </h1>
              <p className="mt-2 text-muted">
                Sign in to continue your interview preparation
              </p>
            </div>

            {/* Form */}
            <div className="form-enter">
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

                <div className="space-y-1">
                  <label
                    className="text-sm font-medium"
                    style={{ color: "#475569" }}
                  >
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
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="eye-btn absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {error && <p className="error-text text-center">{error}</p>}

                <button
                  type="submit"
                  className="btn-primary w-full flex items-center justify-center gap-2 py-3 px-6 text-sm"
                  disabled={!isValid || loading}
                >
                  {loading ? (
                    <>
                      <Loader />
                      Signing in...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </button>
              </form>

              {/* Forgot password */}
              <div className="flex justify-center mt-4">
                <button
                  className="btn-ghost text-sm px-3 py-1.5"
                  onClick={() => setIsModalOpen(true)}
                >
                  Forgot password?
                </button>
              </div>
            </div>

            {/* Divider */}
            <hr className="divider my-6" />

            {/* Footer links */}
            <div className="footer-enter space-y-2 text-center">
              <p className="text-muted">
                Don't have an account?{" "}
                <Link to="/signup" className="link-accent">
                  Create one
                </Link>
              </p>
              <p className="text-muted">
                Login as Company?{" "}
                <Link to="/login/company" className="link-accent">
                  Sign in
                </Link>
              </p>
              <p className="text-muted">
                Register as Company?{" "}
                <Link to="/signup/company" className="link-accent">
                  Create one
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* Forgot password modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => !isMailSending && setIsModalOpen(false)}
          title="Reset your password"
          footer={
            <div className="flex flex-wrap justify-end gap-3 items-center">
              {forgotError && (
                <p className="error-text mr-auto">{forgotError}</p>
              )}
              <button
                className="btn-ghost text-sm px-4 py-2"
                onClick={() => setIsModalOpen(false)}
                disabled={isMailSending}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="reset-password-form"
                className="btn-primary flex items-center gap-2 text-sm px-5 py-2"
                disabled={!isResetValid || isMailSending}
              >
                {isMailSending ? (
                  <>
                    <Loader />
                    Sending...
                  </>
                ) : (
                  "Send reset link"
                )}
              </button>
            </div>
          }
        >
          <form
            id="reset-password-form"
            onSubmit={handleResetSubmit(onResetSubmit)}
            className="space-y-4"
          >
            <p className="text-muted">
              Enter your email address and we'll send you a password reset link.
            </p>
            <FormField
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              disabled={isMailSending}
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

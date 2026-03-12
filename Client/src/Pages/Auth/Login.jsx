import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { useAuth } from "../../Hooks/useAuthHook";
import { useMicrosoftUserAuth } from "../../Hooks/useMicrosoftAuth";
import { useSelector } from "react-redux";
import { Modal } from "../../Components/index";
import { FormField } from "../../Components/Common/Input";
import { GoogleLogin } from "@react-oauth/google";

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

const MicrosoftLogo = ({ size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 21 21"
    xmlns="http://www.w3.org/2000/svg"
  >
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

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const {
    login,
    loading,
    error,
    googleLoading,
    googleError,
    loginWithGoogle,
    forgotPassword,
    forgotPasswordLoading,
    forgotPasswordError,
    forgotPasswordSuccess,
    forgotPasswordEmail,
    clearForgotPassword,
    clearPendingAutofillEmail,
    clearGoogleError,
  } = useAuth();

  const { loginWithMicrosoft, redirecting: msRedirecting } =
    useMicrosoftUserAuth();
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
    defaultValues: { email: pendingEmail || "", password: "" },
  });

  useEffect(() => {
    if (!pendingEmail) return;
    reset({ email: pendingEmail, password: "" });
  }, [pendingEmail]);

  const onSubmit = async (data) => {
    try {
      sessionStorage.removeItem("showOnboarding");
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

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      sessionStorage.removeItem("showOnboarding");
      const result = await loginWithGoogle(credentialResponse).unwrap();
      const role = result?.data?.role;
      if (result?.data?.isNewUser) {
        navigate("/signup", { replace: true });
      } else {
        navigate(role === "company" ? "/company/dashboard" : "/", {
          replace: true,
        });
      }
    } catch (err) {
      console.error("Google login failed:", err);
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

  const isBusy = loading || googleLoading || msRedirecting;

  return (
    <>
      <title>User Login | Talk2Hire Careers Portal</title>
      <meta
        name="description"
        content="Sign in to your Talk2Hire account to continue AI-powered interview practice."
      />
      <meta name="robots" content="noindex, nofollow" />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=DM+Sans:wght@300;400;500&display=swap');
        @keyframes floatA { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-18px) scale(1.04)} }
        @keyframes floatB { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(14px) scale(0.97)} }
        @keyframes pulseRing {
          0%  { box-shadow:0 0 0 0   rgba(99,102,241,0.3); }
          70% { box-shadow:0 0 0 8px rgba(99,102,241,0);   }
          100%{ box-shadow:0 0 0 0   rgba(99,102,241,0);   }
        }
        .blob-float-a { animation: floatA 9s ease-in-out infinite; }
        .blob-float-b { animation: floatB 11s ease-in-out 1.5s infinite; }
        .blob-float-c { animation: floatA 13s ease-in-out 3s infinite; }
        .badge-pulse   { animation: pulseRing 2s ease-out infinite; }
        .sora { font-family:'Sora',sans-serif; }
        .dm-sans { font-family:'DM Sans',sans-serif; }
        @keyframes spinnerRing { to { transform:rotate(360deg); } }
        .ms-spinner {
          width:16px; height:16px;
          border:2px solid rgba(37,99,235,.25);
          border-top-color:#2563eb;
          border-radius:50%;
          animation:spinnerRing .7s linear infinite;
          display:inline-block;
        }
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
              <div className="flex gap-3 mb-5">
                <button
                  onClick={loginWithMicrosoft}
                  disabled={isBusy}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-white border-[1.5px] border-slate-200 text-slate-700 text-sm font-semibold hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-700 transition-all duration-200 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {msRedirecting ? (
                    <>
                      <span className="ms-spinner" /> <span>Redirecting…</span>
                    </>
                  ) : (
                    <>
                      <MicrosoftLogo /> <span>Microsoft</span>
                    </>
                  )}
                </button>

                <div className="flex-1 relative">
                  <button
                    disabled={isBusy}
                    className="w-full flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-white border-[1.5px] border-slate-200 text-slate-700 text-sm font-semibold hover:border-red-300 hover:bg-red-50/50 hover:text-red-700 transition-all duration-200 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed pointer-events-none"
                  >
                    {googleLoading ? (
                      <>
                        <Loader /> <span>Signing in…</span>
                      </>
                    ) : (
                      <>
                        <GoogleLogo /> <span>Google</span>
                      </>
                    )}
                  </button>
                  <div
                    className="absolute inset-0 opacity-0 overflow-hidden"
                    style={{ borderRadius: "0.75rem" }}
                  >
                    <GoogleLogin
                      onSuccess={handleGoogleSuccess}
                      onError={() => clearGoogleError()}
                      useOneTap={false}
                      width="500"
                      size="large"
                    />
                  </div>
                </div>
              </div>

              {googleError && (
                <p className="text-center text-xs font-medium text-red-500 mb-3 -mt-3">
                  {googleError}
                </p>
              )}

              <div className="flex items-center gap-3 mb-5">
                <hr className="flex-1 border-slate-200" />
                <span className="text-[10px] text-slate-400 tracking-widest uppercase font-medium">
                  or sign in with email
                </span>
                <hr className="flex-1 border-slate-200" />
              </div>

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
                      <Loader /> Signing in…
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
                    <Loader /> Sending…
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

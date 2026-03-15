import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, Building2, AlertCircle } from "lucide-react";
import { useCompany } from "../../Hooks/useCompanyAuthHook";
import { useMicrosoftAuth } from "../../Hooks/useMicrosoftCompanyAuthHook";

// The thunk now always passes a plain human-readable string to rejectWithValue.
// unwrap() throws that string directly as the rejection value.
// We just need to extract it safely from whatever shape RTK gives us.
const getErrorMessage = (err) => {
  if (!err) return "Something went wrong. Please try again.";
  if (typeof err === "string") return err;
  if (typeof err?.payload === "string") return err.payload;
  if (typeof err?.message === "string") return err.message;
  return "Something went wrong. Please try again.";
};

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

const Companylogin = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [displayError, setDisplayError] = useState(null);
  const { login, loading, error, clearError } = useCompany();
  const { loginWithMicrosoft, redirecting: msRedirecting } = useMicrosoftAuth();
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
    setDisplayError(null);
    try {
      const result = await login({
        companyMail: data.companyMail,
        password: data.password,
      }).unwrap();

      const role = result?.data?.role;
      if (role === "company") {
        navigate("/company", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    } catch (err) {
      setDisplayError(getErrorMessage(err));
      console.error("Company login failed:", err);
    }
  };

  const handleInputChange = () => {
    if (error) clearError();
    if (displayError) setDisplayError(null);
  };

  const inputCls = (hasError) =>
    `w-full px-4 py-3 rounded-xl text-sm outline-none transition-all font-secondary border ${
      hasError
        ? "border-rose-400/60 bg-rose-50 text-rose-800 focus:ring-2 focus:ring-rose-300/40 placeholder-rose-300"
        : "border-slate-200 bg-white/70 text-slate-800 focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-300/30 placeholder-slate-400"
    }`;

  // displayError from catch takes priority; fallback to Redux error state
  const shownError =
    displayError ??
    (error ? getErrorMessage(typeof error === "string" ? error : error) : null);

  return (
    <>
      <title>Company Login | Talk2Hire Business Portal</title>
      <meta
        name="description"
        content="Securely sign in to your Talk2Hire Business Portal to manage interviews, evaluate candidates, and streamline your hiring process."
      />
      <meta name="robots" content="noindex, nofollow" />
      <link rel="canonical" href="https://talk2hire.com/login/company" />
      <meta property="og:title" content="Company Login | Talk2Hire" />
      <meta
        property="og:description"
        content="Access your Talk2Hire company dashboard to manage hiring and interviews."
      />
      <meta property="og:type" content="website" />
      <meta property="og:url" content="https://talk2hire.com/login/company" />
      <meta
        property="og:image"
        content="https://talk2hire.com/talk2hirelogo.png"
      />
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content="Company Login | Talk2Hire" />
      <meta
        name="twitter:description"
        content="Sign in to your Talk2Hire Business Portal."
      />
      <meta
        name="twitter:image"
        content="https://talk2hire.com/talk2hirelogo.png"
      />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700&family=DM+Sans:wght@300;400;500&display=swap');

        .co-root * { font-family: 'DM Sans', sans-serif; }
        .co-root h1 { font-family: 'Sora', sans-serif; }

        @keyframes coFadeUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes coBgFade { from{opacity:0} to{opacity:1} }
        @keyframes floatX { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(18px,-14px) scale(1.05)} 66%{transform:translate(-10px,12px) scale(0.96)} }
        @keyframes floatY { 0%,100%{transform:translate(0,0) scale(1)} 40%{transform:translate(-16px,16px) scale(1.04)} 70%{transform:translate(12px,-8px) scale(0.97)} }
        @keyframes floatZ { 0%,100%{transform:translate(0,0) rotate(0deg)} 50%{transform:translate(8px,-20px) rotate(6deg)} }
        @keyframes meshDrift { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
        @keyframes shimmerBar { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes pulseDot { 0%,100%{box-shadow:0 0 0 0 rgba(217,119,6,0.5)} 50%{box-shadow:0 0 0 6px rgba(217,119,6,0)} }
        @keyframes spinnerRing { to{transform:rotate(360deg)} }

        .blob-1 { animation: floatX 12s ease-in-out infinite; }
        .blob-2 { animation: floatY 14s ease-in-out infinite 2s; }
        .blob-3 { animation: floatZ 10s ease-in-out infinite 1s; }
        .co-bg  { animation: coBgFade .6s ease both; }
        .co-card    { animation: coFadeUp .55s cubic-bezier(.22,1,.36,1) .05s both; }
        .co-header  { animation: coFadeUp .55s cubic-bezier(.22,1,.36,1) .15s both; }
        .co-form    { animation: coFadeUp .55s cubic-bezier(.22,1,.36,1) .25s both; }

        .co-mesh {
          background: linear-gradient(135deg,#fdf8f0 0%,#fef9ec 20%,#f0f7ff 50%,#f5f0ff 80%,#fdf8f0 100%);
          background-size:300% 300%; animation:meshDrift 18s ease infinite;
        }
        .co-card-glass {
          background:rgba(255,255,255,0.75);
          backdrop-filter:blur(28px) saturate(1.8);
          -webkit-backdrop-filter:blur(28px) saturate(1.8);
          border:1px solid rgba(255,255,255,0.9);
          box-shadow:0 1px 0 0 rgba(255,255,255,0.95) inset, 0 8px 32px -4px rgba(180,140,60,0.12), 0 24px 64px -12px rgba(99,102,241,0.08);
          border-radius:28px; overflow:hidden;
        }
        .accent-bar {
          height:3px;
          background:linear-gradient(90deg,#f59e0b,#d97706,#fbbf24,#d97706,#f59e0b);
          background-size:200% auto; animation:shimmerBar 3s linear infinite;
        }
        .co-card-header {
          background:linear-gradient(135deg,rgba(255,251,235,0.9) 0%,rgba(255,255,255,0.7) 100%);
          border-bottom:1px solid rgba(217,119,6,0.12);
        }
        .biz-badge {
          display:inline-flex; align-items:center; gap:6px;
          background:linear-gradient(135deg,#fef3c7,#fde68a);
          border:1px solid rgba(217,119,6,0.25); border-radius:999px;
          padding:4px 14px; font-size:0.68rem; font-weight:600;
          letter-spacing:.1em; color:#92400e; text-transform:uppercase; font-family:'Sora',sans-serif;
        }
        .biz-dot { width:6px; height:6px; background:#d97706; border-radius:50%; animation:pulseDot 2s ease-out infinite; }
        .icon-box {
          background:linear-gradient(135deg,#fef3c7 0%,#fde68a 100%);
          border:1.5px solid rgba(217,119,6,0.25); border-radius:14px;
          width:46px; height:46px; display:flex; align-items:center; justify-content:center;
          box-shadow:0 4px 12px rgba(217,119,6,0.15);
        }
        .btn-gold {
          background:linear-gradient(135deg,#f59e0b 0%,#d97706 50%,#b45309 100%);
          background-size:200% auto; border-radius:14px;
          font-family:'Sora',sans-serif; font-weight:600; font-size:0.875rem;
          color:#fff; border:none;
          transition:transform .15s, box-shadow .2s, background-position .4s;
          box-shadow:0 4px 20px rgba(217,119,6,0.35); letter-spacing:.02em;
        }
        .btn-gold:hover:not(:disabled) { background-position:right center; transform:translateY(-2px); box-shadow:0 8px 28px rgba(217,119,6,0.45); }
        .btn-gold:active:not(:disabled) { transform:translateY(0); }
        .btn-gold:disabled { opacity:.6; cursor:not-allowed; }
        .co-spinner { width:16px; height:16px; border:2px solid rgba(255,255,255,0.3); border-top-color:#fff; border-radius:50%; animation:spinnerRing .7s linear infinite; }
        .ms-spinner { width:16px; height:16px; border:2px solid rgba(37,99,235,.2); border-top-color:#2563eb; border-radius:50%; animation:spinnerRing .7s linear infinite; display:inline-block; }
        .error-banner { background:rgba(255,241,242,0.9); border:1px solid rgba(251,113,133,0.4); border-radius:12px; padding:10px 14px; }
        .co-divider { border:none; border-top:1px solid rgba(203,213,225,0.5); }
        .link-gold { color:#d97706; font-weight:500; transition:color .15s; }
        .link-gold:hover { color:#b45309; text-decoration:underline; }
        .text-co-muted { color:#64748b; font-size:0.8rem; }
        .dot-grid { background-image:radial-gradient(circle,rgba(217,119,6,0.12) 1px,transparent 1px); background-size:26px 26px; }
        .co-root input:focus { outline:none; }

        .btn-ms {
          display:flex; align-items:center; justify-content:center; gap:10px;
          width:100%; padding:12px 16px;
          background:rgba(255,255,255,0.9);
          border:1.5px solid rgba(203,213,225,0.8); border-radius:14px;
          font-family:'Sora',sans-serif; font-size:0.84rem; font-weight:600;
          color:#1e293b; letter-spacing:.01em;
          transition:all .2s; box-shadow:0 2px 8px rgba(0,0,0,0.06); cursor:pointer;
        }
        .btn-ms:hover:not(:disabled) { border-color:#2563eb; background:rgba(239,246,255,0.9); box-shadow:0 4px 16px rgba(37,99,235,0.12); transform:translateY(-1px); }
        .btn-ms:active:not(:disabled) { transform:translateY(0); }
        .btn-ms:disabled { opacity:.6; cursor:not-allowed; }
        .or-divider {
          display:flex; align-items:center; gap:10px; margin:14px 0;
          color:#94a3b8; font-size:0.72rem; font-weight:500; letter-spacing:.08em; text-transform:uppercase;
        }
        .or-divider::before, .or-divider::after { content:''; flex:1; height:1px; background:rgba(203,213,225,0.6); }
      `}</style>

      <div className="co-root co-mesh min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden co-bg">
        <div className="pointer-events-none absolute inset-0 dot-grid opacity-100" />

        <div
          className="blob-1 pointer-events-none absolute -top-32 -right-32 w-100 h-100 rounded-full opacity-35 blur-[110px]"
          style={{
            background: "radial-gradient(circle, #fde68a 0%, #fca5a5 100%)",
          }}
        />
        <div
          className="blob-2 pointer-events-none absolute -bottom-24 -left-24 w-90 h-90 rounded-full opacity-30 blur-[100px]"
          style={{
            background: "radial-gradient(circle, #a5b4fc 0%, #6ee7b7 100%)",
          }}
        />
        <div
          className="blob-3 pointer-events-none absolute top-1/3 right-1/4 w-55 h-55 rounded-full opacity-20 blur-[80px]"
          style={{
            background: "radial-gradient(circle, #fbbf24 0%, #c4b5fd 100%)",
          }}
        />

        <div className="relative z-10 w-full max-w-105 co-card">
          <div className="co-card-glass">
            <div className="accent-bar" />

            <div className="co-card-header px-9 pt-8 pb-7 co-header">
              <div className="mb-5">
                <span className="biz-badge">
                  <span className="biz-dot" />
                  Business Portal
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="icon-box shrink-0">
                  <Building2 size={20} className="text-amber-700" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-800 leading-tight tracking-tight">
                    Welcome Back
                  </h1>
                  <p className="text-xs text-slate-500 font-light mt-0.5">
                    Sign in to your company dashboard
                  </p>
                </div>
              </div>
            </div>

            <div className="px-9 pt-7 pb-9 co-form">
              {shownError && (
                <div className="error-banner flex items-start gap-2.5 mb-5">
                  <AlertCircle
                    size={15}
                    className="text-rose-500 mt-0.5 shrink-0"
                  />
                  <p className="text-xs text-rose-600 leading-relaxed">
                    {shownError}
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={loginWithMicrosoft}
                disabled={msRedirecting || loading}
                className="btn-ms"
              >
                {msRedirecting ? (
                  <>
                    <span className="ms-spinner" /> Redirecting…
                  </>
                ) : (
                  <>
                    <MicrosoftLogo /> Continue with Microsoft
                  </>
                )}
              </button>

              <div className="or-divider">or sign in with email</div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5 tracking-wide uppercase">
                    Business Email *
                  </label>
                  <input
                    className={inputCls(!!errors.companyMail)}
                    placeholder="contact@company.com"
                    autoComplete="email"
                    onChange={handleInputChange}
                    {...register("companyMail", {
                      required: "Email is required",
                      pattern: {
                        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                        message: "Enter a valid email address",
                      },
                    })}
                  />
                  {errors.companyMail && (
                    <p className="mt-1.5 text-xs text-rose-500 flex items-center gap-1">
                      ⚠ {errors.companyMail.message}
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-500 tracking-wide uppercase">
                      Password *
                    </label>
                    <Link
                      to="/verify-password"
                      className="link-gold text-[11px]"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      className={inputCls(!!errors.password) + " pr-12"}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      onChange={handleInputChange}
                      {...register("password", {
                        required: "Password is required",
                        minLength: {
                          value: 8,
                          message: "At least 8 characters",
                        },
                      })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-600 transition-colors p-1"
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1.5 text-xs text-rose-500 flex items-center gap-1">
                      ⚠ {errors.password.message}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!isValid || loading}
                  className="btn-gold w-full py-3.5 flex items-center justify-center gap-2 mt-1"
                >
                  {loading ? (
                    <>
                      <span className="co-spinner" /> Signing in...
                    </>
                  ) : (
                    "Sign In ✦"
                  )}
                </button>
              </form>

              <div className="flex items-center gap-3 py-4">
                <hr className="flex-1 co-divider" />
                <span className="text-[10px] text-slate-400 tracking-widest uppercase">
                  links
                </span>
                <hr className="flex-1 co-divider" />
              </div>

              <div className="space-y-2 text-center">
                <p className="text-co-muted">
                  Don't have a company account?{" "}
                  <Link to="/signup/company" className="link-gold">
                    Register here
                  </Link>
                </p>
                <p className="text-co-muted">
                  Not a company?{" "}
                  <Link to="/login" className="link-gold">
                    User login
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Companylogin;

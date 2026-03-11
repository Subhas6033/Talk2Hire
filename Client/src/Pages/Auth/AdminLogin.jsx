import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useAdminAuth from "../../Hooks/useAdminAuthHook";

export default function AdminLogin() {
  const { login, loading, error, isAuthenticated, resetError } = useAdminAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // redirect if already logged in (e.g. page refresh with valid cookie)
  useEffect(() => {
    if (isAuthenticated) navigate("/admin/dashboard", { replace: true });
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (error) {
      const t = setTimeout(resetError, 4000);
      return () => clearTimeout(t);
    }
  }, [error]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    await login(email, password);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 overflow-hidden relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-px h-full bg-linear-to-b from-transparent via-[#1e1e1e] to-transparent" />
        <div className="absolute top-0 left-2/4 w-px h-full bg-linear-to-b from-transparent via-[#1e1e1e] to-transparent" />
        <div className="absolute top-0 left-3/4 w-px h-full bg-linear-to-b from-transparent via-[#1e1e1e] to-transparent" />
        <div className="absolute left-0 top-1/3 w-full h-px bg-linear-to-r from-transparent via-[#1e1e1e] to-transparent" />
        <div className="absolute left-0 top-2/3 w-full h-px bg-linear-to-r from-transparent via-[#1e1e1e] to-transparent" />
        <div
          className="absolute top-[-20%] right-[-10%] w-125 h-125 rounded-full opacity-[0.04]"
          style={{
            background: "radial-gradient(circle, #e8ff4a 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute bottom-[-20%] left-[-10%] w-100 h-100 rounded-full opacity-[0.03]"
          style={{
            background: "radial-gradient(circle, #4affe8 0%, transparent 70%)",
          }}
        />
      </div>

      <div
        className="relative w-full max-w-105"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(16px)",
          transition: "opacity 0.5s ease, transform 0.5s ease",
        }}
      >
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-[#e8ff4a] flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="2" width="5" height="5" fill="#0a0a0a" />
                <rect x="9" y="2" width="5" height="5" fill="#0a0a0a" />
                <rect x="2" y="9" width="5" height="5" fill="#0a0a0a" />
                <rect x="9" y="9" width="5" height="5" fill="#0a0a0a" />
              </svg>
            </div>
            <span className="text-[#e8ff4a] text-xs font-mono tracking-[0.2em] uppercase">
              Talk2Hire
            </span>
          </div>

          <h1
            className="text-white leading-none mb-2"
            style={{
              fontSize: "clamp(2rem, 5vw, 2.75rem)",
              fontFamily: "'Georgia', serif",
              fontWeight: 400,
              letterSpacing: "-0.02em",
            }}
          >
            Admin
            <br />
            <span className="text-[#444]">Portal</span>
          </h1>
          <p className="text-[#555] text-sm font-mono tracking-wide">
            Restricted access — authorised personnel only
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="group">
            <label className="block text-[#555] text-[10px] font-mono tracking-[0.15em] uppercase mb-2">
              Email Address
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@talk2hire.com"
                required
                className="w-full bg-[#111] border border-[#222] text-white text-sm font-mono px-4 py-3.5 outline-none placeholder-[#333] transition-all duration-200 focus:border-[#e8ff4a] focus:bg-[#0d0d0d]"
                style={{ borderRadius: 0 }}
              />
              <div className="absolute inset-y-0 right-0 w-px bg-linear-to-b from-transparent via-[#e8ff4a] to-transparent opacity-0 group-focus-within:opacity-100 transition-opacity duration-300" />
            </div>
          </div>

          <div className="group">
            <label className="block text-[#555] text-[10px] font-mono tracking-[0.15em] uppercase mb-2">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full bg-[#111] border border-[#222] text-white text-sm font-mono px-4 py-3.5 pr-12 outline-none placeholder-[#333] transition-all duration-200 focus:border-[#e8ff4a] focus:bg-[#0d0d0d]"
                style={{ borderRadius: 0 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#444] hover:text-[#e8ff4a] transition-colors duration-150"
              >
                {showPassword ? (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
              <div className="absolute inset-y-0 right-0 w-px bg-linear-to-b from-transparent via-[#e8ff4a] to-transparent opacity-0 group-focus-within:opacity-100 transition-opacity duration-300" />
            </div>
          </div>

          {error && (
            <div
              className="border border-red-900 bg-red-950/40 px-4 py-3 flex items-start gap-3"
              style={{ borderRadius: 0 }}
            >
              <span className="text-red-500 mt-0.5 shrink-0">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </span>
              <p className="text-red-400 text-xs font-mono">{error}</p>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full bg-[#e8ff4a] text-[#0a0a0a] text-sm font-mono font-bold tracking-widest uppercase py-4 transition-all duration-150 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ borderRadius: 0 }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Authenticating
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </div>
        </form>

        <div className="mt-8 pt-6 border-t border-[#1a1a1a] flex items-center justify-between">
          <span className="text-[#2a2a2a] text-[10px] font-mono tracking-widest uppercase">
            © 2025 Talk2Hire
          </span>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#e8ff4a] animate-pulse" />
            <span className="text-[#2a2a2a] text-[10px] font-mono">
              System online
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMicrosoftUserAuth } from "../../Hooks/useMicrosoftAuth";
import Loader from "../../Components/Loader/Loader";

const USER_FRIENDLY_CODES = [400, 401, 403, 409, 422];

const isUserFriendlyError = (err) => {
  const status = err?.status || err?.statusCode || err?.response?.status;
  const message = err?.message || err?.data?.message || "";
  const looksReadable =
    message.length > 0 && message.length < 200 && /^[A-Z]/.test(message);
  return USER_FRIENDLY_CODES.includes(status) && looksReadable;
};

const ErrorPage = ({ message, onBack }) => (
  <div
    className="min-h-screen flex items-center justify-center px-4"
    style={{
      background:
        "linear-gradient(135deg, #f8fafc 0%, #eff6ff 50%, #f5f3ff 100%)",
      fontFamily: "'DM Sans', sans-serif",
    }}
  >
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700&family=DM+Sans:wght@400;500&display=swap');
      @keyframes popIn { from{transform:scale(0.6);opacity:0} to{transform:scale(1);opacity:1} }
      @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
      .ep-icon { animation: popIn .45s cubic-bezier(0.34,1.56,0.64,1) forwards; }
      .ep-body { animation: fadeUp .4s ease .15s both; }
    `}</style>

    <div className="w-full max-w-sm text-center ep-body">
      <div
        className="ep-icon mx-auto mb-6 w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg"
        style={{ background: "linear-gradient(135deg, #fee2e2, #fecaca)" }}
      >
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ef4444"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>

      <div
        className="p-8 rounded-3xl border"
        style={{
          background: "rgba(255,255,255,0.8)",
          backdropFilter: "blur(20px)",
          borderColor: "rgba(255,255,255,0.9)",
          boxShadow:
            "0 8px 32px -4px rgba(0,0,0,0.08), 0 20px 60px -12px rgba(99,102,241,0.1)",
        }}
      >
        <h1
          className="text-xl font-bold text-slate-800 mb-2"
          style={{ fontFamily: "'Sora', sans-serif" }}
        >
          Sign-in Failed
        </h1>
        <p className="text-sm text-slate-500 leading-relaxed mb-6">{message}</p>

        <button
          onClick={onBack}
          className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all hover:-translate-y-0.5"
          style={{
            background: "linear-gradient(135deg, #6366f1, #7c3aed)",
            boxShadow: "0 4px 16px rgba(99,102,241,0.35)",
          }}
        >
          ← Go Back
        </button>
      </div>
    </div>
  </div>
);

const UserMicrosoftCallback = () => {
  const { fetchSession, isAuthenticated, isNewUser } = useMicrosoftUserAuth();
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    fetchSession()
      .unwrap()
      .then(() => {
        if (isNewUser) sessionStorage.setItem("showOnboarding", "true");
      })
      .catch((err) => {
        const message = isUserFriendlyError(err)
          ? err?.message || err?.data?.message
          : "Something went wrong. Please try again.";
        setErrorMessage(message);
      });
  }, []);

  useEffect(() => {
    if (isAuthenticated) navigate("/", { replace: true });
  }, [isAuthenticated]);

  if (errorMessage) {
    return (
      <ErrorPage message={errorMessage} onBack={() => navigate("/login")} />
    );
  }

  return <Loader label="Signing you in..." />;
};

export default UserMicrosoftCallback;

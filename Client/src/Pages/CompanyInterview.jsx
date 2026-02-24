import { useState } from "react";
import {
  Video,
  Search,
  Filter,
  ChevronDown,
  Star,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  X,
  Briefcase,
  MapPin,
  Mail,
  Phone,
  Monitor,
  Camera,
  Smartphone,
  Play,
  Pause,
  Users,
  TrendingUp,
  Award,
  MessageSquare,
  Download,
  ChevronRight,
  AlertCircle,
  BarChart2,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { useCompanyInterviews } from "../Hooks/useCompanyInterviewHook";

/* ── Score helpers ───────────────────────────────────────────────────────── */
const scoreColor = (s) =>
  s >= 85 ? "text-emerald-600" : s >= 70 ? "text-amber-500" : "text-red-500";
const scoreBg = (s) =>
  s >= 85
    ? "bg-emerald-50 border-emerald-200"
    : s >= 70
      ? "bg-amber-50 border-amber-200"
      : "bg-red-50 border-red-200";
const scoreBar = (s) =>
  s >= 85 ? "bg-emerald-400" : s >= 70 ? "bg-amber-400" : "bg-red-400";

/* ── Status config ───────────────────────────────────────────────────────── */
const STATUS = {
  pending: {
    label: "Under Review",
    cls: "bg-amber-50 text-amber-600 border border-amber-200",
  },
  hired: {
    label: "Hired",
    cls: "bg-emerald-50 text-emerald-600 border border-emerald-200",
  },
  rejected: {
    label: "Rejected",
    cls: "bg-red-50 text-red-500 border border-red-200",
  },
};

/* ── Skeleton loader ─────────────────────────────────────────────────────── */
const Skeleton = ({ className }) => (
  <div className={`animate-pulse bg-gray-100 rounded-xl ${className}`} />
);

const CardSkeleton = () => (
  <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
    <div className="flex items-center gap-3">
      <Skeleton className="w-11 h-11 rounded-xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
    <Skeleton className="h-2 w-full" />
    <Skeleton className="h-3 w-20" />
  </div>
);

/* ── Video Card ──────────────────────────────────────────────────────────── */
const VideoCard = ({ icon: Icon, label, subtitle, video, color }) => {
  const [playing, setPlaying] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="relative bg-gray-900 aspect-video flex items-center justify-center">
        {video.available ? (
          <>
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${color}22, ${color}08)`,
              }}
            >
              <div className="text-center">
                <Icon
                  size={36}
                  style={{ color }}
                  className="mx-auto mb-2 opacity-50"
                />
                <p className="text-xs text-gray-400">Recording available</p>
              </div>
            </div>
            <button
              onClick={() => setPlaying((p) => !p)}
              className="absolute inset-0 flex items-center justify-center hover:bg-black/20 transition-all group"
            >
              <div className="w-14 h-14 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                {playing ? (
                  <Pause size={20} className="text-gray-800" />
                ) : (
                  <Play size={20} className="text-gray-800 ml-1" />
                )}
              </div>
            </button>
          </>
        ) : (
          <div className="text-center px-4">
            <AlertCircle size={28} className="text-gray-600 mx-auto mb-2" />
            <p className="text-xs text-gray-500">Not available</p>
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: `${color}18` }}
            >
              <Icon size={14} style={{ color }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">{label}</p>
              <p className="text-[11px] text-gray-400">{subtitle}</p>
            </div>
          </div>
          {video.available && video.url && (
            <a
              href={video.url}
              download
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              title="Download"
            >
              <Download
                size={13}
                className="text-gray-400 hover:text-indigo-500"
              />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── Candidate Detail Modal ──────────────────────────────────────────────── */
const CandidateModal = ({
  interview,
  onClose,
  onHire,
  onReject,
  isDeciding,
}) => {
  const [activeTab, setActiveTab] = useState("overview");
  const [confirming, setConfirming] = useState(null); // "hire" | "reject" | null

  const { candidate, job, answers = [], videos = {} } = interview;

  const handleDecision = async (action) => {
    if (confirming !== action) {
      setConfirming(action);
      return;
    }
    const ok =
      action === "hire"
        ? await onHire(interview.id)
        : await onReject(interview.id);
    if (ok) onClose();
    setConfirming(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-7 py-5 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-lg font-bold shadow-lg shrink-0"
              style={{
                background: `linear-gradient(135deg, ${interview.color}, ${interview.color}bb)`,
              }}
            >
              {candidate.avatar}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg font-bold text-gray-900">
                  {candidate.name}
                </h2>
                <span
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${STATUS[interview.status]?.cls}`}
                >
                  {STATUS[interview.status]?.label}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">{job.title}</p>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {candidate.email && (
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Mail size={11} />
                    {candidate.email}
                  </span>
                )}
                {candidate.location && (
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <MapPin size={11} />
                    {candidate.location}
                  </span>
                )}
                {interview.duration && (
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock size={11} />
                    {interview.duration}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div
              className={`px-3 py-2 rounded-xl border text-center ${scoreBg(interview.score)}`}
            >
              <p
                className={`text-xl font-black ${scoreColor(interview.score)}`}
              >
                {interview.score}
              </p>
              <p className="text-[10px] text-gray-400 font-medium">
                Candidate Score
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors ml-2"
            >
              <X size={16} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-7 pt-4 border-b border-gray-100">
          {["overview", "answers", "recordings"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium capitalize rounded-t-xl border-b-2 transition-all ${
                activeTab === tab
                  ? "text-indigo-600 border-indigo-500 bg-indigo-50/50"
                  : "text-gray-500 border-transparent hover:text-gray-700"
              }`}
            >
              {tab === "recordings"
                ? "🎥 Recordings"
                : tab === "answers"
                  ? "💬 Q&A Scores"
                  : "📋 Overview"}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-7 py-6">
          {/* OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                {[
                  {
                    label: "Experience",
                    value: candidate.experience ?? "—",
                    icon: Briefcase,
                    color: "#6366f1",
                  },
                  {
                    label: "Interview Date",
                    value: new Date(interview.created_at).toLocaleDateString(
                      "en-IN",
                      { day: "numeric", month: "short", year: "numeric" },
                    ),
                    icon: Clock,
                    color: "#8b5cf6",
                  },
                  {
                    label: "Candidate Score",
                    value: `${interview.score}/100`,
                    icon: Award,
                    color:
                      interview.score >= 85
                        ? "#10b981"
                        : interview.score >= 70
                          ? "#f59e0b"
                          : "#ef4444",
                  },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div
                    key={label}
                    className="bg-gray-50 rounded-2xl border border-gray-100 p-4"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: `${color}18` }}
                      >
                        <Icon size={14} style={{ color }} />
                      </div>
                      <p className="text-xs text-gray-400 font-medium">
                        {label}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-gray-800">{value}</p>
                  </div>
                ))}
              </div>

              {candidate.skills?.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                    Skills
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {candidate.skills.map((sk) => (
                      <span
                        key={sk}
                        className="px-3 py-1.5 bg-indigo-50 text-indigo-600 text-xs font-semibold rounded-xl border border-indigo-100"
                      >
                        {sk}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {interview.summary && (
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <MessageSquare size={13} /> AI Summary
                  </h3>
                  <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4">
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {interview.summary}
                    </p>
                  </div>
                </div>
              )}

              {(interview.strengths?.length > 0 ||
                interview.improvements?.length > 0) && (
                <div className="grid grid-cols-2 gap-4">
                  {interview.strengths?.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <CheckCircle size={13} className="text-emerald-500" />{" "}
                        Strengths
                      </h3>
                      <div className="space-y-2">
                        {interview.strengths.map((s) => (
                          <div
                            key={s}
                            className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2"
                          >
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                            <p className="text-xs text-emerald-700 font-medium">
                              {s}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {interview.improvements?.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <AlertCircle size={13} className="text-amber-500" />{" "}
                        Areas to Improve
                      </h3>
                      <div className="space-y-2">
                        {interview.improvements.map((s) => (
                          <div
                            key={s}
                            className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2"
                          >
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                            <p className="text-xs text-amber-700 font-medium">
                              {s}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {answers.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <BarChart2 size={13} /> Score Breakdown
                  </h3>
                  <div className="space-y-3">
                    {answers.map((a) => (
                      <div key={a.id ?? a.order_index}>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs text-gray-600 truncate max-w-[70%]">
                            {a.question}
                          </p>
                          <span
                            className={`text-xs font-bold ${scoreColor(a.score)}`}
                          >
                            {a.score}
                          </span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${scoreBar(a.score)}`}
                            style={{ width: `${a.score}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Q&A */}
          {activeTab === "answers" && (
            <div className="space-y-4">
              {answers.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">
                  No answer data available.
                </div>
              ) : (
                answers.map((a, i) => (
                  <div
                    key={a.id ?? i}
                    className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600 shrink-0 mt-0.5">
                          {i + 1}
                        </div>
                        <p className="text-sm font-semibold text-gray-800">
                          {a.question}
                        </p>
                      </div>
                      <div
                        className={`px-3 py-1.5 rounded-xl border text-center shrink-0 ${scoreBg(a.score)}`}
                      >
                        <p
                          className={`text-base font-black ${scoreColor(a.score)}`}
                        >
                          {a.score}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 ml-10">
                      {a.time_taken && (
                        <span className="flex items-center gap-1.5 text-xs text-gray-400">
                          <Clock size={11} /> Answered in {a.time_taken}
                        </span>
                      )}
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${scoreBar(a.score)}`}
                          style={{ width: `${a.score}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Recordings */}
          {activeTab === "recordings" && (
            <div className="space-y-4">
              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-start gap-3">
                <Video size={16} className="text-indigo-500 mt-0.5 shrink-0" />
                <p className="text-sm text-indigo-700">
                  Three recordings are available — screen share, primary webcam,
                  and mobile camera.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <VideoCard
                  icon={Monitor}
                  label="Screen Recording"
                  subtitle="Full screen capture"
                  video={videos.screen ?? { available: false }}
                  color="#6366f1"
                />
                <VideoCard
                  icon={Camera}
                  label="Primary Camera"
                  subtitle="Webcam recording"
                  video={videos.primary ?? { available: false }}
                  color="#8b5cf6"
                />
                <VideoCard
                  icon={Smartphone}
                  label="Mobile Camera"
                  subtitle="Secondary angle"
                  video={videos.mobile ?? { available: false }}
                  color="#10b981"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer — decision buttons (pending only) */}
        {interview.status === "pending" && (
          <div className="flex items-center justify-between px-7 py-4 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-400">
              {confirming
                ? `Click "${confirming === "hire" ? "Hire" : "Reject"}" again to confirm.`
                : "Make your decision based on the interview results"}
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleDecision("reject")}
                disabled={isDeciding}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 ${
                  confirming === "reject"
                    ? "bg-red-500 text-white border border-red-500"
                    : "text-red-500 bg-red-50 border border-red-200 hover:bg-red-100"
                }`}
              >
                {isDeciding && confirming === "reject" ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <XCircle size={15} />
                )}
                {confirming === "reject" ? "Confirm Reject" : "Reject"}
              </button>
              <button
                onClick={() => handleDecision("hire")}
                disabled={isDeciding}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-60 ${
                  confirming === "hire"
                    ? "bg-emerald-700 text-white"
                    : "text-white"
                }`}
                style={
                  confirming !== "hire"
                    ? {
                        background: "linear-gradient(135deg, #10b981, #059669)",
                      }
                    : {}
                }
              >
                {isDeciding && confirming === "hire" ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <CheckCircle size={15} />
                )}
                {confirming === "hire" ? "Confirm Hire" : "Hire Candidate"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Candidate Card ──────────────────────────────────────────────────────── */
const CandidateCard = ({ interview, onClick }) => {
  const s = STATUS[interview.status] ?? STATUS.pending;
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group p-5"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0"
            style={{
              background: `linear-gradient(135deg, ${interview.color}, ${interview.color}bb)`,
            }}
          >
            {interview.candidate.avatar}
          </div>
          <div>
            <p className="text-sm font-bold text-gray-800 group-hover:text-indigo-600 transition-colors">
              {interview.candidate.name}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {interview.job.title}
            </p>
          </div>
        </div>
        <div
          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${s.cls}`}
        >
          {s.label}
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${scoreBg(interview.score)}`}
        >
          <Star
            size={12}
            className={scoreColor(interview.score)}
            fill="currentColor"
          />
          <span className={`text-sm font-black ${scoreColor(interview.score)}`}>
            {interview.score}
          </span>
          <span className="text-[10px] text-gray-400">/100</span>
        </div>
        {interview.duration && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Clock size={11} /> {interview.duration}
          </div>
        )}
      </div>

      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-4">
        <div
          className={`h-full rounded-full ${scoreBar(interview.score)}`}
          style={{ width: `${interview.score}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[11px] text-gray-400 flex items-center gap-1">
          <Clock size={10} />
          {new Date(interview.created_at).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
          })}
        </span>
        <span className="flex items-center gap-1 text-xs text-indigo-500 font-medium group-hover:gap-2 transition-all">
          View Details <ChevronRight size={13} />
        </span>
      </div>
    </div>
  );
};

/* ── Main Page ───────────────────────────────────────────────────────────── */
const CompanyInterviews = () => {
  const {
    interviews,
    counts,
    jobs,
    selectedInterview,
    filterStatus,
    filterJobId,
    search,
    changeStatus,
    changeJob,
    changeSearch,
    openInterview,
    closeInterview,
    hire,
    reject,
    isLoadingList,
    isLoadingDetail,
    isDeciding,
    listFailed,
    loadInterviews,
  } = useCompanyInterviews();

  // Group by job
  const byJob = {};
  interviews.forEach((c) => {
    const key = c.job?.id ?? "unknown";
    if (!byJob[key]) byJob[key] = { job: c.job, items: [] };
    byJob[key].items.push(c);
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-5">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Interviews</h1>
              <p className="text-sm text-gray-400 mt-0.5">
                Review candidates and make hiring decisions
              </p>
            </div>
            <button
              onClick={() => loadInterviews()}
              disabled={isLoadingList}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all disabled:opacity-50"
            >
              <RefreshCw
                size={14}
                className={isLoadingList ? "animate-spin" : ""}
              />
              Refresh
            </button>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[
              {
                label: "Total Interviews",
                value: counts.all,
                icon: Video,
                color: "indigo",
              },
              {
                label: "Under Review",
                value: counts.pending,
                icon: Eye,
                color: "amber",
              },
              {
                label: "Hired",
                value: counts.hired,
                icon: CheckCircle,
                color: "emerald",
              },
              {
                label: "Avg. Candidate Score",
                value: counts.avg_score,
                icon: TrendingUp,
                color: "violet",
              },
            ].map(({ label, value, icon: Icon, color }) => {
              const colors = {
                indigo: {
                  bg: "bg-indigo-50",
                  text: "text-indigo-600",
                  border: "border-indigo-100",
                },
                amber: {
                  bg: "bg-amber-50",
                  text: "text-amber-600",
                  border: "border-amber-100",
                },
                emerald: {
                  bg: "bg-emerald-50",
                  text: "text-emerald-600",
                  border: "border-emerald-100",
                },
                violet: {
                  bg: "bg-violet-50",
                  text: "text-violet-600",
                  border: "border-violet-100",
                },
              }[color];
              return (
                <div
                  key={label}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${colors.bg} ${colors.border}`}
                >
                  <Icon size={18} className={colors.text} />
                  <div>
                    {isLoadingList ? (
                      <Skeleton className="h-6 w-8 mb-1" />
                    ) : (
                      <p className={`text-xl font-black ${colors.text}`}>
                        {value}
                      </p>
                    )}
                    <p className="text-[11px] text-gray-400">{label}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Status tabs */}
          <div className="flex items-center gap-1">
            {["all", "pending", "hired", "rejected"].map((s) => (
              <button
                key={s}
                onClick={() => changeStatus(s)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                  filterStatus === s
                    ? "bg-indigo-50 text-indigo-600"
                    : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                }`}
              >
                {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                <span
                  className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold ${filterStatus === s ? "bg-indigo-100 text-indigo-600" : "bg-gray-100 text-gray-500"}`}
                >
                  {counts[s] ?? 0}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Search + job filter */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="relative flex-1 min-w-50">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all"
              placeholder="Search candidates or roles..."
              value={search}
              onChange={(e) => changeSearch(e.target.value)}
            />
          </div>
          <div className="relative">
            <Filter
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <select
              className="pl-8 pr-8 py-2.5 rounded-xl border border-gray-200 text-sm bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all appearance-none cursor-pointer text-gray-600"
              value={filterJobId}
              onChange={(e) => changeJob(e.target.value)}
            >
              <option value="all">All Jobs</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </select>
            <ChevronDown
              size={13}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
          </div>
        </div>

        {/* Error state */}
        {listFailed && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center mb-6">
            <AlertCircle size={28} className="text-red-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-red-600 mb-3">
              Failed to load interviews
            </p>
            <button
              onClick={() => loadInterviews()}
              className="px-4 py-2 rounded-xl bg-red-100 text-red-600 text-sm font-medium hover:bg-red-200 transition-all"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Skeleton */}
        {isLoadingList && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Candidate list */}
        {!isLoadingList &&
          !listFailed &&
          (filterJobId === "all" ? (
            <div className="space-y-8">
              {Object.values(byJob).map(({ job, items }) => (
                <div key={job?.id ?? "unknown"}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                      <Briefcase size={14} className="text-indigo-500" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-gray-800">
                        {job?.title ?? "Unknown Position"}
                      </h2>
                      <p className="text-xs text-gray-400">
                        {items.length} candidate{items.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {items.map((c) => (
                      <CandidateCard
                        key={c.id}
                        interview={c}
                        onClick={() => openInterview(c.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {interviews.map((c) => (
                <CandidateCard
                  key={c.id}
                  interview={c}
                  onClick={() => openInterview(c.id)}
                />
              ))}
            </div>
          ))}

        {/* Empty state */}
        {!isLoadingList && !listFailed && interviews.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
              <Users size={28} className="text-indigo-300" />
            </div>
            <h3 className="text-base font-bold text-gray-700 mb-1">
              No candidates found
            </h3>
            <p className="text-sm text-gray-400 max-w-xs">
              Try adjusting your filters or search terms.
            </p>
          </div>
        )}
      </div>

      {/* ── Detail modal ── */}
      {isLoadingDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 flex items-center gap-4 shadow-xl">
            <Loader2 size={22} className="animate-spin text-indigo-500" />
            <p className="text-sm text-gray-600 font-medium">
              Loading interview details…
            </p>
          </div>
        </div>
      )}

      {selectedInterview && !isLoadingDetail && (
        <CandidateModal
          interview={selectedInterview}
          onClose={closeInterview}
          onHire={hire}
          onReject={reject}
          isDeciding={isDeciding}
        />
      )}
    </div>
  );
};

export default CompanyInterviews;

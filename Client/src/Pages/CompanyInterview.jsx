import React, { useState } from "react";
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
  FileText,
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
} from "lucide-react";

// ─── Mock Data ───────────────────────────────────────────────
const JOBS = [
  { id: 1, title: "Senior Frontend Developer", applicants: 24 },
  { id: 2, title: "Product Designer", applicants: 18 },
  { id: 3, title: "Backend Engineer", applicants: 31 },
];

const CANDIDATES = [
  {
    id: 1,
    name: "Rahul Sharma",
    avatar: "RS",
    color: "#6366f1",
    role: "Senior Frontend Developer",
    jobId: 1,
    email: "rahul.sharma@gmail.com",
    phone: "+91 98765 43210",
    location: "Mumbai, India",
    experience: "4 years",
    score: 87,
    status: "pending",
    date: "Today, 2:30 PM",
    duration: "28 min",
    skills: ["React", "TypeScript", "Node.js", "GraphQL"],
    summary:
      "Rahul demonstrated strong React fundamentals and excellent problem-solving skills. He handled complex state management questions confidently and showed good understanding of performance optimization.",
    strengths: [
      "Strong React knowledge",
      "Clear communication",
      "Good problem solving",
    ],
    improvements: [
      "Could improve on system design",
      "Needs more backend exposure",
    ],
    answers: [
      {
        q: "Explain the React reconciliation algorithm.",
        score: 90,
        time: "2:10",
      },
      {
        q: "How do you handle state in large applications?",
        score: 85,
        time: "3:45",
      },
      {
        q: "What are React hooks and when to use them?",
        score: 92,
        time: "2:55",
      },
      {
        q: "Describe your experience with TypeScript.",
        score: 78,
        time: "2:30",
      },
    ],
    videos: {
      screen: { url: null, duration: "28:14", size: "420 MB", available: true },
      primary: {
        url: null,
        duration: "28:14",
        size: "310 MB",
        available: true,
      },
      mobile: { url: null, duration: "28:14", size: "280 MB", available: true },
    },
  },
  {
    id: 2,
    name: "Priya Mehta",
    avatar: "PM",
    color: "#8b5cf6",
    role: "Product Designer",
    jobId: 2,
    email: "priya.mehta@gmail.com",
    phone: "+91 87654 32109",
    location: "Bangalore, India",
    experience: "3 years",
    score: 92,
    status: "hired",
    date: "Yesterday, 11:00 AM",
    duration: "32 min",
    skills: ["Figma", "UI/UX", "Prototyping", "User Research"],
    summary:
      "Priya showed exceptional design thinking and articulated her process clearly. Her portfolio examples were impressive and she demonstrated deep understanding of user-centered design principles.",
    strengths: [
      "Outstanding portfolio",
      "Strong design thinking",
      "Excellent UX knowledge",
    ],
    improvements: ["Could strengthen data analysis skills"],
    answers: [
      { q: "Walk us through your design process.", score: 95, time: "4:20" },
      {
        q: "How do you handle conflicting stakeholder feedback?",
        score: 90,
        time: "3:10",
      },
      {
        q: "Describe a challenging design problem you solved.",
        score: 93,
        time: "5:00",
      },
      { q: "How do you measure design success?", score: 88, time: "2:45" },
    ],
    videos: {
      screen: { url: null, duration: "32:08", size: "480 MB", available: true },
      primary: {
        url: null,
        duration: "32:08",
        size: "360 MB",
        available: true,
      },
      mobile: {
        url: null,
        duration: "32:08",
        size: "320 MB",
        available: false,
      },
    },
  },
  {
    id: 3,
    name: "Arjun Patel",
    avatar: "AP",
    color: "#f59e0b",
    role: "Backend Engineer",
    jobId: 3,
    email: "arjun.patel@gmail.com",
    phone: "+91 76543 21098",
    location: "Delhi, India",
    experience: "2 years",
    score: 74,
    status: "rejected",
    date: "Dec 18, 10:15 AM",
    duration: "25 min",
    skills: ["Node.js", "PostgreSQL", "Docker"],
    summary:
      "Arjun showed foundational backend knowledge but struggled with advanced database optimization and system design questions. Experience level may not match the senior requirements.",
    strengths: ["Good Node.js basics", "Eager to learn"],
    improvements: [
      "Needs more database experience",
      "System design needs work",
      "Limited cloud experience",
    ],
    answers: [
      {
        q: "Explain database indexing and when to use it.",
        score: 70,
        time: "3:00",
      },
      {
        q: "Design a scalable REST API architecture.",
        score: 68,
        time: "4:30",
      },
      { q: "How do you handle database migrations?", score: 80, time: "2:20" },
      { q: "Explain microservices vs monolith.", score: 75, time: "3:15" },
    ],
    videos: {
      screen: { url: null, duration: "25:30", size: "380 MB", available: true },
      primary: {
        url: null,
        duration: "25:30",
        size: "290 MB",
        available: true,
      },
      mobile: { url: null, duration: "25:30", size: "260 MB", available: true },
    },
  },
  {
    id: 4,
    name: "Sneha Kapoor",
    avatar: "SK",
    color: "#10b981",
    role: "Senior Frontend Developer",
    jobId: 1,
    email: "sneha.kapoor@gmail.com",
    phone: "+91 65432 10987",
    location: "Pune, India",
    experience: "5 years",
    score: 81,
    status: "pending",
    date: "Dec 17, 3:00 PM",
    duration: "30 min",
    skills: ["Vue.js", "React", "CSS", "Webpack"],
    summary:
      "Sneha has solid frontend experience with both Vue and React. She gave thoughtful answers and demonstrated good architectural thinking. Her communication was clear and structured.",
    strengths: [
      "Multi-framework experience",
      "Good architectural thinking",
      "Clear communication",
    ],
    improvements: [
      "TypeScript skills need improvement",
      "Less familiar with testing",
    ],
    answers: [
      {
        q: "Compare Vue and React — when to use which?",
        score: 88,
        time: "3:30",
      },
      { q: "How do you optimize bundle size?", score: 82, time: "2:50" },
      { q: "Explain CSS-in-JS vs traditional CSS.", score: 79, time: "2:15" },
      {
        q: "How do you approach component architecture?",
        score: 84,
        time: "3:45",
      },
    ],
    videos: {
      screen: { url: null, duration: "30:22", size: "455 MB", available: true },
      primary: {
        url: null,
        duration: "30:22",
        size: "340 MB",
        available: true,
      },
      mobile: { url: null, duration: "30:22", size: "300 MB", available: true },
    },
  },
];

// ─── Helpers ─────────────────────────────────────────────────
const statusConfig = {
  pending: {
    label: "Under Review",
    cls: "bg-amber-50 text-amber-600 border border-amber-200",
    dot: "bg-amber-400",
  },
  hired: {
    label: "Hired",
    cls: "bg-emerald-50 text-emerald-600 border border-emerald-200",
    dot: "bg-emerald-400",
  },
  rejected: {
    label: "Rejected",
    cls: "bg-red-50 text-red-500 border border-red-200",
    dot: "bg-red-400",
  },
};

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

// ─── Video Player Card ───────────────────────────────────────
const VideoCard = ({ icon: Icon, label, subtitle, video, color }) => {
  const [playing, setPlaying] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Preview area */}
      <div className="relative bg-gray-900 aspect-video flex items-center justify-center group">
        {video.available ? (
          <>
            {/* Simulated video thumbnail */}
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${color}20, ${color}05)`,
              }}
            >
              <div className="text-center">
                <Icon
                  size={36}
                  style={{ color }}
                  className="mx-auto mb-2 opacity-60"
                />
                <p className="text-xs text-gray-400">Recording available</p>
              </div>
            </div>

            {/* Play button overlay */}
            <button
              onClick={() => setPlaying((p) => !p)}
              className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/20 transition-all group"
            >
              <div className="w-14 h-14 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                {playing ? (
                  <Pause size={20} className="text-gray-800" />
                ) : (
                  <Play size={20} className="text-gray-800 ml-1" />
                )}
              </div>
            </button>

            {/* Duration badge */}
            <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/60 rounded-lg text-[11px] text-white font-medium backdrop-blur-sm">
              {video.duration}
            </div>
          </>
        ) : (
          <div className="text-center px-4">
            <AlertCircle size={28} className="text-gray-600 mx-auto mb-2" />
            <p className="text-xs text-gray-500">Recording not available</p>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: `${color}15` }}
            >
              <Icon size={14} style={{ color }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">{label}</p>
              <p className="text-[11px] text-gray-400">{subtitle}</p>
            </div>
          </div>
          {video.available && (
            <button
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              title="Download"
            >
              <Download
                size={13}
                className="text-gray-400 hover:text-indigo-500"
              />
            </button>
          )}
        </div>

        {video.available && (
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
            <span className="text-[11px] text-gray-400">
              Size: {video.size}
            </span>
            <span className="w-1 h-1 rounded-full bg-gray-300" />
            <span className="text-[11px] text-gray-400">
              Duration: {video.duration}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Candidate Detail Modal ───────────────────────────────────
const CandidateModal = ({ candidate, onClose, onHire, onReject }) => {
  const [activeTab, setActiveTab] = useState("overview");
  const [deciding, setDeciding] = useState(null);

  const handleDecision = async (action) => {
    setDeciding(action);
    await new Promise((r) => setTimeout(r, 800));
    action === "hire" ? onHire(candidate.id) : onReject(candidate.id);
    setDeciding(null);
    onClose();
  };

  const tabs = ["overview", "answers", "recordings"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/25 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* ── Header ── */}
        <div className="flex items-start justify-between px-7 py-5 border-b border-gray-100">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-lg font-bold shadow-lg shrink-0"
              style={{
                background: `linear-gradient(135deg, ${candidate.color}, ${candidate.color}cc)`,
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
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${statusConfig[candidate.status].cls}`}
                >
                  {statusConfig[candidate.status].label}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">{candidate.role}</p>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Mail size={11} />
                  {candidate.email}
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <MapPin size={11} />
                  {candidate.location}
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Clock size={11} />
                  {candidate.duration} interview
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Score badge */}
            <div
              className={`px-3 py-2 rounded-xl border text-center ${scoreBg(candidate.score)}`}
            >
              <p
                className={`text-xl font-black ${scoreColor(candidate.score)}`}
              >
                {candidate.score}
              </p>
              <p className="text-[10px] text-gray-400 font-medium">AI Score</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors ml-2"
            >
              <X size={16} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex items-center gap-1 px-7 pt-4 pb-0 border-b border-gray-100">
          {tabs.map((tab) => (
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

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-7 py-6">
          {/* OVERVIEW TAB */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  {
                    label: "Experience",
                    value: candidate.experience,
                    icon: Briefcase,
                    color: "#6366f1",
                  },
                  {
                    label: "Interview Date",
                    value: candidate.date,
                    icon: Clock,
                    color: "#8b5cf6",
                  },
                  {
                    label: "AI Score",
                    value: `${candidate.score}/100`,
                    icon: Award,
                    color:
                      candidate.score >= 85
                        ? "#10b981"
                        : candidate.score >= 70
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
                        style={{ background: `${color}15` }}
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

              {/* Skills */}
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

              {/* AI Summary */}
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <MessageSquare size={13} /> AI Summary
                </h3>
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4">
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {candidate.summary}
                  </p>
                </div>
              </div>

              {/* Strengths & Improvements */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <CheckCircle size={13} className="text-emerald-500" />{" "}
                    Strengths
                  </h3>
                  <div className="space-y-2">
                    {candidate.strengths.map((s) => (
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
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <AlertCircle size={13} className="text-amber-500" /> Areas
                    to Improve
                  </h3>
                  <div className="space-y-2">
                    {candidate.improvements.map((s) => (
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
              </div>

              {/* Score breakdown bar */}
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <BarChart2 size={13} /> Score Breakdown
                </h3>
                <div className="space-y-3">
                  {candidate.answers.map((a) => (
                    <div key={a.q}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-gray-600 truncate max-w-[70%]">
                          {a.q}
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
            </div>
          )}

          {/* Q&A TAB */}
          {activeTab === "answers" && (
            <div className="space-y-4">
              {candidate.answers.map((a, i) => (
                <div
                  key={i}
                  className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600 shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <p className="text-sm font-semibold text-gray-800">
                        {a.q}
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
                    <span className="flex items-center gap-1.5 text-xs text-gray-400">
                      <Clock size={11} /> Answered in {a.time}
                    </span>
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${scoreBar(a.score)}`}
                        style={{ width: `${a.score}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* RECORDINGS TAB */}
          {activeTab === "recordings" && (
            <div className="space-y-4">
              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-start gap-3">
                <Video size={16} className="text-indigo-500 mt-0.5 shrink-0" />
                <p className="text-sm text-indigo-700">
                  Three recordings are available for each interview — screen
                  share, primary webcam, and mobile camera for a complete view
                  of the candidate.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <VideoCard
                  icon={Monitor}
                  label="Screen Recording"
                  subtitle="Full screen capture"
                  video={candidate.videos.screen}
                  color="#6366f1"
                />
                <VideoCard
                  icon={Camera}
                  label="Primary Camera"
                  subtitle="Webcam recording"
                  video={candidate.videos.primary}
                  color="#8b5cf6"
                />
                <VideoCard
                  icon={Smartphone}
                  label="Mobile Camera"
                  subtitle="Secondary angle"
                  video={candidate.videos.mobile}
                  color="#10b981"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Footer Actions ── */}
        {candidate.status === "pending" && (
          <div className="flex items-center justify-between px-7 py-4 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-400">
              Make your decision based on the interview results
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleDecision("reject")}
                disabled={!!deciding}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-red-500 bg-red-50 border border-red-200 hover:bg-red-100 transition-all disabled:opacity-60"
              >
                {deciding === "reject" ? (
                  <div className="w-4 h-4 border-2 border-red-300 border-t-red-500 rounded-full animate-spin" />
                ) : (
                  <XCircle size={15} />
                )}
                Reject
              </button>
              <button
                onClick={() => handleDecision("hire")}
                disabled={!!deciding}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md hover:shadow-lg transition-all disabled:opacity-60"
                style={{
                  background: "linear-gradient(135deg, #10b981, #059669)",
                }}
              >
                {deciding === "hire" ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <CheckCircle size={15} />
                )}
                Hire Candidate
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Candidate Card ───────────────────────────────────────────
const CandidateCard = ({ candidate, onClick }) => {
  const s = statusConfig[candidate.status];
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
              background: `linear-gradient(135deg, ${candidate.color}, ${candidate.color}cc)`,
            }}
          >
            {candidate.avatar}
          </div>
          <div>
            <p className="text-sm font-bold text-gray-800 group-hover:text-indigo-600 transition-colors">
              {candidate.name}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{candidate.role}</p>
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
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${scoreBg(candidate.score)}`}
        >
          <Star
            size={12}
            className={scoreColor(candidate.score)}
            fill="currentColor"
          />
          <span className={`text-sm font-black ${scoreColor(candidate.score)}`}>
            {candidate.score}
          </span>
          <span className="text-[10px] text-gray-400">/100</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Clock size={11} /> {candidate.duration}
        </div>
      </div>

      {/* Score bar */}
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-4">
        <div
          className={`h-full rounded-full ${scoreBar(candidate.score)}`}
          style={{ width: `${candidate.score}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[11px] text-gray-400 flex items-center gap-1">
          <Clock size={10} /> {candidate.date}
        </span>
        <span className="flex items-center gap-1 text-xs text-indigo-500 font-medium group-hover:gap-2 transition-all">
          View Details <ChevronRight size={13} />
        </span>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────
const CompanyInterviews = () => {
  const [candidates, setCandidates] = useState(CANDIDATES);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterJob, setFilterJob] = useState("all");

  const handleHire = (id) =>
    setCandidates((p) =>
      p.map((c) => (c.id === id ? { ...c, status: "hired" } : c)),
    );
  const handleReject = (id) =>
    setCandidates((p) =>
      p.map((c) => (c.id === id ? { ...c, status: "rejected" } : c)),
    );

  const filtered = candidates.filter((c) => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.role.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || c.status === filterStatus;
    const matchJob = filterJob === "all" || c.jobId === Number(filterJob);
    return matchSearch && matchStatus && matchJob;
  });

  const counts = {
    all: candidates.length,
    pending: candidates.filter((c) => c.status === "pending").length,
    hired: candidates.filter((c) => c.status === "hired").length,
    rejected: candidates.filter((c) => c.status === "rejected").length,
  };

  const avgScore = Math.round(
    candidates.reduce((a, c) => a + c.score, 0) / candidates.length,
  );

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
          </div>

          {/* Top stats */}
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
                label: "Avg. AI Score",
                value: avgScore,
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
                    <p className={`text-xl font-black ${colors.text}`}>
                      {value}
                    </p>
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
                onClick={() => setFilterStatus(s)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                  filterStatus === s
                    ? "bg-indigo-50 text-indigo-600"
                    : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                }`}
              >
                {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                <span
                  className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold ${
                    filterStatus === s
                      ? "bg-indigo-100 text-indigo-600"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {counts[s] ?? candidates.filter((c) => c.status === s).length}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* ── Search + filter bar ── */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="relative flex-1 min-w-50">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all"
              placeholder="Search candidates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="relative">
            <Filter
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <select
              className="pl-8 pr-8 py-2.5 rounded-xl border border-gray-200 text-sm bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all appearance-none cursor-pointer text-gray-600"
              value={filterJob}
              onChange={(e) => setFilterJob(e.target.value)}
            >
              <option value="all">All Jobs</option>
              {JOBS.map((j) => (
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

        {/* ── Per-job sections ── */}
        {filterJob === "all" ? (
          <div className="space-y-8">
            {JOBS.map((job) => {
              const jobCandidates = filtered.filter((c) => c.jobId === job.id);
              if (jobCandidates.length === 0) return null;
              return (
                <div key={job.id}>
                  {/* Job header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                      <Briefcase size={14} className="text-indigo-500" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-gray-800">
                        {job.title}
                      </h2>
                      <p className="text-xs text-gray-400">
                        {jobCandidates.length} candidate
                        {jobCandidates.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {jobCandidates.map((c) => (
                      <CandidateCard
                        key={c.id}
                        candidate={c}
                        onClick={() => setSelected(c)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((c) => (
              <CandidateCard
                key={c.id}
                candidate={c}
                onClick={() => setSelected(c)}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {filtered.length === 0 && (
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

      {/* ── Modal ── */}
      {selected && (
        <CandidateModal
          candidate={candidates.find((c) => c.id === selected.id)}
          onClose={() => setSelected(null)}
          onHire={handleHire}
          onReject={handleReject}
        />
      )}
    </div>
  );
};

export default CompanyInterviews;

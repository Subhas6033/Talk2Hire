import {
  MapPin,
  Briefcase,
  Clock,
  DollarSign,
  GraduationCap,
  Tag,
  ArrowLeft,
  Building2,
  ChevronRight,
} from "lucide-react";
import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchJobById } from "../API/jobApi";

const parseSkills = (skills) => {
  if (Array.isArray(skills)) return skills;
  if (typeof skills === "string") {
    try {
      return JSON.parse(skills);
    } catch {
      return skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return [];
};

const UserJobDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { selectedJob: job, loading, error } = useSelector((s) => s.jobs);

  useEffect(() => {
    if (id) dispatch(fetchJobById(id));
  }, [id, dispatch]);

  if (loading.fetch)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  if (error || !job)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-textLight/50">{error || "Job not found"}</p>
        <button
          onClick={() => navigate("/jobs")}
          className="text-sm text-indigo-400 hover:underline"
        >
          ← Back to Jobs
        </button>
      </div>
    );

  const skills = parseSkills(job.skills);
  const typeColors = {
    "Full-time": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    "Part-time": "bg-blue-500/10 text-blue-400 border-blue-500/20",
    Contract: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    Internship: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    Remote: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Back */}
        <button
          onClick={() => navigate("/jobs")}
          className="flex items-center gap-2 text-sm text-textLight/50 hover:text-textLight transition-colors mb-6"
        >
          <ArrowLeft size={15} /> Back to Jobs
        </button>

        {/* Header card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
                {job.companyName
                  ?.split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase() || "CO"}
              </div>
              <div>
                <h1 className="text-xl font-bold text-textLight">
                  {job.title}
                </h1>
                <p className="text-textLight/50 mt-0.5 flex items-center gap-1.5">
                  <Building2 size={13} /> {job.companyName || "Company"}
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate(`/interview?jobId=${job.id}`)}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-900/30"
            >
              Apply Now <ChevronRight size={15} />
            </button>
          </div>

          {/* Meta */}
          <div className="flex flex-wrap gap-4 mt-5 pt-5 border-t border-white/10 text-sm text-textLight/50">
            {job.location && (
              <span className="flex items-center gap-1.5">
                <MapPin size={13} /> {job.location}
              </span>
            )}
            {job.type && (
              <span
                className={`flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${typeColors[job.type] || "bg-white/5 text-textLight/50 border-white/10"}`}
              >
                {job.type}
              </span>
            )}
            {job.experience && (
              <span className="flex items-center gap-1.5">
                <GraduationCap size={13} /> {job.experience}
              </span>
            )}
            {job.salary && (
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <DollarSign size={13} /> {job.salary}
              </span>
            )}
            {job.posted && (
              <span className="flex items-center gap-1.5">
                <Clock size={13} /> Posted {job.posted}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Left — main content */}
          <div className="md:col-span-2 flex flex-col gap-5">
            {job.description && (
              <Section title="About the Role">
                <p className="text-textLight/60 text-sm leading-relaxed whitespace-pre-line">
                  {job.description}
                </p>
              </Section>
            )}
            {job.responsibilities && (
              <Section title="Responsibilities">
                <p className="text-textLight/60 text-sm leading-relaxed whitespace-pre-line">
                  {job.responsibilities}
                </p>
              </Section>
            )}
            {job.requirements && (
              <Section title="Requirements">
                <p className="text-textLight/60 text-sm leading-relaxed whitespace-pre-line">
                  {job.requirements}
                </p>
              </Section>
            )}
          </div>

          {/* Right — sidebar */}
          <div className="flex flex-col gap-5">
            {skills.length > 0 && (
              <Section title="Required Skills">
                <div className="flex flex-wrap gap-2">
                  {skills.map((sk) => (
                    <span
                      key={sk}
                      className="flex items-center gap-1 text-xs px-2.5 py-1 bg-indigo-500/10 text-indigo-400 rounded-lg font-medium border border-indigo-500/20"
                    >
                      <Tag size={10} /> {sk}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            <Section title="Job Details">
              <div className="flex flex-col gap-3 text-sm">
                {job.department && (
                  <DetailRow label="Department" value={job.department} />
                )}
                {job.type && <DetailRow label="Type" value={job.type} />}
                {job.experience && (
                  <DetailRow label="Experience" value={job.experience} />
                )}
                {job.salary && <DetailRow label="Salary" value={job.salary} />}
                {job.location && (
                  <DetailRow label="Location" value={job.location} />
                )}
              </div>
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
};

const Section = ({ title, children }) => (
  <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
    <h2 className="text-sm font-semibold text-textLight mb-3">{title}</h2>
    {children}
  </div>
);

const DetailRow = ({ label, value }) => (
  <div className="flex items-center justify-between">
    <span className="text-textLight/40">{label}</span>
    <span className="text-textLight/70 font-medium">{value}</span>
  </div>
);

export default UserJobDetail;

import React, { useState } from "react";
import { Card } from "../Common/Card";
import Button from "../Common/Button";

const jobSectors = ["Technology", "Finance", "Healthcare", "Education"];
const jobRoles = [
  "Frontend Developer",
  "Backend Developer",
  "Data Scientist",
  "QA Engineer",
];
const experienceLevels = ["Intern", "Junior", "Mid-level", "Senior"];
const difficultyLevels = ["Easy", "Medium", "Hard"];

const ConfigureInterview = ({ onStart }) => {
  const [resume, setResume] = useState(null);
  const [sector, setSector] = useState("");
  const [role, setRole] = useState("");
  const [experience, setExperience] = useState("");
  const [difficulty, setDifficulty] = useState("");

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) setResume(file);
  };

  const handleStart = () => {
    if (!resume || !sector || !role || !experience || !difficulty) {
      alert("Please fill all fields and upload your resume.");
      return;
    }
    const config = { resume, sector, role, experience, difficulty };
    onStart?.(config);
  };

  return (
    <div className="max-w-3xl mx-auto py-16 px-6">
      <Card variant="glow" padding="lg">
        <h2 className="text-2xl font-bold text-white mb-2 text-center">
          Configure Your Interview
        </h2>
        <p className="text-white/60 text-sm mb-6 text-center">
          Upload your resume and select your preferences to begin
        </p>

        {/* Resume Upload */}
        <label className="block border-2 border-dashed border-white/20 rounded-xl p-12 text-center cursor-pointer hover:border-purpleGlow transition-colors mb-6">
          <input
            type="file"
            accept=".pdf,.doc,.docx"
            className="hidden"
            onChange={handleFileUpload}
          />
          <div className="flex flex-col items-center justify-center gap-2 text-white/70">
            <svg
              className="w-8 h-8 text-white/50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 12v8M12 12l-4-4m4 4l4-4M12 4v4"
              />
            </svg>
            <span className="font-semibold text-white">Upload Your Resume</span>
            <span className="text-xs text-white/40">
              Drag & drop your resume here, or click to browse
            </span>
            <span className="text-xs text-white/40">PDF, DOCX</span>
            {resume && (
              <p className="text-xs text-purpleGlow mt-2">{resume.name}</p>
            )}
          </div>
        </label>

        {/* Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-xs text-white/60 mb-1">
              Job Sector
            </label>
            <select
              className="w-full rounded-xl bg-white/5 backdrop-blur-xl px-4 py-3 text-white/75 border border-white/10 focus:outline-none focus:border-purpleGlow focus:ring-2 focus:ring-purpleGlow/40 transition"
              value={sector}
              onChange={(e) => setSector(e.target.value)}
            >
              <option value="">Select sector</option>
              {jobSectors.map((s, i) => (
                <option key={i} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-white/60 mb-1">Job Role</label>
            <select
              className="w-full rounded-xl bg-white/5 backdrop-blur-xl px-4 py-3 text-white/75 border border-white/10 focus:outline-none focus:border-purpleGlow focus:ring-2 focus:ring-purpleGlow/40 transition"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="">Select role</option>
              {jobRoles.map((r, i) => (
                <option key={i} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-white/60 mb-1">
              Experience Level
            </label>
            <select
              className="w-full rounded-xl bg-white/5 backdrop-blur-xl px-4 py-3 text-white/75 border border-white/10 focus:outline-none focus:border-purpleGlow focus:ring-2 focus:ring-purpleGlow/40 transition"
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
            >
              <option value="">Select experience</option>
              {experienceLevels.map((exp, i) => (
                <option key={i} value={exp}>
                  {exp}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-white/60 mb-1">
              Difficulty Level
            </label>
            <select
              className="w-full rounded-xl bg-white/5 backdrop-blur-xl px-4 py-3 text-white/75 border border-white/10 focus:outline-none focus:border-purpleGlow focus:ring-2 focus:ring-purpleGlow/40 transition"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              <option value="">Select difficulty</option>
              {difficultyLevels.map((d, i) => (
                <option key={i} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Start Button */}
        <Button
          size="lg"
          className="w-full"
          variant="primary"
          onClick={handleStart}
        >
          Start Interview &rarr;
        </Button>
      </Card>
    </div>
  );
};

export default ConfigureInterview;

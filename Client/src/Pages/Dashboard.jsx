import { useState } from "react";
import { Button, Modal } from "../Components/index";
import { Card, CardHeader, CardBody } from "../Components/Common/Card";
import {
  Trophy,
  Target,
  TrendingUp,
  Clock,
  Award,
  Brain,
  MessageSquare,
  BarChart3,
  Calendar,
  Download,
  Share2,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const [selectedInterview, setSelectedInterview] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const navigate = useNavigate();

  const dashboardStats = {
    totalInterviews: 12,
    averageScore: 78,
    improvementRate: 15,
    totalTime: "8h 45m",
  };

  const recentInterviews = [
    {
      id: 1,
      role: "Senior Frontend Developer",
      date: "2024-02-05",
      score: 85,
      duration: "45 min",
      status: "completed",
      questions: 10,
      correctAnswers: 8,
      strengths: ["React Hooks", "State Management", "Performance"],
      improvements: ["Testing", "Accessibility"],
      feedback:
        "Great understanding of React fundamentals. Focus on testing strategies.",
    },
    {
      id: 2,
      role: "Full Stack Developer",
      date: "2024-02-03",
      score: 72,
      duration: "50 min",
      status: "completed",
      questions: 12,
      correctAnswers: 9,
      strengths: ["API Design", "Database", "Node.js"],
      improvements: ["Security", "Scalability"],
      feedback:
        "Solid backend knowledge. Consider learning more about security best practices.",
    },
    {
      id: 3,
      role: "React Developer",
      date: "2024-02-01",
      score: 68,
      duration: "40 min",
      status: "completed",
      questions: 8,
      correctAnswers: 5,
      strengths: ["Component Design", "JSX"],
      improvements: ["Hooks", "Context API", "Custom Hooks"],
      feedback:
        "Good start with React. Practice more with advanced hooks patterns.",
    },
  ];

  const skillProgress = [
    { skill: "React", level: 85, trend: "up" },
    { skill: "JavaScript", level: 78, trend: "up" },
    { skill: "Node.js", level: 72, trend: "stable" },
    { skill: "TypeScript", level: 65, trend: "up" },
    { skill: "System Design", level: 58, trend: "down" },
  ];

  const handleViewDetails = (interview) => {
    setSelectedInterview(interview);
    setIsDetailModalOpen(true);
  };

  const getScoreColor = (score) => {
    if (score >= 80) return "text-green-400";
    if (score >= 60) return "text-yellow-400";
    return "text-red-400";
  };

  const getScoreBgColor = (score) => {
    if (score >= 80) return "bg-green-500/20 border-green-500/30";
    if (score >= 60) return "bg-yellow-500/20 border-yellow-500/30";
    return "bg-red-500/20 border-red-500/30";
  };

  return (
    // Removed bg-linear-to-br — Layout already provides the dark background.
    // Keeping only spacing/layout classes here.
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Interview Dashboard
            </h1>
            <p className="text-white/60">
              Track your progress and improve your interview skills
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" size="sm">
              <Download size={16} className="mr-2" />
              Export Report
            </Button>
            <Button variant="secondary" size="sm">
              <Share2 size={16} className="mr-2" />
              Share Progress
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card variant="glow" padding="md" hoverable>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm mb-1">Total Interviews</p>
                <p className="text-3xl font-bold text-white">
                  {dashboardStats.totalInterviews}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purpleGlow/20 flex items-center justify-center">
                <MessageSquare className="text-purpleGlow" size={24} />
              </div>
            </div>
          </Card>

          <Card variant="glow" padding="md" hoverable>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm mb-1">Average Score</p>
                <p className="text-3xl font-bold text-green-400">
                  {dashboardStats.averageScore}%
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                <Trophy className="text-green-400" size={24} />
              </div>
            </div>
          </Card>

          <Card variant="glow" padding="md" hoverable>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm mb-1">Improvement</p>
                <p className="text-3xl font-bold text-yellow-400">
                  +{dashboardStats.improvementRate}%
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                <TrendingUp className="text-yellow-400" size={24} />
              </div>
            </div>
          </Card>

          <Card variant="glow" padding="md" hoverable>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm mb-1">Total Time</p>
                <p className="text-3xl font-bold text-blue-400">
                  {dashboardStats.totalTime}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Clock className="text-blue-400" size={24} />
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Interviews */}
          <div className="lg:col-span-2">
            <Card variant="glow" padding="lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="text-purpleGlow" size={20} />
                    <span className="text-white">Recent Interviews</span>
                  </div>
                  <Button variant="ghost" size="sm">
                    View All
                  </Button>
                </div>
              </CardHeader>
              <CardBody>
                <div className="space-y-3">
                  {recentInterviews.map((interview) => (
                    <motion.div
                      key={interview.id}
                      whileHover={{ scale: 1.01 }}
                      className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-purpleGlow/40 transition cursor-pointer"
                      onClick={() => handleViewDetails(interview)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="text-white font-semibold mb-1">
                            {interview.role}
                          </h3>
                          <div className="flex items-center gap-4 text-xs text-white/60">
                            <span className="flex items-center gap-1">
                              <Calendar size={12} />
                              {interview.date}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock size={12} />
                              {interview.duration}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageSquare size={12} />
                              {interview.questions} questions
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div
                            className={`px-3 py-1 rounded-lg border ${getScoreBgColor(interview.score)}`}
                          >
                            <span
                              className={`text-lg font-bold ${getScoreColor(interview.score)}`}
                            >
                              {interview.score}%
                            </span>
                          </div>
                          <ChevronRight className="text-white/40" size={20} />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Skill Progress */}
          <div>
            <Card variant="glow" padding="lg">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <BarChart3 className="text-purpleGlow" size={20} />
                  <span className="text-white">Skill Progress</span>
                </div>
              </CardHeader>
              <CardBody>
                <div className="space-y-4">
                  {skillProgress.map((skill, index) => (
                    <div key={index}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-white/80">
                          {skill.skill}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white">
                            {skill.level}%
                          </span>
                          {skill.trend === "up" && (
                            <TrendingUp size={14} className="text-green-400" />
                          )}
                          {skill.trend === "down" && (
                            <TrendingUp
                              size={14}
                              className="text-red-400 rotate-180"
                            />
                          )}
                        </div>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${skill.level}%` }}
                          transition={{ duration: 1, delay: index * 0.1 }}
                          className="h-full bg-linear-to-r from-purpleGlow to-purpleSoft"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </div>
        </div>

        {/* Call to Action */}
        <Card variant="glow" padding="lg">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-purpleGlow/20 flex items-center justify-center">
                <Brain className="text-purpleGlow" size={32} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-1">
                  Ready for your next challenge?
                </h3>
                <p className="text-white/60">
                  Practice makes perfect. Start a new interview session now.
                </p>
              </div>
            </div>
            <Button size="lg" onClick={() => navigate("/interview")}>
              <Target size={18} className="mr-2" />
              Start New Interview
            </Button>
          </div>
        </Card>
      </div>

      {/* Detail Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Interview Details"
        size="lg"
      >
        {selectedInterview && (
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold text-white mb-2">
                  {selectedInterview.role}
                </h3>
                <div className="flex items-center gap-4 text-sm text-white/60">
                  <span className="flex items-center gap-1">
                    <Calendar size={14} />
                    {selectedInterview.date}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={14} />
                    {selectedInterview.duration}
                  </span>
                </div>
              </div>
              <div
                className={`px-4 py-2 rounded-xl border ${getScoreBgColor(selectedInterview.score)}`}
              >
                <span
                  className={`text-2xl font-bold ${getScoreColor(selectedInterview.score)}`}
                >
                  {selectedInterview.score}%
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <p className="text-white/60 text-sm mb-1">Questions Asked</p>
                <p className="text-2xl font-bold text-white">
                  {selectedInterview.questions}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <p className="text-white/60 text-sm mb-1">Correct Answers</p>
                <p className="text-2xl font-bold text-green-400">
                  {selectedInterview.correctAnswers}
                </p>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="text-green-400" size={18} />
                <h4 className="text-white font-semibold">Strengths</h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedInterview.strengths.map((strength, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 rounded-lg bg-green-500/20 border border-green-500/30 text-green-400 text-sm"
                  >
                    {strength}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="text-yellow-400" size={18} />
                <h4 className="text-white font-semibold">
                  Areas for Improvement
                </h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedInterview.improvements.map((improvement, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 rounded-lg bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-sm"
                  >
                    {improvement}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-purpleGlow/10 border border-purpleGlow/30">
              <div className="flex items-center gap-2 mb-2">
                <Award className="text-purpleGlow" size={18} />
                <h4 className="text-white font-semibold">AI Feedback</h4>
              </div>
              <p className="text-white/80 text-sm leading-relaxed">
                {selectedInterview.feedback}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Dashboard;

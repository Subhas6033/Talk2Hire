import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button, CandidateFilter } from "../Components/index";
import { Card } from "../Components/Common/Card";

const candidates = [
  {
    id: 1,
    name: "Alexandra Chen",
    role: "Senior Product Designer",
    location: "San Francisco, CA",
    experience: "8 years",
    avatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop",
    banner:
      "https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=1200&h=400&fit=crop",
    interviewScore: 92,
    technicalScore: 88,
    culturalFit: 95,
    skills: [
      "UI/UX Design",
      "Figma",
      "Design Systems",
      "User Research",
      "Prototyping",
      "Adobe Creative Suite",
      "Wireframing",
      "Visual Design",
    ],
    education: "BFA in Graphic Design, Rhode Island School of Design",
    bio: "Award-winning product designer with 8+ years of experience crafting beautiful, user-centered digital experiences. Led design teams at Fortune 500 companies and innovative startups. Passionate about creating accessible and inclusive design systems.",
    previousCompanies: ["Airbnb", "Adobe", "IDEO"],
    portfolio: "alexandrachen.design",
    email: "alex.chen@email.com",
    phone: "+1 (555) 123-4567",
  },
  {
    id: 2,
    name: "Marcus Johnson",
    role: "Full Stack Engineer",
    location: "Austin, TX",
    experience: "6 years",
    avatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop",
    banner:
      "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&h=400&fit=crop",
    interviewScore: 89,
    technicalScore: 94,
    culturalFit: 87,
    skills: [
      "React",
      "Node.js",
      "TypeScript",
      "GraphQL",
      "AWS",
      "Docker",
      "PostgreSQL",
      "Redis",
      "Microservices",
    ],
    education: "BS in Computer Science, MIT",
    bio: "Versatile full-stack engineer specializing in scalable web applications and cloud infrastructure. Strong advocate for clean code, automated testing, and continuous integration. Open source contributor with multiple projects on GitHub.",
    previousCompanies: ["Stripe", "Microsoft", "Shopify"],
    portfolio: "github.com/marcusj",
    email: "marcus.j@email.com",
    phone: "+1 (555) 234-5678",
  },
  {
    id: 3,
    name: "Priya Sharma",
    role: "Data Scientist",
    location: "New York, NY",
    experience: "5 years",
    avatar:
      "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop",
    banner:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=400&fit=crop",
    interviewScore: 91,
    technicalScore: 96,
    culturalFit: 90,
    skills: [
      "Python",
      "Machine Learning",
      "TensorFlow",
      "SQL",
      "Data Visualization",
      "Statistics",
      "PyTorch",
      "Deep Learning",
      "NLP",
    ],
    education: "PhD in Data Science, Stanford University",
    bio: "Data scientist with expertise in machine learning, predictive analytics, and data-driven decision making. Published researcher with papers in top-tier ML conferences. Passionate about using data to solve real-world problems.",
    previousCompanies: ["Google", "McKinsey", "DataRobot"],
    portfolio: "priyasharma.ai",
    email: "priya.sharma@email.com",
    phone: "+1 (555) 345-6789",
  },
  {
    id: 4,
    name: "James O'Connor",
    role: "DevOps Engineer",
    location: "Seattle, WA",
    experience: "7 years",
    avatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop",
    banner:
      "https://images.unsplash.com/photo-1518432031352-d6fc5c10da5a?w=1200&h=400&fit=crop",
    interviewScore: 86,
    technicalScore: 91,
    culturalFit: 88,
    skills: [
      "Kubernetes",
      "Terraform",
      "CI/CD",
      "AWS",
      "Monitoring",
      "Automation",
      "Jenkins",
      "Ansible",
    ],
    education: "BS in Information Systems, University of Washington",
    bio: "DevOps engineer focused on building reliable, scalable infrastructure. Expert in container orchestration, infrastructure as code, and automated deployment pipelines. Committed to improving development velocity and system reliability.",
    previousCompanies: ["Amazon", "Netflix", "HashiCorp"],
    portfolio: "jamesoconnor.dev",
    email: "james.oconnor@email.com",
    phone: "+1 (555) 456-7890",
  },
  {
    id: 5,
    name: "Sofia Rodriguez",
    role: "Product Manager",
    location: "Los Angeles, CA",
    experience: "9 years",
    avatar:
      "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop",
    banner:
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&h=400&fit=crop",
    interviewScore: 94,
    technicalScore: 85,
    culturalFit: 97,
    skills: [
      "Product Strategy",
      "Roadmapping",
      "Analytics",
      "A/B Testing",
      "Stakeholder Management",
      "Agile",
      "User Stories",
      "Market Research",
    ],
    education: "MBA, Harvard Business School",
    bio: "Strategic product manager with a track record of launching successful products from conception to scale. Data-driven decision maker with strong technical background and exceptional communication skills. Passionate about building products users love.",
    previousCompanies: ["Meta", "Uber", "LinkedIn"],
    portfolio: "sofiarodriguez.com",
    email: "sofia.rodriguez@email.com",
    phone: "+1 (555) 567-8901",
  },
  {
    id: 6,
    name: "David Kim",
    role: "iOS Developer",
    location: "Boston, MA",
    experience: "4 years",
    avatar:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop",
    banner:
      "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=1200&h=400&fit=crop",
    interviewScore: 87,
    technicalScore: 90,
    culturalFit: 86,
    skills: [
      "Swift",
      "SwiftUI",
      "UIKit",
      "Core Data",
      "iOS Performance",
      "App Store Optimization",
      "XCTest",
      "Combine",
    ],
    education: "BS in Software Engineering, Carnegie Mellon",
    bio: "iOS developer passionate about creating smooth, delightful mobile experiences. Strong focus on performance optimization and user experience. Multiple apps in the App Store with millions of downloads.",
    previousCompanies: ["Apple", "Spotify", "Twitter"],
    portfolio: "davidkim.io",
    email: "david.kim@email.com",
    phone: "+1 (555) 678-9012",
  },
];

// ============ MAIN COMPONENT ============

export default function HiringLandingPage() {
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [filters, setFilters] = useState({
    search: "",
    role: "",
    location: "",
    minScore: 0,
  });

  const filteredCandidates = candidates.filter((candidate) => {
    const matchesSearch =
      candidate.name.toLowerCase().includes(filters.search.toLowerCase()) ||
      candidate.role.toLowerCase().includes(filters.search.toLowerCase()) ||
      candidate.skills.some((skill) =>
        skill.toLowerCase().includes(filters.search.toLowerCase())
      );
    const matchesRole = !filters.role || candidate.role.includes(filters.role);
    const matchesLocation =
      !filters.location ||
      candidate.location.toLowerCase().includes(filters.location.toLowerCase());
    const matchesScore = candidate.interviewScore >= filters.minScore;

    return matchesSearch && matchesRole && matchesLocation && matchesScore;
  });

  return (
    <div className="min-h-screen bg-linear-to-br from-[#0A0118] via-[#1A0B2E] to-[#0F051D] text-white overflow-hidden">
      {/* Ambient background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-150 h-150 bg-purpleGlow/15 rounded-full blur-[140px] animate-pulse"></div>
        <div
          className="absolute bottom-0 right-1/4 w-175 h-175 bg-purpleSoft/10 rounded-full blur-[160px] animate-pulse"
          style={{ animationDelay: "2s" }}
        ></div>
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-125 h-125 bg-blue-500/5 rounded-full blur-[120px] animate-pulse"
          style={{ animationDelay: "4s" }}
        ></div>
      </div>

      <div className="relative">
        {/* Main Content */}
        <div className="max-w-425 mx-auto px-8 py-12">
          <div className="flex gap-8">
            {/* Filters Sidebar */}
            <CandidateFilter
              filters={filters}
              setFilters={setFilters}
              totalCandidates={candidates.length}
              filteredCount={filteredCandidates.length}
            />

            {/* Candidates Grid */}
            <div className="flex-1 min-w-0">
              {/* Header */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="mb-8"
              >
                <h1
                  className="text-5xl font-bold mb-3 bg-linear-to-r from-white via-purpleSoft to-white bg-clip-text text-transparent"
                  style={{ fontFamily: "'Cormorant Garamond', serif" }}
                >
                  Discover Talent
                </h1>
                <p
                  className="text-white/60 text-lg"
                  style={{ fontFamily: "'Spectral', serif" }}
                >
                  {filteredCandidates.length}{" "}
                  {filteredCandidates.length === 1
                    ? "exceptional candidate"
                    : "exceptional candidates"}{" "}
                  ready to join your team
                </p>
              </motion.div>

              {/* Candidates List */}
              <div className="space-y-5">
                {filteredCandidates.map((candidate, index) => (
                  <motion.div
                    key={candidate.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.4 + index * 0.08 }}
                  >
                    <Card
                      variant="default"
                      hoverable
                      className="overflow-hidden group cursor-pointer"
                      onClick={() => setSelectedCandidate(candidate)}
                    >
                      <div className="flex gap-6">
                        {/* Avatar */}
                        <div className="relative shrink-0">
                          <div className="w-28 h-28 rounded-2xl overflow-hidden border-2 border-purpleGlow/30 shadow-[0_0_20px_rgba(155,92,255,0.3)] group-hover:border-purpleGlow/60 transition-all duration-300">
                            <img
                              src={candidate.avatar}
                              alt={candidate.name}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            />
                          </div>
                          <div className="absolute -bottom-2 -right-2 bg-linear-to-r from-purpleGlow to-purpleSoft text-white text-sm font-bold px-4 py-1.5 rounded-full shadow-[0_4px_20px_rgba(155,92,255,0.5)]">
                            {candidate.interviewScore}
                          </div>
                        </div>

                        {/* Candidate Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <div>
                              <h3
                                className="text-2xl font-bold text-white mb-1 group-hover:text-purpleSoft transition-colors"
                                style={{
                                  fontFamily: "'Cormorant Garamond', serif",
                                }}
                              >
                                {candidate.name}
                              </h3>
                              <p
                                className="text-purpleSoft font-medium text-base"
                                style={{ fontFamily: "'Spectral', serif" }}
                              >
                                {candidate.role}
                              </p>
                            </div>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCandidate(candidate);
                              }}
                            >
                              View Full Profile
                            </Button>
                          </div>

                          <div className="flex items-center gap-6 text-sm text-white/70 mb-4">
                            <div className="flex items-center gap-2">
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                />
                              </svg>
                              {candidate.location}
                            </div>
                            <div className="flex items-center gap-2">
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                />
                              </svg>
                              {candidate.experience}
                            </div>
                          </div>

                          {/* Interview Scores */}
                          <div className="grid grid-cols-3 gap-4 mb-4">
                            <div className="bg-linear-to-br from-purpleGlow/10 to-purpleSoft/5 rounded-xl p-3 border border-purpleGlow/20">
                              <div className="text-xs text-white/60 mb-1.5 font-medium">
                                Interview
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{
                                      width: `${candidate.interviewScore}%`,
                                    }}
                                    transition={{
                                      duration: 1,
                                      delay: 0.5 + index * 0.1,
                                    }}
                                    className="h-full bg-linear-to-r from-purpleGlow to-purpleSoft rounded-full"
                                  ></motion.div>
                                </div>
                                <span className="text-sm font-bold text-purpleGlow">
                                  {candidate.interviewScore}
                                </span>
                              </div>
                            </div>
                            <div className="bg-linear-to-br from-blue-500/10 to-blue-600/5 rounded-xl p-3 border border-blue-400/20">
                              <div className="text-xs text-white/60 mb-1.5 font-medium">
                                Technical
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{
                                      width: `${candidate.technicalScore}%`,
                                    }}
                                    transition={{
                                      duration: 1,
                                      delay: 0.6 + index * 0.1,
                                    }}
                                    className="h-full bg-linear-to-r from-blue-400 to-blue-600 rounded-full"
                                  ></motion.div>
                                </div>
                                <span className="text-sm font-bold text-blue-400">
                                  {candidate.technicalScore}
                                </span>
                              </div>
                            </div>
                            <div className="bg-linear-to-br from-green-400/10 to-emerald-600/5 rounded-xl p-3 border border-green-400/20">
                              <div className="text-xs text-white/60 mb-1.5 font-medium">
                                Cultural Fit
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{
                                      width: `${candidate.culturalFit}%`,
                                    }}
                                    transition={{
                                      duration: 1,
                                      delay: 0.7 + index * 0.1,
                                    }}
                                    className="h-full bg-linear-to-r from-green-400 to-emerald-600 rounded-full"
                                  ></motion.div>
                                </div>
                                <span className="text-sm font-bold text-green-400">
                                  {candidate.culturalFit}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Top Skills */}
                          <div className="flex flex-wrap gap-2">
                            {candidate.skills.slice(0, 6).map((skill, idx) => (
                              <span
                                key={idx}
                                className="px-3 py-1.5 bg-white/5 border border-white/10 text-xs text-white/80 rounded-lg hover:border-purpleGlow/40 hover:bg-purpleGlow/5 transition-all"
                              >
                                {skill}
                              </span>
                            ))}
                            {candidate.skills.length > 6 && (
                              <span className="px-3 py-1.5 text-xs text-purpleSoft font-medium">
                                +{candidate.skills.length - 6} more
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>

              {/* Empty State */}
              {filteredCandidates.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5 }}
                >
                  <Card variant="default" className="text-center py-20">
                    <div className="max-w-md mx-auto">
                      <div className="w-20 h-20 bg-linear-to-br from-purpleGlow/20 to-purpleSoft/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <svg
                          className="w-10 h-10 text-purpleSoft"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                          />
                        </svg>
                      </div>
                      <h3
                        className="text-2xl font-semibold text-white/80 mb-3"
                        style={{ fontFamily: "'Cormorant Garamond', serif" }}
                      >
                        No candidates found
                      </h3>
                      <p
                        className="text-white/50 mb-6"
                        style={{ fontFamily: "'Spectral', serif" }}
                      >
                        Try adjusting your filters to discover more exceptional
                        talent
                      </p>
                      <Button
                        variant="secondary"
                        size="md"
                        onClick={() =>
                          setFilters({
                            search: "",
                            role: "",
                            location: "",
                            minScore: 0,
                          })
                        }
                      >
                        Reset Filters
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Profile Modal */}
      <AnimatePresence>
        {selectedCandidate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#0A0118]/95 backdrop-blur-md z-50 flex items-center justify-center p-6"
            onClick={() => setSelectedCandidate(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-[#12091F] border border-purpleGlow/30 rounded-3xl shadow-[0_0_100px_rgba(155,92,255,0.3)] max-w-5xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Banner with Gradient Overlay */}
              <div className="relative h-52 overflow-hidden">
                <img
                  src={selectedCandidate.banner}
                  alt="Banner"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-linear-to-t from-[#12091F] via-[#12091F]/70 to-transparent"></div>

                {/* Close Button */}
                <button
                  onClick={() => setSelectedCandidate(null)}
                  className="absolute top-5 right-5 w-11 h-11 bg-black/60 backdrop-blur-xl rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-black/80 transition-all border border-white/10 hover:border-white/20"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Profile Content */}
              <div className="p-8 overflow-y-auto max-h-[calc(90vh-13rem)]">
                {/* Header with Avatar */}
                <div className="flex items-start gap-8 mb-8 -mt-24">
                  <div className="relative shrink-0">
                    <div className="w-36 h-36 rounded-3xl overflow-hidden border-4 border-[#12091F] shadow-[0_0_40px_rgba(155,92,255,0.5)]">
                      <img
                        src={selectedCandidate.avatar}
                        alt={selectedCandidate.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="absolute -bottom-3 -right-3 bg-linear-to-r from-purpleGlow to-purpleSoft text-white text-base font-bold px-5 py-2 rounded-2xl shadow-lg">
                      Score: {selectedCandidate.interviewScore}
                    </div>
                  </div>

                  <div className="flex-1 pt-16">
                    <h2
                      className="text-4xl font-bold text-white mb-2"
                      style={{ fontFamily: "'Cormorant Garamond', serif" }}
                    >
                      {selectedCandidate.name}
                    </h2>
                    <p
                      className="text-2xl text-purpleSoft mb-5"
                      style={{ fontFamily: "'Spectral', serif" }}
                    >
                      {selectedCandidate.role}
                    </p>
                    <div className="flex flex-wrap gap-4 text-sm text-white/70">
                      <div className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-lg">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                        </svg>
                        {selectedCandidate.location}
                      </div>
                      <div className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-lg">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                          />
                        </svg>
                        {selectedCandidate.experience}
                      </div>
                      <div className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-lg">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                          />
                        </svg>
                        {selectedCandidate.email}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Assessment Scores */}
                <div className="grid grid-cols-3 gap-5 mb-10">
                  <div className="bg-linear-to-br from-purpleGlow/15 to-purpleSoft/10 border border-purpleGlow/30 rounded-2xl p-6">
                    <div className="text-sm text-white/60 mb-3 font-medium">
                      Interview Performance
                    </div>
                    <div className="text-5xl font-bold bg-linear-to-r from-purpleGlow to-purpleSoft bg-clip-text text-transparent mb-3">
                      {selectedCandidate.interviewScore}
                    </div>
                    <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: `${selectedCandidate.interviewScore}%`,
                        }}
                        transition={{ duration: 1.2, delay: 0.2 }}
                        className="h-full bg-linear-to-r from-purpleGlow to-purpleSoft rounded-full"
                      ></motion.div>
                    </div>
                  </div>
                  <div className="bg-linear-to-br from-blue-500/15 to-blue-600/10 border border-blue-400/30 rounded-2xl p-6">
                    <div className="text-sm text-white/60 mb-3 font-medium">
                      Technical Skills
                    </div>
                    <div className="text-5xl font-bold text-blue-400 mb-3">
                      {selectedCandidate.technicalScore}
                    </div>
                    <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: `${selectedCandidate.technicalScore}%`,
                        }}
                        transition={{ duration: 1.2, delay: 0.3 }}
                        className="h-full bg-linear-to-r from-blue-400 to-blue-600 rounded-full"
                      ></motion.div>
                    </div>
                  </div>
                  <div className="bg-linear-to-br from-green-400/15 to-emerald-600/10 border border-green-400/30 rounded-2xl p-6">
                    <div className="text-sm text-white/60 mb-3 font-medium">
                      Culture Alignment
                    </div>
                    <div className="text-5xl font-bold text-green-400 mb-3">
                      {selectedCandidate.culturalFit}
                    </div>
                    <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${selectedCandidate.culturalFit}%` }}
                        transition={{ duration: 1.2, delay: 0.4 }}
                        className="h-full bg-linear-to-r from-green-400 to-emerald-600 rounded-full"
                      ></motion.div>
                    </div>
                  </div>
                </div>

                {/* Skills Section - Prominent Display */}
                <div className="mb-10">
                  <h3
                    className="text-2xl font-semibold text-white mb-5 flex items-center gap-3"
                    style={{ fontFamily: "'Cormorant Garamond', serif" }}
                  >
                    <div className="w-8 h-8 bg-linear-to-br from-purpleGlow to-purpleSoft rounded-lg flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                        />
                      </svg>
                    </div>
                    Core Competencies
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {selectedCandidate.skills.map((skill, idx) => (
                      <motion.span
                        key={idx}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.05 }}
                        className="px-5 py-2.5 bg-linear-to-r from-purpleGlow/10 to-purpleSoft/10 border border-purpleGlow/30 text-white/90 rounded-xl text-sm font-medium hover:border-purpleGlow/60 hover:bg-purpleGlow/20 transition-all cursor-default"
                      >
                        {skill}
                      </motion.span>
                    ))}
                  </div>
                </div>

                {/* Bio */}
                <div className="mb-10">
                  <h3
                    className="text-2xl font-semibold text-white mb-4"
                    style={{ fontFamily: "'Cormorant Garamond', serif" }}
                  >
                    Professional Summary
                  </h3>
                  <p
                    className="text-white/75 leading-relaxed text-base"
                    style={{ fontFamily: "'Spectral', serif" }}
                  >
                    {selectedCandidate.bio}
                  </p>
                </div>

                {/* Education & Experience Grid */}
                <div className="grid grid-cols-2 gap-6 mb-10">
                  <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                    <h3
                      className="text-xl font-semibold text-white mb-3"
                      style={{ fontFamily: "'Cormorant Garamond', serif" }}
                    >
                      Education
                    </h3>
                    <p
                      className="text-white/75"
                      style={{ fontFamily: "'Spectral', serif" }}
                    >
                      {selectedCandidate.education}
                    </p>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                    <h3
                      className="text-xl font-semibold text-white mb-3"
                      style={{ fontFamily: "'Cormorant Garamond', serif" }}
                    >
                      Previous Companies
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedCandidate.previousCompanies.map(
                        (company, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1.5 bg-white/10 border border-white/20 text-white/80 rounded-lg text-sm"
                          >
                            {company}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 pt-6 border-t border-white/10">
                  <Button variant="primary" className="flex-1 py-4 text-base">
                    <svg
                      className="w-5 h-5 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    Schedule Interview
                  </Button>
                  <Button variant="secondary" className="flex-1 py-4 text-base">
                    <svg
                      className="w-5 h-5 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                    Send Message
                  </Button>
                  <Button variant="ghost" className="px-6">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                      />
                    </svg>
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Styles */}
      <style jsx>{`
        @import url("https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Spectral:wght@300;400;500;600&display=swap");

        :root {
          --purpleGlow: #9b5cff;
          --purpleSoft: #b88eff;
          --purpleMain: #7c3aed;
          --textLight: #e5e7eb;
        }

        * {
          scrollbar-width: thin;
          scrollbar-color: rgba(155, 92, 255, 0.3) rgba(255, 255, 255, 0.05);
        }

        *::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        *::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }

        *::-webkit-scrollbar-thumb {
          background: rgba(155, 92, 255, 0.3);
          border-radius: 10px;
        }

        *::-webkit-scrollbar-thumb:hover {
          background: rgba(155, 92, 255, 0.5);
        }

        @keyframes pulse {
          0%,
          100% {
            opacity: 0.3;
          }
          50% {
            opacity: 0.5;
          }
        }

        .animate-pulse {
          animation: pulse 6s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "motion/react";
import { Button, CandidateFilter } from "../Components/index";
import { Card } from "../Components/Common/Card";
import {
  fetchCandidates,
  fetchCandidateDetails,
  setFilters,
  resetFilters,
  setSelectedCandidate,
  clearSelectedCandidate,
} from "../API/hiringApi";

export default function HiringLandingPage() {
  const dispatch = useDispatch();
  const { candidates, selectedCandidate, filters, loading, error, pagination } =
    useSelector((state) => state.hiring);

  useEffect(() => {
    dispatch(fetchCandidates(filters));
  }, [dispatch, filters]);

  const handleFilterChange = (newFilters) => {
    dispatch(setFilters(newFilters));
  };

  const handleResetFilters = () => {
    dispatch(resetFilters());
  };

  const handleCandidateClick = async (candidate) => {
    dispatch(setSelectedCandidate(candidate));
    // Fetch full details
    await dispatch(fetchCandidateDetails(candidate.id));
  };

  const handleCloseModal = () => {
    dispatch(clearSelectedCandidate());
  };

  if (loading && candidates.length === 0) {
    return (
      <div className="min-h-screen bg-linear-to-br from-[#0A0118] via-[#1A0B2E] to-[#0F051D] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purpleGlow/30 border-t-purpleGlow rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white/60">Loading candidates...</p>
        </div>
      </div>
    );
  }

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
        <div className="max-w-425 mx-auto px-8 py-12">
          <div className="flex gap-8">
            {/* Filters Sidebar */}
            <CandidateFilter
              filters={filters}
              setFilters={handleFilterChange}
              totalCandidates={pagination.total}
              filteredCount={candidates.length}
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
                  {candidates.length}{" "}
                  {candidates.length === 1
                    ? "exceptional candidate"
                    : "exceptional candidates"}{" "}
                  ready to join your team
                </p>
              </motion.div>

              {/* Error Message */}
              {error && (
                <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-2xl p-4">
                  <p className="text-red-400">{error}</p>
                </div>
              )}

              {/* Candidates List */}
              <div className="space-y-5">
                {candidates.map((candidate, index) => (
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
                      onClick={() => handleCandidateClick(candidate)}
                    >
                      <div className="flex gap-6">
                        {/* Avatar */}
                        <div className="relative shrink-0">
                          <div className="w-28 h-28 rounded-2xl overflow-hidden border-2 border-purpleGlow/30 shadow-[0_0_20px_rgba(155,92,255,0.3)] group-hover:border-purpleGlow/60 transition-all duration-300 bg-linear-to-br from-purpleGlow/20 to-purpleSoft/20 flex items-center justify-center">
                            <span className="text-4xl font-bold text-purpleSoft">
                              {candidate.name.charAt(0)}
                            </span>
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
                                handleCandidateClick(candidate);
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
                                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                />
                              </svg>
                              {candidate.email}
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
                            {candidate.allSkills
                              ?.slice(0, 6)
                              .map((skill, idx) => (
                                <span
                                  key={idx}
                                  className="px-3 py-1.5 bg-white/5 border border-white/10 text-xs text-white/80 rounded-lg hover:border-purpleGlow/40 hover:bg-purpleGlow/5 transition-all"
                                >
                                  {skill}
                                </span>
                              ))}
                            {candidate.allSkills?.length > 6 && (
                              <span className="px-3 py-1.5 text-xs text-purpleSoft font-medium">
                                +{candidate.allSkills.length - 6} more
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
              {candidates.length === 0 && !loading && (
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
                        onClick={handleResetFilters}
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
            onClick={handleCloseModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-[#12091F] border border-purpleGlow/30 rounded-3xl shadow-[0_0_100px_rgba(155,92,255,0.3)] max-w-5xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal content - keep existing modal structure but use selectedCandidate data */}
              {/* Include videos section */}
              {selectedCandidate.videos &&
                selectedCandidate.videos.length > 0 && (
                  <div className="mb-10">
                    <h3
                      className="text-2xl font-semibold text-white mb-5"
                      style={{ fontFamily: "'Cormorant Garamond', serif" }}
                    >
                      Interview Videos
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                      {selectedCandidate.videos.map((video, idx) => (
                        <div
                          key={idx}
                          className="bg-white/5 rounded-2xl p-4 border border-white/10"
                        >
                          <div className="flex justify-between items-center mb-2">
                            <h4 className="text-white/90 font-medium capitalize">
                              {video.video_type.replace(/_/g, " ")}
                            </h4>
                            <span className="text-xs text-white/50">
                              {video.duration
                                ? `${Math.round(video.duration)}s`
                                : "N/A"}
                            </span>
                          </div>
                          <a
                            href={video.ftp_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purpleSoft hover:text-purpleGlow transition-colors text-sm"
                          >
                            View Video →
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              {/* Rest of modal content... */}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Styles */}
      <style jsx>{`
        @import url("https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Spectral:wght@300;400;500;600&display=swap");
        /* Rest of styles... */
      `}</style>
    </div>
  );
}

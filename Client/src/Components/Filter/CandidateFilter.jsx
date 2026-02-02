import React from "react";
import { motion } from "motion/react";
import { Button } from "../index";
import { Input } from "../Common/Input";

const CandidateFilter = ({
  filters,
  setFilters,
  totalCandidates,
  filteredCount,
}) => {
  const hasActiveFilters =
    filters.search || filters.role || filters.location || filters.minScore > 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="w-75 shrink-0"
    >
      <div className="sticky top-8 space-y-5">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-[#1A0B2E] to-[#0F051D] p-6 border border-white/10">
          <div className="absolute inset-0 bg-linear-to-br from-purpleGlow/5 to-transparent"></div>
          <div className="relative">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-purpleGlow to-purpleSoft flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                  />
                </svg>
              </div>
              <div>
                <h2
                  className="text-xl font-bold text-white"
                  style={{ fontFamily: "'Cormorant Garamond', serif" }}
                >
                  Filters
                </h2>
                <p className="text-xs text-white/50">Refine your search</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search Filter */}
        <div className="bg-[#1A0B2E]/40 backdrop-blur-xl rounded-2xl p-5 border border-white/10">
          <label className="block text-xs font-semibold text-white/70 mb-3 uppercase tracking-widest">
            Search
          </label>
          <div className="relative group">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 group-focus-within:text-purpleGlow transition-colors"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <Input
              type="text"
              placeholder="Name, role, skills..."
              value={filters.search}
              onChange={(e) =>
                setFilters({ ...filters, search: e.target.value })
              }
              className="pl-11"
            />
          </div>
        </div>

        {/* Role & Location Filters */}
        <div className="bg-[#1A0B2E]/40 backdrop-blur-xl rounded-2xl p-5 border border-white/10 space-y-5">
          {/* Role */}
          <div>
            <label className="block text-xs font-semibold text-white/70 mb-3 uppercase tracking-widest">
              Role
            </label>
            <select
              value={filters.role}
              onChange={(e) => setFilters({ ...filters, role: e.target.value })}
              className="w-full rounded-xl bg-white/5 backdrop-blur-xl px-4 py-3 text-sm text-white/90 border border-white/10 transition-all duration-200 focus:outline-none focus:border-purpleGlow focus:ring-2 focus:ring-purpleGlow/40 cursor-pointer"
            >
              <option value="">All Roles</option>
              <option value="Designer">Designer</option>
              <option value="Engineer">Engineer</option>
              <option value="Product Manager">Product Manager</option>
              <option value="Data Scientist">Data Scientist</option>
              <option value="DevOps">DevOps</option>
            </select>
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-semibold text-white/70 mb-3 uppercase tracking-widest">
              Location
            </label>
            <div className="relative group">
              <svg
                className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 group-focus-within:text-purpleGlow transition-colors"
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
              <Input
                type="text"
                placeholder="City, state, country..."
                value={filters.location}
                onChange={(e) =>
                  setFilters({ ...filters, location: e.target.value })
                }
                className="pl-11"
              />
            </div>
          </div>
        </div>

        {/* Score Filter */}
        <div className="bg-[#1A0B2E]/40 backdrop-blur-xl rounded-2xl p-5 border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <label className="text-xs font-semibold text-white/70 uppercase tracking-widest">
              Interview Score
            </label>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold bg-linear-to-r from-purpleGlow to-purpleSoft bg-clip-text text-transparent">
                {filters.minScore}
              </span>
              <span className="text-xs text-white/50">min</span>
            </div>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={filters.minScore}
            onChange={(e) =>
              setFilters({ ...filters, minScore: parseInt(e.target.value) })
            }
            className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-linear-to-r [&::-webkit-slider-thumb]:from-purpleGlow [&::-webkit-slider-thumb]:to-purpleSoft [&::-webkit-slider-thumb]:shadow-[0_0_25px_rgba(155,92,255,0.7)] [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-all hover:[&::-webkit-slider-thumb]:shadow-[0_0_35px_rgba(155,92,255,0.9)] hover:[&::-webkit-slider-thumb]:scale-110"
          />
          <div className="flex justify-between text-xs text-white/40 mt-3 px-1">
            <span>0</span>
            <span>50</span>
            <span>100</span>
          </div>
        </div>

        {/* Stats Display */}
        <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-purpleGlow/20 via-purpleSoft/10 to-transparent p-6 border border-purpleGlow/30">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purpleGlow/10 rounded-full blur-3xl"></div>
          <div className="relative">
            <div className="text-xs text-white/60 mb-2 uppercase tracking-widest font-semibold">
              Matching Candidates
            </div>
            <div className="flex items-baseline gap-2">
              <div className="text-4xl font-bold bg-linear-to-r from-white to-purpleSoft bg-clip-text text-transparent">
                {filteredCount}
              </div>
              <div className="text-sm text-white/50">/ {totalCandidates}</div>
            </div>
            {hasActiveFilters && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <div className="text-xs text-purpleSoft">
                  {filteredCount === 0
                    ? "No matches found"
                    : filteredCount === 1
                      ? "Perfect match!"
                      : "Great matches!"}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <Button
              variant="ghost"
              size="sm"
              className="w-full border border-white/10 hover:border-purpleGlow/50"
              onClick={() =>
                setFilters({
                  search: "",
                  role: "",
                  location: "",
                  minScore: 0,
                })
              }
            >
              <svg
                className="w-4 h-4 mr-2"
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
              Clear All Filters
            </Button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default CandidateFilter;

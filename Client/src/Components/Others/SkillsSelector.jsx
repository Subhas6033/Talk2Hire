import { useState, useEffect, useMemo } from "react";
import { useDispatch } from "react-redux";
import { useAuth } from "../../Hooks/useAuthHook";
import { getCVSkills } from "../../API/authApi";
import { Card, CardHeader, CardBody } from "../Common/Card";
import {
  X,
  Search,
  Plus,
  Check,
  Sparkles,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// Skill categories with related skills
const SKILL_CATEGORIES = {
  "Frontend Developer": [
    "React",
    "Vue.js",
    "Angular",
    "TypeScript",
    "Tailwind CSS",
    "Next.js",
  ],
  "Backend Developer": [
    "Node.js",
    "Express.js",
    "Python",
    "Django",
    "PostgreSQL",
    "MongoDB",
  ],
  "Fullstack Developer": [
    "MERN Stack",
    "MEAN Stack",
    "GraphQL",
    "REST API",
    "Docker",
    "AWS",
  ],
  "DevOps Engineer": [
    "Kubernetes",
    "Jenkins",
    "GitLab CI",
    "Terraform",
    "AWS",
    "Docker",
  ],
  "Cloud Engineer": [
    "AWS",
    "Azure",
    "Google Cloud",
    "Terraform",
    "CloudFormation",
    "Kubernetes",
  ],
  "UI/UX Designer": [
    "Figma",
    "Adobe XD",
    "Sketch",
    "Prototyping",
    "Wireframing",
    "User Research",
  ],
  "Mobile Developer": [
    "React Native",
    "Flutter",
    "Swift",
    "Kotlin",
    "iOS",
    "Android",
  ],
  "Data Engineer": ["Apache Spark", "Airflow", "Kafka", "Python", "SQL", "ETL"],
  "Machine Learning Engineer": [
    "TensorFlow",
    "PyTorch",
    "Scikit-learn",
    "Python",
    "Pandas",
    "NumPy",
  ],
  "QA Engineer": [
    "Selenium",
    "Cypress",
    "Jest",
    "JUnit",
    "Test Automation",
    "API Testing",
  ],
};

const PAGE_SIZE = 15;

const SkillsSelector = ({ selectedSkills = [], onSkillsChange }) => {
  const [inputValue, setInputValue] = useState("");
  const [skillsRefreshKey, setSkillsRefreshKey] = useState(0);
  const [hasAutoSelected, setHasAutoSelected] = useState(false);
  // Pagination state for CV skills
  const [cvPage, setCvPage] = useState(1);
  const dispatch = useDispatch();
  const { user, loading: authLoading } = useAuth();

  // Reset CV pagination whenever CV skills change (refresh / new user)
  useEffect(() => {
    setCvPage(1);
  }, [user?.id, skillsRefreshKey]);

  // Fetch CV skills from API on component mount and when user updates
  useEffect(() => {
    if (user) {
      dispatch(getCVSkills());
    }
  }, [dispatch, user?.id, skillsRefreshKey]);

  // Get CV skills from user object
  const cvSkills = useMemo(() => {
    return user?.cvSkills || [];
  }, [user]);

  // Generate related skills based on CV skills
  const suggestedSkills = useMemo(() => {
    const suggested = new Set();
    cvSkills.forEach((cvSkill) => {
      const category = Object.keys(SKILL_CATEGORIES).find(
        (cat) => cat.toLowerCase() === cvSkill.toLowerCase(),
      );
      if (category) {
        SKILL_CATEGORIES[category].forEach((skill) => suggested.add(skill));
      }
    });
    return Array.from(suggested);
  }, [cvSkills]);

  // ── AUTO-SELECT CV + SUGGESTED SKILLS ON INITIAL LOAD ────────────────────
  useEffect(() => {
    // Only auto-select once when CV skills are loaded and we haven't done it yet
    if (cvSkills.length > 0 && !hasAutoSelected && !authLoading) {
      const allDefaultSkills = [...cvSkills, ...suggestedSkills];

      // Remove duplicates (case-insensitive)
      const uniqueSkills = [];
      const seen = new Set();
      allDefaultSkills.forEach((skill) => {
        const lower = skill.toLowerCase();
        if (!seen.has(lower)) {
          seen.add(lower);
          uniqueSkills.push(skill);
        }
      });

      // Only set if different from current selection
      if (uniqueSkills.length > 0) {
        onSkillsChange(uniqueSkills);
        setHasAutoSelected(true);
      }
    }
  }, [cvSkills, suggestedSkills, hasAutoSelected, authLoading, onSkillsChange]);

  // Reset auto-selection flag when user changes or skills refresh
  useEffect(() => {
    setHasAutoSelected(false);
  }, [user?.id, skillsRefreshKey]);
  // ──────────────────────────────────────────────────────────────────────────

  // Handle manual refresh of CV skills
  const handleRefreshSkills = () => {
    if (user) {
      setSkillsRefreshKey((prev) => prev + 1);
      setHasAutoSelected(false); // Allow auto-selection again after refresh
    }
  };

  // Combine all available skills (excluding popular predefined skills)
  const allAvailableSkills = useMemo(() => {
    const combined = [...cvSkills, ...suggestedSkills];
    const unique = [];
    const seen = new Set();
    combined.forEach((skill) => {
      const lower = skill.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        unique.push(skill);
      }
    });
    return unique;
  }, [cvSkills, suggestedSkills]);

  // Check if input matches any available skill
  const findMatchingSkill = () => {
    const trimmedInput = inputValue.trim();
    if (!trimmedInput) return null;
    return allAvailableSkills.find(
      (skill) =>
        skill.toLowerCase() === trimmedInput.toLowerCase() &&
        !selectedSkills.includes(skill),
    );
  };

  // Filter skills based on input
  const filteredSkills = allAvailableSkills.filter(
    (skill) =>
      skill.toLowerCase().includes(inputValue.toLowerCase().trim()) &&
      !selectedSkills.includes(skill),
  );

  // Separate CV skills from other skills in search results
  const cvSkillsInSearch = useMemo(() => {
    if (!inputValue.trim()) return [];
    return cvSkills.filter(
      (skill) =>
        skill.toLowerCase().includes(inputValue.toLowerCase().trim()) &&
        !selectedSkills.includes(skill),
    );
  }, [cvSkills, inputValue, selectedSkills]);

  const otherSkillsInSearch = useMemo(() => {
    if (!inputValue.trim()) return [];
    return filteredSkills.filter(
      (skill) =>
        !cvSkills.some(
          (cvSkill) => cvSkill.toLowerCase() === skill.toLowerCase(),
        ),
    );
  }, [filteredSkills, cvSkills]);

  const matchingSkill = findMatchingSkill();
  const isExactMatch = !!matchingSkill;
  const canAddCustom =
    inputValue.trim() &&
    !isExactMatch &&
    !selectedSkills.some(
      (s) => s.toLowerCase() === inputValue.trim().toLowerCase(),
    );

  const addSkill = (skill) => {
    if (!selectedSkills.includes(skill)) {
      onSkillsChange([...selectedSkills, skill]);
      setInputValue("");
    }
  };

  const removeSkill = (skillToRemove) => {
    onSkillsChange(selectedSkills.filter((skill) => skill !== skillToRemove));
  };

  const handlePrimaryAction = () => {
    if (isExactMatch) {
      addSkill(matchingSkill);
    } else if (canAddCustom) {
      const customSkill = inputValue.trim().toUpperCase();
      addSkill(customSkill);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handlePrimaryAction();
    }
  };

  const getButtonConfig = () => {
    if (isExactMatch) {
      return {
        icon: <Check size={16} />,
        text: "Select",
        disabled: false,
        className:
          "bg-linear-to-r from-emerald-500/20 to-green-500/20 border-emerald-400/50 text-emerald-300 hover:from-emerald-500/30 hover:to-green-500/30 hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-500/20",
      };
    } else if (canAddCustom) {
      return {
        icon: <Plus size={16} />,
        text: "Add Custom",
        disabled: false,
        className:
          "bg-linear-to-r from-purple-500/20 to-pink-500/20 border-purple-400/50 text-purple-300 hover:from-purple-500/30 hover:to-pink-500/30 hover:border-purple-400 hover:shadow-lg hover:shadow-purple-500/20",
      };
    } else {
      return {
        icon: <Plus size={16} />,
        text: inputValue.trim() ? "Already Added" : "Add",
        disabled: true,
        className: "bg-white/5 border-white/20 text-white/40",
      };
    }
  };

  const buttonConfig = getButtonConfig();

  // ── CV skills pagination ──────────────────────────────────────────────────
  // All unselected CV skills (no slice — pagination handles the limiting)
  const unselectedCvSkills = cvSkills.filter(
    (skill) => !selectedSkills.includes(skill),
  );
  const totalCvSkills = unselectedCvSkills.length;
  const totalCvPages = Math.max(1, Math.ceil(totalCvSkills / PAGE_SIZE));
  const visibleCvSkills = unselectedCvSkills.slice(
    (cvPage - 1) * PAGE_SIZE,
    cvPage * PAGE_SIZE,
  );

  const suggestedSkillsToShow = suggestedSkills
    .filter(
      (skill) => !selectedSkills.includes(skill) && !cvSkills.includes(skill),
    )
    .slice(0, PAGE_SIZE);

  const hiddenSuggestedSkillsCount = Math.max(
    0,
    suggestedSkills.filter(
      (skill) => !selectedSkills.includes(skill) && !cvSkills.includes(skill),
    ).length - PAGE_SIZE,
  );

  // Count CV skills in selected skills
  const cvSkillsCount = selectedSkills.filter((skill) =>
    cvSkills.some((cvSkill) => cvSkill.toLowerCase() === skill.toLowerCase()),
  ).length;

  return (
    <Card variant="default" padding="lg" className="w-full mb-5">
      <CardHeader headerClass="text-center">
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-semibold text-white">
            Select Your Skills for Interview
          </h3>
          <p className="text-xs text-white/60">
            All skills selected by default • Remove unwanted skills • Add custom
            skills
          </p>
        </div>
      </CardHeader>

      <CardBody>
        {/* Loading indicator for CV skills */}
        {authLoading && cvSkills.length === 0 && (
          <div className="mb-4 p-3 bg-linear-to-r from-slate-500/10 to-slate-600/10 border border-slate-400/30 rounded-xl shadow-sm">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
              <p className="text-xs text-slate-300 font-medium">
                Loading your CV skills...
              </p>
            </div>
          </div>
        )}

        {/* Auto-selection notification */}
        {hasAutoSelected && selectedSkills.length > 0 && (
          <div className="mb-4 p-3 bg-linear-to-r from-emerald-500/10 to-green-500/10 border border-emerald-400/30 rounded-xl shadow-sm">
            <div className="flex items-center gap-2">
              <p className="text-xs text-emerald-300 font-medium">
                ✓ Auto-selected {cvSkillsCount} skill
                {cvSkillsCount !== 1 ? "s" : ""} from your CV. Add or remove any
                skills you want.
              </p>
            </div>
          </div>
        )}

        {/* Unified Search/Add Input */}
        <div className="mb-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              placeholder="Search or type to add custom skill..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-purple-400/50 focus:bg-white/10 focus:shadow-lg focus:shadow-purple-500/10 transition-all duration-200"
            />
          </div>
          <button
            type="button"
            onClick={handlePrimaryAction}
            disabled={buttonConfig.disabled}
            className={`px-4 py-2.5 border rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap font-semibold ${buttonConfig.className}`}
          >
            {buttonConfig.icon}
            {buttonConfig.text}
          </button>
        </div>

        {/* Helper text below input */}
        {inputValue.trim() && (
          <div className="mb-4 px-3 py-2 bg-linear-to-r from-white/5 to-white/10 rounded-xl border border-white/10 shadow-sm">
            <p className="text-xs text-white/70">
              {isExactMatch ? (
                <>
                  ✓ Found:{" "}
                  <span className="text-emerald-300 font-semibold">
                    {matchingSkill}
                  </span>{" "}
                  - Click "Select" to add
                </>
              ) : canAddCustom ? (
                <>
                  Custom skill:{" "}
                  <span className="text-purple-300 font-semibold">
                    {inputValue.trim().toUpperCase()}
                  </span>{" "}
                  - Click "Add Custom"
                </>
              ) : selectedSkills.some(
                  (s) => s.toLowerCase() === inputValue.trim().toLowerCase(),
                ) ? (
                <>
                  <span className="text-amber-400 font-semibold">
                    Already added
                  </span>{" "}
                  - This skill is in your selection
                </>
              ) : (
                <>Type to search or add a custom skill</>
              )}
            </p>
          </div>
        )}

        {/* Selected Skills - Prominent Display with Beautiful Scrollbar */}
        {selectedSkills.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-white/90 mb-3 flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-linear-to-r from-purple-500 to-pink-500 rounded-full"></div>
              Selected for Interview ({selectedSkills.length})
            </p>
            <div className="relative group">
              {/* Custom scrollbar styling */}
              <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                  width: 8px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                  background: rgba(139, 92, 246, 0.05);
                  border-radius: 10px;
                  margin: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                  background: linear-gradient(
                    to bottom,
                    rgba(168, 85, 247, 0.4),
                    rgba(236, 72, 153, 0.4)
                  );
                  border-radius: 10px;
                  border: 2px solid rgba(139, 92, 246, 0.1);
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                  background: linear-gradient(
                    to bottom,
                    rgba(168, 85, 247, 0.6),
                    rgba(236, 72, 153, 0.6)
                  );
                }
                .custom-scrollbar {
                  scrollbar-width: thin;
                  scrollbar-color: rgba(168, 85, 247, 0.4)
                    rgba(139, 92, 246, 0.05);
                }
              `}</style>
              <div className="flex flex-wrap gap-2 p-4 bg-linear-to-br from-purple-500/5 via-pink-500/5 to-purple-500/5 rounded-xl border border-purple-400/20 max-h-60 overflow-y-auto shadow-sm custom-scrollbar">
                {selectedSkills.map((skill) => (
                  <div
                    key={skill}
                    className="inline-flex items-center gap-2 px-3.5 py-2 bg-linear-to-r from-purple-500/20 to-pink-500/20 border border-purple-400/40 rounded-lg text-purple-200 text-xs font-semibold shadow-sm"
                  >
                    <span>{skill}</span>
                    <button
                      type="button"
                      onClick={() => removeSkill(skill)}
                      className="hover:bg-purple-400/30 rounded-full p-0.5 transition-all duration-200"
                      aria-label={`Remove ${skill}`}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              {/* Scroll indicator */}
              {selectedSkills.length > 15 && (
                <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                  <div className="bg-purple-500/20 border border-purple-400/40 rounded-full px-2 py-1 backdrop-blur-sm">
                    <p className="text-xs text-purple-300 font-semibold">
                      Scroll for more
                    </p>
                  </div>
                </div>
              )}
            </div>
            <p className="text-xs text-white/50 mt-2 text-center">
              Click the ✕ icon to remove any skill you don't want to be tested
              on
            </p>
          </div>
        )}

        {/* Matching Skills when searching */}
        {inputValue.trim() &&
          (cvSkillsInSearch.length > 0 || otherSkillsInSearch.length > 0) && (
            <div className="mb-4 space-y-3">
              {/* CV Skills in Search Results */}
              {cvSkillsInSearch.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-white/90 mb-2 flex items-center gap-2">
                    <div className="p-1 bg-linear-to-br from-slate-400 to-slate-600 rounded-md">
                      <Sparkles size={10} className="text-white" />
                    </div>
                    From Your CV ({cvSkillsInSearch.length} match
                    {cvSkillsInSearch.length !== 1 ? "es" : ""})
                  </p>
                  <div className="relative group">
                    <div className="flex flex-wrap gap-2 p-3 bg-linear-to-br from-slate-500/5 via-slate-600/5 to-slate-500/5 rounded-xl border border-slate-400/20 shadow-sm max-h-64 overflow-y-auto custom-scrollbar">
                      {cvSkillsInSearch.map((skill) => (
                        <button
                          key={skill}
                          type="button"
                          onClick={() => addSkill(skill)}
                          className="group inline-flex items-center gap-2 px-3.5 py-2 bg-linear-to-r from-slate-500/15 to-slate-600/15 border border-slate-400/40 rounded-lg text-slate-300 text-xs font-semibold hover:from-slate-500/25 hover:to-slate-600/25 hover:border-slate-400/60 hover:shadow-lg hover:shadow-slate-500/10 transition-all duration-200"
                        >
                          <span>{skill}</span>
                          <Plus
                            size={14}
                            className="group-hover:rotate-90 transition-transform duration-200"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  {cvSkillsInSearch.length > 10 && (
                    <p className="text-xs text-slate-400 mt-2 text-center">
                      Showing all {cvSkillsInSearch.length} matching skills from
                      your CV
                    </p>
                  )}
                </div>
              )}

              {/* Other Skills in Search Results */}
              {otherSkillsInSearch.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-white/90 mb-2">
                    Other Matching Skills (
                    {otherSkillsInSearch.slice(0, PAGE_SIZE).length}
                    {otherSkillsInSearch.length > PAGE_SIZE &&
                      ` of ${otherSkillsInSearch.length}`}
                    )
                  </p>
                  <div className="relative group">
                    <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto p-3 bg-white/5 rounded-xl border border-white/10 shadow-sm custom-scrollbar">
                      {otherSkillsInSearch.slice(0, PAGE_SIZE).map((skill) => (
                        <button
                          key={skill}
                          type="button"
                          onClick={() => addSkill(skill)}
                          className="group inline-flex items-center gap-2 px-3.5 py-2 bg-white/5 border border-white/20 rounded-lg text-white/80 text-xs font-semibold hover:bg-linear-to-r hover:from-purple-500/10 hover:to-pink-500/10 hover:border-purple-400/40 hover:text-purple-200 hover:shadow-lg hover:shadow-purple-500/10 transition-all duration-200"
                        >
                          <span>{skill}</span>
                          <Plus
                            size={14}
                            className="group-hover:rotate-90 transition-transform duration-200"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  {otherSkillsInSearch.length > PAGE_SIZE && (
                    <p className="text-xs text-white/40 mt-2 text-center">
                      Showing top {PAGE_SIZE} results. Refine your search to see
                      more.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

        {/* Show categorized skills when NOT searching */}
        {!inputValue.trim() && (
          <>
            {/* CV Skills with pagination (only show unselected) */}
            {visibleCvSkills.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-white/90 flex items-center gap-2">
                    <div className="p-1 bg-linear-to-br from-slate-400 to-slate-600 rounded-md">
                      <Sparkles size={12} className="text-white" />
                    </div>
                    Available CV Skills ({totalCvSkills})
                  </p>

                  {/* Right side: page controls + refresh */}
                  <div className="flex items-center gap-1.5">
                    {totalCvPages > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() => setCvPage((p) => Math.max(1, p - 1))}
                          disabled={cvPage === 1}
                          className="p-1.5 rounded-lg bg-slate-500/10 border border-slate-400/30 text-slate-400 hover:bg-slate-500/20 hover:border-slate-400/50 hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
                        >
                          <ChevronLeft size={12} />
                        </button>
                        <span className="text-xs font-semibold text-slate-400 px-1.5">
                          {cvPage} / {totalCvPages}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setCvPage((p) => Math.min(totalCvPages, p + 1))
                          }
                          disabled={cvPage === totalCvPages}
                          className="p-1.5 rounded-lg bg-slate-500/10 border border-slate-400/30 text-slate-400 hover:bg-slate-500/20 hover:border-slate-400/50 hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
                        >
                          <ChevronRight size={12} />
                        </button>
                        <div className="w-px h-4 bg-slate-400/20 mx-0.5" />
                      </>
                    )}
                    <button
                      type="button"
                      onClick={handleRefreshSkills}
                      className="p-1.5 rounded-lg bg-slate-500/10 border border-slate-400/30 text-slate-400 hover:bg-slate-500/20 hover:border-slate-400/50 hover:text-slate-300 transition-all duration-200"
                      title="Refresh CV skills"
                    >
                      <RefreshCw
                        size={12}
                        className={authLoading ? "animate-spin" : ""}
                      />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 p-4 bg-linear-to-br from-slate-500/5 via-slate-600/5 to-slate-500/5 rounded-xl border border-slate-400/20 shadow-sm">
                  {visibleCvSkills.map((skill) => (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => addSkill(skill)}
                      className="group inline-flex items-center gap-2 px-3.5 py-2 bg-linear-to-r from-slate-500/10 to-slate-600/10 border border-slate-400/30 rounded-lg text-slate-300 text-xs font-semibold hover:from-slate-500/20 hover:to-slate-600/20 hover:border-slate-400/50 hover:shadow-lg hover:shadow-slate-500/10 transition-all duration-200"
                    >
                      <span>{skill}</span>
                      <Plus
                        size={14}
                        className="group-hover:rotate-90 transition-transform duration-200"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Suggested Skills (only show unselected) */}
            {suggestedSkillsToShow.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-white/90 mb-3 flex items-center gap-2">
                  <div className="p-1 bg-linear-to-br from-emerald-500 to-green-600 rounded-md">
                    <Sparkles size={12} className="text-white" />
                  </div>
                  Additional Suggested Skills ({suggestedSkillsToShow.length}
                  {hiddenSuggestedSkillsCount > 0 &&
                    ` of ${
                      suggestedSkills.filter(
                        (skill) =>
                          !selectedSkills.includes(skill) &&
                          !cvSkills.includes(skill),
                      ).length
                    }`}
                  )
                </p>
                <div className="flex flex-wrap gap-2 p-4 bg-linear-to-br from-emerald-500/5 via-green-500/5 to-emerald-500/5 rounded-xl border border-emerald-400/20 shadow-sm">
                  {suggestedSkillsToShow.map((skill) => (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => addSkill(skill)}
                      className="group inline-flex items-center gap-2 px-3.5 py-2 bg-linear-to-r from-emerald-500/10 to-green-500/10 border border-emerald-400/30 rounded-lg text-emerald-300 text-xs font-semibold hover:from-emerald-500/20 hover:to-green-500/20 hover:border-emerald-400/50 hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-200"
                    >
                      <span>{skill}</span>
                      <Plus
                        size={14}
                        className="group-hover:rotate-90 transition-transform duration-200"
                      />
                    </button>
                  ))}
                </div>
                {hiddenSuggestedSkillsCount > 0 && (
                  <p className="text-xs text-white/40 mt-2 text-center">
                    + {hiddenSuggestedSkillsCount} more skill
                    {hiddenSuggestedSkillsCount > 1 ? "s" : ""} available. Use
                    search to find them.
                  </p>
                )}
              </div>
            )}

            {/* No CV Skills Message */}
            {cvSkills.length === 0 && !authLoading && (
              <div className="mb-4 p-4 bg-linear-to-r from-amber-500/10 to-orange-500/10 border border-amber-400/30 rounded-xl shadow-sm">
                <p className="text-xs text-amber-300 text-center font-medium">
                  💡 No skills extracted from your CV yet. Add custom skills
                  using the search box above.
                </p>
              </div>
            )}
          </>
        )}

        {/* Helper Text */}
        <p className="mt-3 text-xs text-white/40 text-center">
          {selectedSkills.length > 0
            ? `${selectedSkills.length} skill${selectedSkills.length !== 1 ? "s" : ""} selected for interview • Remove unwanted skills or add more`
            : "Add skills using the search box above"}
        </p>
      </CardBody>
    </Card>
  );
};

export default SkillsSelector;

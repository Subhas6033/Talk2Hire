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
  const [cvPage, setCvPage] = useState(1);
  const dispatch = useDispatch();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    setCvPage(1);
  }, [user?.id, skillsRefreshKey]);

  useEffect(() => {
    if (user) dispatch(getCVSkills());
  }, [dispatch, user?.id, skillsRefreshKey]);

  const cvSkills = useMemo(() => user?.cvSkills || [], [user]);

  const suggestedSkills = useMemo(() => {
    const suggested = new Set();
    cvSkills.forEach((cvSkill) => {
      const category = Object.keys(SKILL_CATEGORIES).find(
        (cat) => cat.toLowerCase() === cvSkill.toLowerCase(),
      );
      if (category)
        SKILL_CATEGORIES[category].forEach((skill) => suggested.add(skill));
    });
    return Array.from(suggested);
  }, [cvSkills]);

  useEffect(() => {
    if (cvSkills.length > 0 && !hasAutoSelected && !authLoading) {
      const allDefaultSkills = [...cvSkills, ...suggestedSkills];
      const uniqueSkills = [];
      const seen = new Set();
      allDefaultSkills.forEach((skill) => {
        const lower = skill.toLowerCase();
        if (!seen.has(lower)) {
          seen.add(lower);
          uniqueSkills.push(skill);
        }
      });
      if (uniqueSkills.length > 0) {
        onSkillsChange(uniqueSkills);
        setHasAutoSelected(true);
      }
    }
  }, [cvSkills, suggestedSkills, hasAutoSelected, authLoading, onSkillsChange]);

  useEffect(() => {
    setHasAutoSelected(false);
  }, [user?.id, skillsRefreshKey]);

  const handleRefreshSkills = () => {
    if (user) {
      setSkillsRefreshKey((prev) => prev + 1);
      setHasAutoSelected(false);
    }
  };

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

  const findMatchingSkill = () => {
    const trimmedInput = inputValue.trim();
    if (!trimmedInput) return null;
    return allAvailableSkills.find(
      (skill) =>
        skill.toLowerCase() === trimmedInput.toLowerCase() &&
        !selectedSkills.includes(skill),
    );
  };

  const filteredSkills = allAvailableSkills.filter(
    (skill) =>
      skill.toLowerCase().includes(inputValue.toLowerCase().trim()) &&
      !selectedSkills.includes(skill),
  );

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
    if (isExactMatch) addSkill(matchingSkill);
    else if (canAddCustom) addSkill(inputValue.trim().toUpperCase());
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handlePrimaryAction();
    }
  };

  const getButtonConfig = () => {
    if (isExactMatch)
      return {
        icon: <Check size={16} />,
        text: "Select",
        disabled: false,
        className:
          "bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-400",
      };
    if (canAddCustom)
      return {
        icon: <Plus size={16} />,
        text: "Add Custom",
        disabled: false,
        className:
          "bg-indigo-50 border-indigo-300 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-400",
      };
    return {
      icon: <Plus size={16} />,
      text: inputValue.trim() ? "Already Added" : "Add",
      disabled: true,
      className: "bg-gray-50 border-gray-200 text-gray-400",
    };
  };

  const buttonConfig = getButtonConfig();

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

  const cvSkillsCount = selectedSkills.filter((skill) =>
    cvSkills.some((cvSkill) => cvSkill.toLowerCase() === skill.toLowerCase()),
  ).length;

  return (
    <div className="w-full mb-5 bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 text-center">
        <h3 className="text-base font-semibold text-gray-900">
          Select Your Skills for Interview
        </h3>
        <p className="text-xs text-gray-400 mt-0.5">
          All skills selected by default · Remove unwanted skills · Add custom
          skills
        </p>
      </div>

      {/* Body */}
      <div className="p-5">
        {/* Loading */}
        {authLoading && cvSkills.length === 0 && (
          <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-xl">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
              <p className="text-xs text-gray-500 font-medium">
                Loading your CV skills…
              </p>
            </div>
          </div>
        )}

        {/* Auto-selection notification */}
        {hasAutoSelected && selectedSkills.length > 0 && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
            <p className="text-xs text-emerald-700 font-medium">
              ✓ Auto-selected {cvSkillsCount} skill
              {cvSkillsCount !== 1 ? "s" : ""} from your CV. Add or remove any
              skills you want.
            </p>
          </div>
        )}

        {/* Search / Add Input */}
        <div className="mb-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search or type to add custom skill…"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all duration-200"
            />
          </div>
          <button
            type="button"
            onClick={handlePrimaryAction}
            disabled={buttonConfig.disabled}
            className={`px-4 py-2.5 border rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold ${buttonConfig.className}`}
          >
            {buttonConfig.icon}
            <span className="hidden sm:inline">{buttonConfig.text}</span>
          </button>
        </div>

        {/* Helper text */}
        {inputValue.trim() && (
          <div className="mb-4 px-3 py-2 bg-gray-50 rounded-xl border border-gray-200">
            <p className="text-xs text-gray-600">
              {isExactMatch ? (
                <>
                  Found:{" "}
                  <span className="text-emerald-600 font-semibold">
                    {matchingSkill}
                  </span>{" "}
                  — Click "Select" to add
                </>
              ) : canAddCustom ? (
                <>
                  Custom skill:{" "}
                  <span className="text-indigo-600 font-semibold">
                    {inputValue.trim().toUpperCase()}
                  </span>{" "}
                  — Click "Add Custom"
                </>
              ) : selectedSkills.some(
                  (s) => s.toLowerCase() === inputValue.trim().toLowerCase(),
                ) ? (
                <>
                  <span className="text-amber-600 font-semibold">
                    Already added
                  </span>{" "}
                  — This skill is in your selection
                </>
              ) : (
                <>Type to search or add a custom skill</>
              )}
            </p>
          </div>
        )}

        {/* Selected Skills */}
        {selectedSkills.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-semibold text-gray-700 mb-2.5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block" />
              Selected for Interview
              <span className="ml-auto text-indigo-600 font-bold">
                {selectedSkills.length}
              </span>
            </p>
            <div className="flex flex-wrap gap-2 p-3.5 bg-indigo-50 rounded-xl border border-indigo-100 max-h-40 overflow-y-auto">
              {selectedSkills.map((skill) => (
                <div
                  key={skill}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-indigo-200 rounded-lg text-indigo-700 text-xs font-semibold shadow-sm"
                >
                  <span>{skill}</span>
                  <button
                    type="button"
                    onClick={() => removeSkill(skill)}
                    className="hover:bg-indigo-100 rounded-full p-0.5 text-indigo-400 hover:text-indigo-600 transition-all duration-200"
                    aria-label={`Remove ${skill}`}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">
              Click the ✕ icon to remove any skill you don't want to be tested
              on
            </p>
          </div>
        )}

        {/* Search Results */}
        {inputValue.trim() &&
          (cvSkillsInSearch.length > 0 || otherSkillsInSearch.length > 0) && (
            <div className="mb-4 space-y-3">
              {/* CV Skills in search */}
              {cvSkillsInSearch.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 bg-gray-200 rounded-md">
                      <Sparkles size={10} className="text-gray-600" />
                    </span>
                    From Your CV
                    <span className="text-gray-400 font-normal">
                      ({cvSkillsInSearch.length} match
                      {cvSkillsInSearch.length !== 1 ? "es" : ""})
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200 max-h-48 overflow-y-auto">
                    {cvSkillsInSearch.map((skill) => (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => addSkill(skill)}
                        className="group inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-700 text-xs font-semibold hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm transition-all duration-200"
                      >
                        <span>{skill}</span>
                        <Plus
                          size={12}
                          className="text-gray-400 group-hover:rotate-90 transition-transform duration-200"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Other matching skills */}
              {otherSkillsInSearch.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2">
                    Other Matching Skills
                    <span className="ml-1 text-gray-400 font-normal">
                      ({otherSkillsInSearch.slice(0, PAGE_SIZE).length}
                      {otherSkillsInSearch.length > PAGE_SIZE &&
                        ` of ${otherSkillsInSearch.length}`}
                      )
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-3 bg-gray-50 rounded-xl border border-gray-200">
                    {otherSkillsInSearch.slice(0, PAGE_SIZE).map((skill) => (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => addSkill(skill)}
                        className="group inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-700 text-xs font-semibold hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 hover:shadow-sm transition-all duration-200"
                      >
                        <span>{skill}</span>
                        <Plus
                          size={12}
                          className="text-gray-400 group-hover:text-indigo-500 group-hover:rotate-90 transition-transform duration-200"
                        />
                      </button>
                    ))}
                  </div>
                  {otherSkillsInSearch.length > PAGE_SIZE && (
                    <p className="text-xs text-gray-400 mt-2 text-center">
                      Showing top {PAGE_SIZE} results. Refine your search to see
                      more.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

        {/* Browse skills (not searching) */}
        {!inputValue.trim() && (
          <>
            {/* CV Skills with pagination */}
            {visibleCvSkills.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-xs font-semibold text-gray-700 flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 bg-gray-200 rounded-md">
                      <Sparkles size={10} className="text-gray-600" />
                    </span>
                    Available CV Skills
                    <span className="text-gray-400 font-normal">
                      ({totalCvSkills})
                    </span>
                  </p>

                  <div className="flex items-center gap-1.5">
                    {totalCvPages > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() => setCvPage((p) => Math.max(1, p - 1))}
                          disabled={cvPage === 1}
                          className="p-1.5 rounded-lg bg-gray-100 border border-gray-200 text-gray-500 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
                        >
                          <ChevronLeft size={12} />
                        </button>
                        <span className="text-xs font-semibold text-gray-500 px-1">
                          {cvPage} / {totalCvPages}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setCvPage((p) => Math.min(totalCvPages, p + 1))
                          }
                          disabled={cvPage === totalCvPages}
                          className="p-1.5 rounded-lg bg-gray-100 border border-gray-200 text-gray-500 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
                        >
                          <ChevronRight size={12} />
                        </button>
                        <div className="w-px h-4 bg-gray-200 mx-0.5" />
                      </>
                    )}
                    <button
                      type="button"
                      onClick={handleRefreshSkills}
                      className="p-1.5 rounded-lg bg-gray-100 border border-gray-200 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-all duration-200"
                      title="Refresh CV skills"
                    >
                      <RefreshCw
                        size={12}
                        className={authLoading ? "animate-spin" : ""}
                      />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 p-3.5 bg-gray-50 rounded-xl border border-gray-200">
                  {visibleCvSkills.map((skill) => (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => addSkill(skill)}
                      className="group inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-700 text-xs font-semibold hover:border-gray-300 hover:shadow-sm transition-all duration-200"
                    >
                      <span>{skill}</span>
                      <Plus
                        size={12}
                        className="text-gray-400 group-hover:rotate-90 transition-transform duration-200"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Suggested Skills */}
            {suggestedSkillsToShow.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-700 mb-2.5 flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 bg-emerald-100 rounded-md">
                    <Sparkles size={10} className="text-emerald-600" />
                  </span>
                  Additional Suggested Skills
                  <span className="text-gray-400 font-normal">
                    ({suggestedSkillsToShow.length}
                    {hiddenSuggestedSkillsCount > 0 &&
                      ` of ${suggestedSkills.filter((s) => !selectedSkills.includes(s) && !cvSkills.includes(s)).length}`}
                    )
                  </span>
                </p>
                <div className="flex flex-wrap gap-2 p-3.5 bg-emerald-50 rounded-xl border border-emerald-100">
                  {suggestedSkillsToShow.map((skill) => (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => addSkill(skill)}
                      className="group inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-200 rounded-lg text-emerald-700 text-xs font-semibold hover:bg-emerald-50 hover:border-emerald-300 hover:shadow-sm transition-all duration-200"
                    >
                      <span>{skill}</span>
                      <Plus
                        size={12}
                        className="text-emerald-500 group-hover:rotate-90 transition-transform duration-200"
                      />
                    </button>
                  ))}
                </div>
                {hiddenSuggestedSkillsCount > 0 && (
                  <p className="text-xs text-gray-400 mt-2 text-center">
                    + {hiddenSuggestedSkillsCount} more skill
                    {hiddenSuggestedSkillsCount > 1 ? "s" : ""} available. Use
                    search to find them.
                  </p>
                )}
              </div>
            )}

            {/* No CV skills */}
            {cvSkills.length === 0 && !authLoading && (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-xs text-amber-700 text-center font-medium">
                  💡 No skills extracted from your CV yet. Add custom skills
                  using the search box above.
                </p>
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <p className="mt-2 text-xs text-gray-400 text-center">
          {selectedSkills.length > 0
            ? `${selectedSkills.length} skill${selectedSkills.length !== 1 ? "s" : ""} selected · Remove unwanted skills or add more`
            : "Add skills using the search box above"}
        </p>
      </div>
    </div>
  );
};

export default SkillsSelector;

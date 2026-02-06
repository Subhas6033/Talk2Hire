import { useState } from "react";
import { Card, CardHeader, CardBody } from "../Common/Card";
import { X, Search, Plus, Check } from "lucide-react";

const PREDEFINED_SKILLS = [
  "Fullstack Developer",
  "Frontend Developer",
  "Backend Developer",
  "DevOps Engineer",
  "Cloud Engineer",
  "UI/UX Designer",
  "Mobile Developer",
  "Data Engineer",
  "Machine Learning Engineer",
  "QA Engineer",
];

const SkillsSelector = ({ selectedSkills = [], onSkillsChange }) => {
  const [inputValue, setInputValue] = useState("");

  // Check if input matches any predefined skill (case-insensitive)
  const findMatchingSkill = () => {
    const trimmedInput = inputValue.trim();
    if (!trimmedInput) return null;

    return PREDEFINED_SKILLS.find(
      (skill) =>
        skill.toLowerCase() === trimmedInput.toLowerCase() &&
        !selectedSkills.includes(skill),
    );
  };

  // Filter skills based on input
  const filteredSkills = PREDEFINED_SKILLS.filter(
    (skill) =>
      skill.toLowerCase().includes(inputValue.toLowerCase().trim()) &&
      !selectedSkills.includes(skill),
  );

  const matchingSkill = findMatchingSkill();
  const isExactMatch = !!matchingSkill;
  const canAddCustom =
    inputValue.trim() &&
    !isExactMatch &&
    !selectedSkills.some(
      (s) => s.toLowerCase() === inputValue.trim().toLowerCase(),
    );

  // Add skill (either from suggestions or custom)
  const addSkill = (skill) => {
    if (!selectedSkills.includes(skill)) {
      onSkillsChange([...selectedSkills, skill]);
      setInputValue("");
    }
  };

  // Remove skill
  const removeSkill = (skillToRemove) => {
    onSkillsChange(selectedSkills.filter((skill) => skill !== skillToRemove));
  };

  // Handle primary button click
  const handlePrimaryAction = () => {
    if (isExactMatch) {
      // Add the matching predefined skill
      addSkill(matchingSkill);
    } else if (canAddCustom) {
      // Add as custom skill (uppercase)
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

  // Determine button state
  const getButtonConfig = () => {
    if (isExactMatch) {
      return {
        icon: <Check size={16} />,
        text: "Select",
        disabled: false,
        className:
          "bg-green-500/20 border-green-500 text-green-500 hover:bg-green-500/30",
      };
    } else if (canAddCustom) {
      return {
        icon: <Plus size={16} />,
        text: "Add Custom",
        disabled: false,
        className:
          "bg-purpleGlow/20 border-purpleGlow text-purpleGlow hover:bg-purpleGlow/30",
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

  return (
    <Card variant="default" padding="lg" className="w-full mb-5">
      <CardHeader headerClass="text-center">
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-semibold text-white">
            Select Your Skills
          </h3>
          <p className="text-xs text-white/60">
            Search for skills or add your own custom skills
          </p>
        </div>
      </CardHeader>

      <CardBody>
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
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-purpleGlow transition"
            />
          </div>
          <button
            type="button"
            onClick={handlePrimaryAction}
            disabled={buttonConfig.disabled}
            className={`px-4 py-2 border rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap ${buttonConfig.className}`}
          >
            {buttonConfig.icon}
            {buttonConfig.text}
          </button>
        </div>

        {/* Helper text below input */}
        {inputValue.trim() && (
          <div className="mb-4 px-3 py-2 bg-white/5 rounded-lg border border-white/10">
            <p className="text-xs text-white/60">
              {isExactMatch ? (
                <>
                  ✓ Found:{" "}
                  <span className="text-green-400 font-medium">
                    {matchingSkill}
                  </span>{" "}
                  - Click "Select" to add
                </>
              ) : canAddCustom ? (
                <>
                  Custom skill:{" "}
                  <span className="text-purpleGlow font-medium">
                    {inputValue.trim().toUpperCase()}
                  </span>{" "}
                  - Click "Add Custom"
                </>
              ) : selectedSkills.some(
                  (s) => s.toLowerCase() === inputValue.trim().toLowerCase(),
                ) ? (
                <>
                  <span className="text-amber-400">Already added</span> - This
                  skill is in your selection
                </>
              ) : (
                <>Type to search or add a custom skill</>
              )}
            </p>
          </div>
        )}

        {/* Selected Skills */}
        {selectedSkills.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-white/70 mb-2">
              Selected ({selectedSkills.length})
            </p>
            <div className="flex flex-wrap gap-2 p-3 bg-white/5 rounded-lg border border-white/10 max-h-40 overflow-y-auto">
              {selectedSkills.map((skill) => (
                <div
                  key={skill}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-purpleGlow/20 border border-purpleGlow rounded-lg text-purpleGlow text-xs font-medium"
                >
                  <span>{skill}</span>
                  <button
                    type="button"
                    onClick={() => removeSkill(skill)}
                    className="hover:bg-purpleGlow/30 rounded-full p-0.5 transition"
                    aria-label={`Remove ${skill}`}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Available Skills - Only show when searching */}
        {inputValue.trim() && filteredSkills.length > 0 && (
          <div>
            <p className="text-xs font-medium text-white/70 mb-2">
              Matching Skills ({filteredSkills.length})
            </p>
            <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto p-3 bg-white/5 rounded-lg border border-white/10">
              {filteredSkills.map((skill) => (
                <button
                  key={skill}
                  type="button"
                  onClick={() => addSkill(skill)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/20 rounded-lg text-white/80 text-xs font-medium hover:bg-purpleGlow/10 hover:border-purpleGlow hover:text-purpleGlow transition"
                >
                  <span>{skill}</span>
                  <Plus size={14} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Show all available skills when input is empty */}
        {!inputValue.trim() && (
          <div>
            <p className="text-xs font-medium text-white/70 mb-2">
              Popular Skills
            </p>
            <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto p-3 bg-white/5 rounded-lg border border-white/10">
              {PREDEFINED_SKILLS.filter(
                (skill) => !selectedSkills.includes(skill),
              ).map((skill) => (
                <button
                  key={skill}
                  type="button"
                  onClick={() => addSkill(skill)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/20 rounded-lg text-white/80 text-xs font-medium hover:bg-purpleGlow/10 hover:border-purpleGlow hover:text-purpleGlow transition"
                >
                  <span>{skill}</span>
                  <Plus size={14} />
                </button>
              ))}
              {PREDEFINED_SKILLS.every((skill) =>
                selectedSkills.includes(skill),
              ) && (
                <p className="text-xs text-white/40 text-center w-full py-4">
                  All popular skills selected! Type to add custom skills.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Helper Text */}
        <p className="mt-3 text-xs text-white/40 text-center">
          Search from popular skills or type your own to add custom skills
        </p>
      </CardBody>
    </Card>
  );
};

export default SkillsSelector;

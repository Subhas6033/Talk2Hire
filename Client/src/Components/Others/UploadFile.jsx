import { useState, useEffect } from "react";
import { useAuth } from "../../Hooks/useAuthHook";
import { Button, SkillsSelector } from "../index";

const ResumeUploadCard = () => {
  const { user, updateUser } = useAuth();
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  // Load user's current skills on mount
  useEffect(() => {
    if (user?.skill) {
      // Convert comma-separated string back to array
      const skillsArray = user.skill
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      setSelectedSkills(skillsArray);
    }
  }, [user]);

  const handleUpdateSkills = async () => {
    if (selectedSkills.length === 0) {
      setMessage({ type: "error", text: "Please select at least one skill" });
      return;
    }

    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      // Convert array back to comma-separated string
      const skillsString = selectedSkills.join(", ");

      // Call your API to update skills
      await updateUser({ skill: skillsString });

      setMessage({ type: "success", text: "Skills updated successfully!" });
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message || "Failed to update skills",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Profile Settings</h1>

      <div className="space-y-6">
        {/* User Info */}
        <div className="bg-white/5 rounded-lg p-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-4">
            Your Information
          </h2>
          <div className="space-y-2 text-sm">
            <p className="text-white/60">
              <span className="font-medium text-white">Name:</span>{" "}
              {user?.fullName}
            </p>
            <p className="text-white/60">
              <span className="font-medium text-white">Email:</span>{" "}
              {user?.email}
            </p>
          </div>
        </div>

        {/* Skills Section */}
        <div>
          <SkillsSelector
            selectedSkills={selectedSkills}
            onSkillsChange={setSelectedSkills}
          />

          {message.text && (
            <p
              className={`mt-3 text-sm text-center ${
                message.type === "success" ? "text-green-400" : "text-red-400"
              }`}
            >
              {message.text}
            </p>
          )}

          <Button
            onClick={handleUpdateSkills}
            disabled={loading || selectedSkills.length === 0}
            className="w-full mt-4"
          >
            {loading ? "Updating..." : "Update Skills"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ResumeUploadCard;

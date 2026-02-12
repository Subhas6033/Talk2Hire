import { useState, useRef, useEffect } from "react";
import { useAuth } from "../Hooks/useAuthHook";
import {
  Button,
  Modal,
  PreviousInterview,
  SocialMediaSection,
} from "../Components/index";
import { FormField } from "../Components/Common/Input";

const ProfilePage = () => {
  const { user, updateUser } = useAuth();

  const [isModalOpen, setModalOpen] = useState(false);
  const [isResumeModalOpen, setResumeModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [resumeError, setResumeError] = useState("");
  const [uploading, setUploading] = useState(false);

  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(
    user?.profile_image_path || null,
  );
  const fileInputRef = useRef();

  const [selectedResume, setSelectedResume] = useState(null);
  const resumeInputRef = useRef();

  if (!user) return null;

  const firstLetter = user?.fullName.split(" ")[0];

  const handleDragOver = (e) => e.preventDefault();

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleUploadImage = async () => {
    if (!selectedImage) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("profileImage", selectedImage);

      await updateUser(formData).unwrap();

      setSelectedImage(null);
      console.log("Profile image uploaded successfully");
    } catch (err) {
      console.error("Failed to upload image:", err);
      setError("Failed to upload profile image");
    } finally {
      setUploading(false);
    }
  };

  const handleResumeChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type !== "application/pdf") {
        setResumeError("Please upload a PDF file");
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setResumeError("File size must be less than 5MB");
        return;
      }

      setResumeError("");
      setSelectedResume(file);
    }
  };

  const handleUploadResume = async () => {
    if (!selectedResume) {
      setResumeError("Please select a resume file");
      return;
    }

    setUploading(true);
    setResumeError("");

    try {
      const formData = new FormData();
      formData.append("resume", selectedResume);

      await updateUser(formData).unwrap();

      console.log("Resume uploaded successfully");
      setSelectedResume(null);
      setResumeModalOpen(false);
    } catch (err) {
      console.error("Failed to upload resume:", err);
      setResumeError(err.message || "Failed to upload resume");
    } finally {
      setUploading(false);
    }
  };

  const handlePasswordUpdate = () => {
    setError("");
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("All fields are required");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }
    console.log("Update password:", { currentPassword, newPassword });
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setModalOpen(false);
  };

  return (
    <>
      <title>QuantamHash Corporation | Profile</title>
      <meta
        name="description"
        content="This is the profile page of the user of QuantamHash Corporation"
      />
      <div className="max-w-7xl mx-auto p-6 text-white space-y-8">
        <h1 className="text-3xl font-bold mt-5">Profile</h1>
        <p className="text-sm text-white/50">View your profile details here.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6 w-full overflow-hidden">
          {/* Left Column */}
          <div className="flex flex-col items-center p-6 rounded-2xl shadow-lg border border-white/10 space-y-4 w-full">
            <div
              className="relative w-40 h-40 rounded-full border-4 border-purpleMain/40 overflow-hidden cursor-pointer hover:ring-2 hover:ring-purpleGlow transition"
              onClick={() => fileInputRef.current.click()}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="w-full h-full flex items-center justify-center text-5xl font-bold text-white/50">
                  {firstLetter}
                </span>
              )}

              <div className="absolute inset-x-0 bottom-0 h-16 bg-black/40 flex items-center justify-center text-xs text-white font-medium z-50 pointer-events-none text-center">
                Drag & Drop or Click to Upload
              </div>
            </div>

            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              className="hidden"
              onChange={handleImageChange}
            />

            {selectedImage && (
              <div className="flex gap-4 mt-2">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleUploadImage}
                  disabled={uploading}
                >
                  {uploading ? "Uploading..." : "Save"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setSelectedImage(null);
                    setPreviewUrl(user?.profile_image_path || null);
                  }}
                  disabled={uploading}
                >
                  Cancel
                </Button>
              </div>
            )}

            <div className="text-center mt-5">
              <h2 className="text-xl font-semibold">{user.fullName}</h2>
            </div>
          </div>

          {/* Right Column */}
          <div className="p-6 rounded-2xl shadow-lg border border-white/10 space-y-4 w-full">
            <h2 className="text-lg font-semibold mb-4">Bio & other details</h2>

            <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
              <p className="text-white/50">Full Name</p>
              <p className="font-semibold">{user.fullName}</p>

              <p className="text-white/50">Email</p>
              <p className="font-semibold">{user.email}</p>

              <p className="text-white/50">Total Interview Given</p>
              <p className="font-semibold">{user.totalInterview || "0"}</p>

              <p className="text-white/50">Previous Interview Score</p>
              <p className="font-semibold">{user.interviewScore || "N/A"}</p>

              <p className="text-white/50">Average Time Taken</p>
              <p className="font-semibold">{user.averageTime || "N/A"}</p>

              <p className="text-white/50">Overall Performance</p>
              <p className="font-semibold">{user.performance || "N/A"}</p>
            </div>

            <div className="mt-6 flex justify-center gap-4">
              <Button variant="primary" onClick={() => setModalOpen(true)}>
                Update Password
              </Button>

              <Button
                variant="primary"
                onClick={() => setResumeModalOpen(true)}
              >
                Update Resume
              </Button>
            </div>
          </div>
        </div>

        {/* Password Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setModalOpen(false)}
          title="Update Password"
          size="sm"
          footer={
            <Button variant="primary" onClick={handlePasswordUpdate}>
              Save Password
            </Button>
          }
        >
          <div className="space-y-4">
            <FormField
              label="Current Password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />

            <FormField
              label="New Password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />

            <FormField
              label="Confirm New Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={error && confirmPassword !== newPassword ? error : ""}
            />

            {error && <p className="text-red-400 text-sm">{error}</p>}
          </div>
        </Modal>

        {/* Resume Upload Modal */}
        <Modal
          isOpen={isResumeModalOpen}
          onClose={() => {
            setResumeModalOpen(false);
            setSelectedResume(null);
            setResumeError("");
          }}
          title="Update Resume"
          size="sm"
          footer={
            <div className="flex gap-4">
              <Button
                variant="primary"
                onClick={handleUploadResume}
                disabled={uploading || !selectedResume}
              >
                {uploading ? "Uploading..." : "Upload Resume"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setResumeModalOpen(false);
                  setSelectedResume(null);
                  setResumeError("");
                }}
                disabled={uploading}
              >
                Cancel
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Select Resume (PDF only, max 5MB)
              </label>

              <input
                type="file"
                accept="application/pdf"
                ref={resumeInputRef}
                className="hidden"
                onChange={handleResumeChange}
              />

              <div
                onClick={() => resumeInputRef.current.click()}
                className="border-2 border-dashed border-white/20 rounded-lg p-8 text-center cursor-pointer hover:border-purpleGlow transition"
              >
                {selectedResume ? (
                  <div className="space-y-2">
                    <svg
                      className="w-12 h-12 mx-auto text-green-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <p className="text-white font-medium">
                      {selectedResume.name}
                    </p>
                    <p className="text-sm text-white/50">
                      {(selectedResume.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <svg
                      className="w-12 h-12 mx-auto text-white/50"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    <p className="text-white/70">
                      Click to browse or drag and drop
                    </p>
                    <p className="text-sm text-white/50">
                      PDF files only (max 5MB)
                    </p>
                  </div>
                )}
              </div>
            </div>

            {resumeError && (
              <p className="text-red-400 text-sm">{resumeError}</p>
            )}

            {user?.resume &&
              user?.resume_upload_status === "completed" &&
              !selectedResume && (
                <div className="bg-white/5 rounded-lg p-3 text-sm">
                  <p className="text-white/70">Current resume status:</p>
                  <p className="text-green-400 font-medium">
                    ✅ Uploaded successfully
                  </p>
                </div>
              )}
          </div>
        </Modal>

        {/* Social Media Section */}
        <div className="w-full overflow-x-auto">
          <SocialMediaSection />
        </div>

        {/* Previous Interviews */}
        <div className="w-full overflow-x-auto">
          <PreviousInterview />
        </div>
      </div>
    </>
  );
};

export default ProfilePage;

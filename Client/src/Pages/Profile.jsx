import { useState, useRef, use } from "react";
import { useAuth } from "../Hooks/useAuthHook";
import {
  Button,
  Modal,
  PreviousInterview,
  SocialMediaSection,
} from "../Components/index";
import { FormField } from "../Components/Common/Input";

const ProfilePage = () => {
  const { user } = useAuth();

  const [isModalOpen, setModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  // Image Upload
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(user?.profileImage || null);
  const fileInputRef = useRef();

  if (!user) return null;

  // const firstLetter = user.fullName?.charAt(0).toUpperCase();
  const firstLetter = user?.fullName.split(" ")[0];

  // Drag & Drop
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

  const handleUploadImage = () => {
    if (!selectedImage) return;
    console.log("Uploading image:", selectedImage);
    // TODO: Call API to save image
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
    <div className="max-w-7xl mx-auto p-6 text-white space-y-8">
      <h1 className="text-3xl font-bold mt-5">Profile</h1>
      <p className="text-sm text-white/50">View your profile details here.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6 w-full overflow-hidden">
        {/* Left Column */}
        <div className="flex flex-col items-center p-6 rounded-2xl shadow-lg border border-white/10 space-y-4 w-full">
          {/* Profile Avatar Upload */}
          <div
            className="relative w-40 h-40 rounded-full border-4 border-purpleMain/40 overflow-hidden cursor-pointer hover:ring-2 hover:ring-purpleGlow transition"
            onClick={() => fileInputRef.current.click()}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {/* Image */}
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

            {/* Overlay */}
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

          {/* Save and Cancel buttons */}
          {selectedImage && (
            <div className="flex gap-4 mt-2">
              <Button size="sm" variant="primary" onClick={handleUploadImage}>
                Save
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setSelectedImage(null);
                  setPreviewUrl(user?.profileImage || null);
                }}
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

            <p className="text-white/50">Overall Performace</p>
            <p className="font-semibold">{user.performance || "N/A"}</p>
          </div>

          <div className="mt-6 flex justify-center ">
            <Button variant="primary" onClick={() => setModalOpen(true)}>
              Update Password
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

      {/* Social Media Section */}
      <div className="w-full overflow-x-auto">
        <SocialMediaSection />
      </div>

      {/* Previous Interviews */}
      <div className="w-full overflow-x-auto">
        <PreviousInterview />
      </div>
    </div>
  );
};

export default ProfilePage;

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../Components/index";
import {
  Eye,
  EyeOff,
  Upload,
  X,
  Sparkles,
  AlertCircle,
  FileText,
  Shield,
  Zap,
} from "lucide-react";

const RegistrationForm = () => {
  const navigate = useNavigate();

  const [resumeFile, setResumeFile] = useState(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const API_URL = import.meta.env.VITE_BACKEND_URL;

  const handleResumeChange = (e) => {
    const file = e.target.files[0];
    setUploadError(null);

    if (!file) {
      setResumeFile(null);
      return;
    }

    if (file.type !== "application/pdf") {
      setUploadError("Only PDF files are allowed");
      setResumeFile(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File size must be less than 5MB");
      setResumeFile(null);
      return;
    }

    setResumeFile(file);
  };

  const removeResume = () => {
    setResumeFile(null);
    setUploadError(null);
    const fileInput = document.getElementById("resume-upload");
    if (fileInput) fileInput.value = "";
  };

  const handleContinue = () => {
    if (!resumeFile) {
      setUploadError("Please upload your resume");
      return;
    }

    if (!password || password.length < 6) {
      setUploadError("Password must be at least 6 characters");
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    sessionStorage.setItem("showOnboarding", "true");
    navigate("/", { replace: true });

    setTimeout(() => {
      backgroundUpload(resumeFile, password);
    }, 100);
  };

  const backgroundUpload = async (file, pwd) => {
    try {
      const formData = new FormData();
      formData.append("password", pwd);
      formData.append("resume", file);

      const response = await fetch(`${API_URL}/api/v1/auth/upload-resume`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          "❌ Background upload failed:",
          response.status,
          errorText,
        );
        return;
      }

      const result = await response.json();

      if (result.data && result.data.sessionId) {
        const { sessionId } = result.data;
        sessionStorage.setItem("registrationSessionId", sessionId);
      } else {
        console.error("❌ No session ID in response:", result);
      }
    } catch (error) {
      console.error("❌ Background upload error:", error);
    }
  };

  return (
    <>
      <title>QuantamHash Corporation | Sign Up</title>
      <div className="min-h-screen bg-linear-to-br from-bgDark via-[#11162a] to-bgDark relative overflow-hidden">
        {/* Animated Background Glows */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-[-10%] left-[-5%] w-100 h-100 rounded-full bg-linear-to-br from-purple-500 to-pink-500 blur-[100px] animate-pulse" />
          <div
            className="absolute bottom-[-10%] right-[-5%] w-100 h-100 rounded-full bg-linear-to-br from-blue-500 to-cyan-500 blur-[100px] animate-pulse"
            style={{ animationDelay: "1s" }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 container mx-auto px-6 py-16">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              {/* Left Side - Info Section */}
              <div className="space-y-8 animate-in fade-in slide-in-from-left duration-700">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span className="text-sm text-purple-300 font-medium">
                      AI-Powered Registration
                    </span>
                  </div>

                  <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight">
                    Join the Future of{" "}
                    <span className="bg-linear-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                      AI Interviews
                    </span>
                  </h1>

                  <p className="text-xl text-white/70 leading-relaxed">
                    Upload your resume and let our advanced AI create your
                    personalized profile automatically. No manual data entry
                    required.
                  </p>
                </div>

                {/* Features */}
                <div className="space-y-4">
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                    <div className="p-2 rounded-lg bg-purple-500/20">
                      <FileText className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold mb-1">
                        Smart Resume Parsing
                      </h3>
                      <p className="text-sm text-white/60">
                        AI extracts your skills, experience, and qualifications
                        automatically
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                    <div className="p-2 rounded-lg bg-blue-500/20">
                      <Zap className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold mb-1">
                        Instant Setup
                      </h3>
                      <p className="text-sm text-white/60">
                        Get started in seconds with automated profile creation
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                    <div className="p-2 rounded-lg bg-green-500/20">
                      <Shield className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold mb-1">
                        Secure & Private
                      </h3>
                      <p className="text-sm text-white/60">
                        Your data is encrypted and protected with
                        enterprise-grade security
                      </p>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-6 pt-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-white mb-1">
                      10K+
                    </div>
                    <div className="text-sm text-white/60">Active Users</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-white mb-1">
                      95%
                    </div>
                    <div className="text-sm text-white/60">Success Rate</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-white mb-1">
                      24/7
                    </div>
                    <div className="text-sm text-white/60">AI Support</div>
                  </div>
                </div>
              </div>

              {/* Right Side - Form Section */}
              <div className="animate-in fade-in slide-in-from-right duration-700">
                <div className="max-w-xl mx-auto space-y-8">
                  {/* Form Header */}
                  <div className="text-center space-y-3">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-linear-to-br from-purple-500 to-pink-500 shadow-2xl shadow-purple-500/30 mb-2">
                      <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-3xl font-bold text-white">
                      Create Your Account
                    </h2>
                    <p className="text-white/60">
                      Get started with AI-powered interviews
                    </p>
                  </div>

                  {/* Form */}
                  <div className="space-y-6">
                    {/* Resume Upload */}
                    <div>
                      <label className="block text-sm font-medium text-white/80 mb-3">
                        Upload Your Resume
                      </label>

                      {!resumeFile ? (
                        <label
                          htmlFor="resume-upload"
                          className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-white/20 rounded-xl cursor-pointer hover:border-purpleGlow hover:bg-white/5 transition-all group"
                        >
                          <div className="flex flex-col items-center space-y-3">
                            <div className="p-3 rounded-xl bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
                              <Upload className="w-8 h-8 text-purple-400" />
                            </div>
                            <div className="text-center">
                              <span className="text-sm text-white/80 font-medium block">
                                Click to upload or drag and drop
                              </span>
                              <span className="text-xs text-white/50 mt-1 block">
                                PDF only (max 5MB)
                              </span>
                            </div>
                          </div>
                          <input
                            id="resume-upload"
                            type="file"
                            accept=".pdf"
                            onChange={handleResumeChange}
                            className="hidden"
                            disabled={isUploading}
                          />
                        </label>
                      ) : (
                        <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="p-2 rounded-lg bg-purple-500/20">
                              <FileText className="w-5 h-5 text-purple-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white font-medium truncate">
                                {resumeFile.name}
                              </p>
                              <p className="text-xs text-white/50">
                                {(resumeFile.size / 1024).toFixed(1)} KB
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={removeResume}
                            disabled={isUploading}
                            className="ml-3 p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <X className="w-5 h-5 text-white/60" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Password */}
                    <div>
                      <label className="block text-sm font-medium text-white/80 mb-3">
                        Create Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          disabled={isUploading}
                          className="w-full px-4 py-3 pr-12 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-purpleGlow/50 transition-all disabled:opacity-50"
                          placeholder="Enter password (min 6 characters)"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          disabled={isUploading}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/40 hover:text-white/80 transition-colors disabled:opacity-50"
                        >
                          {showPassword ? (
                            <EyeOff className="w-5 h-5" />
                          ) : (
                            <Eye className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-white/50 mt-2">
                        Must be at least 6 characters long
                      </p>
                    </div>

                    {/* Error Message */}
                    {uploadError && (
                      <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 animate-in fade-in duration-300">
                        <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                        <p className="text-sm text-red-400">{uploadError}</p>
                      </div>
                    )}

                    {/* Submit Button */}
                    <Button
                      onClick={handleContinue}
                      disabled={!resumeFile || !password || isUploading}
                      size="lg"
                      className="w-full text-base"
                    >
                      {isUploading ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5 mr-2" />
                          Get Started
                        </>
                      )}
                    </Button>

                    {/* Terms */}
                    <p className="text-xs text-white/50 text-center">
                      By continuing, you agree to our{" "}
                      <button className="text-purple-400 hover:text-purple-300 underline">
                        Terms of Service
                      </button>{" "}
                      and{" "}
                      <button className="text-purple-400 hover:text-purple-300 underline">
                        Privacy Policy
                      </button>
                    </p>
                  </div>

                  {/* Sign In Link */}
                  <div className="text-center pt-4">
                    <p className="text-white/60">
                      Already have an account?{" "}
                      <button
                        onClick={() => navigate("/login")}
                        className="text-purple-400 hover:text-purple-300 font-semibold transition-colors"
                      >
                        Sign in
                      </button>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default RegistrationForm;

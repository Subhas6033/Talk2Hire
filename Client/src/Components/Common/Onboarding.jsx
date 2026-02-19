import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { Button } from "../index";
import { FormField } from "../Common/Input";
import {
  CheckCircle,
  ChevronRight,
  Sparkles,
  Brain,
  Shield,
  Zap,
  Rocket,
  Loader2,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import { useAuth } from "../../Hooks/useAuthHook";

const OnboardingFlow = ({ isOpen, onComplete }) => {
  const navigate = useNavigate();
  const { getCurrentUser } = useAuth();

  const [currentStep, setCurrentStep] = useState(0);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [dataLoadingMessage, setDataLoadingMessage] = useState(
    "Uploading your resume...",
  );
  const [registrationError, setRegistrationError] = useState(null);

  const API_URL = import.meta.env.VITE_BACKEND_URL;

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({
    mode: "onTouched",
    defaultValues: {
      fullName: "",
      mobile: "",
      email: "",
      location: "",
      skills: "",
    },
  });

  const slides = [
    {
      icon: Sparkles,
      gradient: "from-purple-500 via-pink-500 to-orange-500",
      title: "Welcome to AI Interview System",
      description:
        "Experience the future of technical interviews with our cutting-edge AI-powered platform",
      features: [
        "Real-time voice interviews",
        "Intelligent question generation",
        "Instant feedback & scoring",
      ],
    },
    {
      icon: Brain,
      gradient: "from-blue-500 via-purple-500 to-pink-500",
      title: "AI-Powered Analysis",
      description:
        "Our advanced AI is analyzing your resume right now to create a personalized profile",
      features: [
        "Resume parsing & skill extraction",
        "Domain detection",
        "Custom question generation",
      ],
    },
    {
      icon: Zap,
      gradient: "from-cyan-500 via-blue-500 to-purple-500",
      title: "Instant Profile Setup",
      description:
        "We're automatically extracting your information - no manual data entry required",
      features: [
        "One-click resume upload",
        "Automatic data extraction",
        "Smart profile completion",
      ],
    },
    {
      icon: Shield,
      gradient: "from-orange-500 via-red-500 to-pink-500",
      title: "Secure & Private",
      description:
        "Your data is encrypted and protected with enterprise-grade security",
      features: [
        "End-to-end encryption",
        "GDPR compliant",
        "Privacy-first approach",
      ],
    },
    {
      icon: Rocket,
      gradient: "from-green-500 via-emerald-500 to-cyan-500",
      title: "Almost Ready!",
      description:
        "Your profile is being prepared. In a moment, you'll review your information!",
      features: [
        "Start interviewing now",
        "Track your progress",
        "Improve with AI feedback",
      ],
    },
  ];

  const loadingMessages = [
    "Uploading your resume...",
    "Analyzing your resume...",
    "Extracting your skills...",
    "Identifying your expertise...",
    "Preparing your profile...",
    "Almost there...",
  ];

  // Auto-play carousel
  useEffect(() => {
    if (currentStep !== 0 || !isAutoPlaying) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => {
        if (prev === slides.length - 1) {
          return prev;
        }
        return prev + 1;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [currentStep, isAutoPlaying, slides.length]);

  // Rotate loading messages
  useEffect(() => {
    if (!isDataLoading) return;

    let messageIndex = 0;
    const messageInterval = setInterval(() => {
      messageIndex = (messageIndex + 1) % loadingMessages.length;
      setDataLoadingMessage(loadingMessages[messageIndex]);
    }, 2000);

    return () => clearInterval(messageInterval);
  }, [isDataLoading]);

  // Enhanced polling
  useEffect(() => {
    if (!isOpen) return;

    let sessionCheckInterval;
    let pollInterval;

    // Phase 1: Wait for session ID
    const waitForSessionId = () => {
      sessionCheckInterval = setInterval(() => {
        const sessionId = sessionStorage.getItem("registrationSessionId");

        if (sessionId) {
          clearInterval(sessionCheckInterval);
          startPolling(sessionId);
        }
      }, 500);
    };

    // Phase 2: Poll extraction status
    const startPolling = (sessionId) => {
      let attempts = 0;
      const maxAttempts = 60;
      let foundData = false;

      pollInterval = setInterval(async () => {
        attempts++;

        try {
          const url = `${API_URL}/api/v1/auth/extraction-status/${sessionId}`;
          const response = await fetch(url, { credentials: "include" });

          if (!response.ok) {
            const errorText = await response.text();
            console.error("❌ Polling failed:", response.status, errorText);
            return;
          }

          const result = await response.json();
          const data = result.data;

          if (data.status === "completed" && data.extractedData && !foundData) {
            foundData = true;
            clearInterval(pollInterval);

            // Pre-fill form
            setValue("fullName", data.extractedData.fullName || "");
            setValue("email", data.extractedData.email || "");
            setValue("mobile", data.extractedData.mobile || "");
            setValue("location", data.extractedData.location || "");
            setValue("skills", data.extractedData.cvSkills?.join(", ") || "");

            setIsDataLoading(false);

            // Auto-advance to form
            setTimeout(() => {
              setCurrentStep(1);
            }, 2000);
          } else if (data.status === "failed") {
            clearInterval(pollInterval);
            console.error("❌ Extraction FAILED:", data.error);
            setIsDataLoading(false);
            setRegistrationError(data.error || "Failed to extract resume data");
          }
        } catch (error) {
          console.error("❌ Polling error:", error);
        }

        if (attempts >= maxAttempts && !foundData) {
          clearInterval(pollInterval);
          console.warn("⏰ Polling timeout - showing form anyway");
          setIsDataLoading(false);
          setCurrentStep(1);
        }
      }, 1000);
    };

    // Start waiting for session ID
    waitForSessionId();

    // Cleanup
    return () => {
      if (sessionCheckInterval) clearInterval(sessionCheckInterval);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [isOpen, API_URL, setValue]);

  const goToSlide = (index) => {
    setCurrentSlide(index);
    setIsAutoPlaying(false);
  };

  const handleCarouselNext = () => {
    if (currentSlide === slides.length - 1) {
      setCurrentStep(1);
    } else {
      setCurrentSlide((prev) => prev + 1);
      setIsAutoPlaying(false);
    }
  };

  const handleProfileSubmit = async (data) => {
    try {
      setRegistrationError(null);

      const sessionId = sessionStorage.getItem("registrationSessionId");
      if (!sessionId) {
        throw new Error("Session ID not found");
      }

      const response = await fetch(
        `${API_URL}/api/v1/auth/complete-registration`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            sessionId,
            fullName: data.fullName,
            email: data.email,
            mobile: data.mobile,
            location: data.location,
            skills: data.skills,
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("❌ Registration failed:", errorData);
        throw new Error(errorData.message || "Registration failed");
      }

      const result = await response.json();

      // Clear session data
      sessionStorage.removeItem("registrationSessionId");
      sessionStorage.removeItem("showOnboarding");

      // Update Redux state with user data
      await getCurrentUser();

      onComplete();
      navigate("/", { replace: true });
    } catch (error) {
      console.error("❌ Registration failed:", error);
      setRegistrationError(
        error.message || "Failed to complete registration. Please try again.",
      );
    }
  };

  const renderCarousel = () => {
    const currentSlideData = slides[currentSlide];
    const Icon = currentSlideData.icon;

    return (
      <div className="min-h-screen bg-linear-to-br from-bgDark via-[#11162a] to-bgDark relative overflow-hidden">
        {/* Animated Background Glows */}
        <div className="absolute inset-0 opacity-20">
          <div
            className={`absolute top-[-10%] left-[-5%] w-100 h-100 rounded-full bg-linear-to-br ${currentSlideData.gradient} blur-[100px] transition-all duration-1000 animate-pulse`}
          />
          <div
            className={`absolute bottom-[-10%] right-[-5%] w-100 h-100 rounded-full bg-linear-to-br ${currentSlideData.gradient} blur-[100px] transition-all duration-1000 animate-pulse`}
            style={{ animationDelay: "1s" }}
          />
        </div>

        {/* Content Container */}
        <div className="relative z-10 container mx-auto px-6 py-20">
          {/* Progress Bar */}
          <div className="max-w-2xl mx-auto mb-12">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-white/60">
                Step {currentSlide + 1} of {slides.length}
              </span>
              <button
                onClick={() => setCurrentStep(1)}
                className="text-xs text-white/60 hover:text-white transition-colors"
              >
                Skip to profile setup →
              </button>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-linear-to-r from-purple-500 via-pink-500 to-orange-500 transition-all duration-500 ease-out"
                style={{
                  width: `${((currentSlide + 1) / slides.length) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* Main Content */}
          <div className="max-w-4xl mx-auto">
            <div
              key={currentSlide}
              className="text-center space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700"
            >
              {/* Icon */}
              <div className="flex justify-center">
                <div
                  className={`inline-flex items-center justify-center w-32 h-32 rounded-3xl bg-linear-to-br ${currentSlideData.gradient} shadow-2xl shadow-purple-500/30 animate-in zoom-in duration-700`}
                >
                  <Icon className="w-16 h-16 text-white" strokeWidth={1.5} />
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-4">
                <h2 className="text-5xl md:text-6xl font-bold text-white leading-tight">
                  {currentSlideData.title}
                </h2>
                <p className="text-xl md:text-2xl text-white/70 max-w-2xl mx-auto leading-relaxed">
                  {currentSlideData.description}
                </p>
              </div>

              {/* Features */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto pt-6">
                {currentSlideData.features.map((feature, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 px-6 py-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-all animate-in fade-in slide-in-from-bottom-4 duration-500"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
                    <span className="text-sm text-white/80 font-medium text-left">
                      {feature}
                    </span>
                  </div>
                ))}
              </div>

              {/* Navigation Buttons */}
              <div className="flex justify-center gap-4 pt-8">
                {currentSlide > 0 && (
                  <Button
                    variant="secondary"
                    size="lg"
                    onClick={() => setCurrentSlide((prev) => prev - 1)}
                    className="px-8"
                  >
                    <ArrowLeft className="w-5 h-5 mr-2" />
                    Previous
                  </Button>
                )}
                <Button
                  onClick={handleCarouselNext}
                  size="lg"
                  className="px-8 py-6 text-lg font-semibold flex items-center gap-2"
                >
                  {currentSlide === slides.length - 1
                    ? "Continue to Profile"
                    : "Next"}
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Slide Indicators */}
          <div className="flex justify-center gap-3 mt-16">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className="group relative"
                aria-label={`Go to slide ${index + 1}`}
              >
                <div
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    index === currentSlide
                      ? "bg-white scale-125"
                      : "bg-white/30 hover:bg-white/50"
                  }`}
                />
                {index === currentSlide && (
                  <div className="absolute inset-0 -m-1.5 rounded-full border-2 border-white/30 animate-ping" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderReviewForm = () => (
    <div className="min-h-screen bg-linear-to-br from-bgDark via-[#11162a] to-bgDark relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-[-10%] left-[-5%] w-100 h-100 rounded-full bg-linear-to-br from-green-500 to-emerald-500 blur-[100px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-5%] w-100 h-100 rounded-full bg-linear-to-br from-purple-500 to-pink-500 blur-[100px] animate-pulse" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-6 py-12">
        <div className="max-w-6xl mx-auto">
          <form
            onSubmit={handleSubmit(handleProfileSubmit)}
            className="space-y-12"
          >
            {/* Header */}
            <div className="text-center space-y-6">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-linear-to-br from-green-500 to-emerald-600 shadow-2xl shadow-green-500/30 animate-in zoom-in duration-500">
                <CheckCircle className="w-12 h-12 text-white" />
              </div>
              <div className="space-y-3">
                <h3 className="text-4xl md:text-5xl font-bold text-white animate-in fade-in slide-in-from-bottom-4 duration-500">
                  Review Your Information
                </h3>
                <p className="text-lg text-white/60 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
                  We've automatically filled your profile from your resume.
                  Review and edit if needed.
                </p>
              </div>
            </div>

            {/* Loading State */}
            {isDataLoading && (
              <div className="p-10 rounded-2xl bg-linear-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 backdrop-blur-sm animate-in fade-in duration-500 max-w-2xl mx-auto">
                <div className="flex flex-col items-center justify-center space-y-6">
                  <div className="relative">
                    <Loader2 className="w-20 h-20 text-purple-400 animate-spin" />
                    <div className="absolute inset-0 w-20 h-20 rounded-full border-2 border-purple-500/30 animate-ping" />
                  </div>
                  <div className="text-center space-y-3">
                    <p className="text-white font-medium text-2xl animate-pulse">
                      {dataLoadingMessage}
                    </p>
                    <p className="text-white/50 text-lg">
                      Our AI is working its magic on your resume
                    </p>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <div
                      className="w-4 h-4 bg-purple-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    />
                    <div
                      className="w-4 h-4 bg-pink-400 rounded-full animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    />
                    <div
                      className="w-4 h-4 bg-orange-400 rounded-full animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Error State */}
            {registrationError && (
              <div className="max-w-2xl mx-auto p-6 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-4">
                <AlertCircle className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
                <p className="text-base text-red-400">{registrationError}</p>
              </div>
            )}

            {/* Form Fields */}
            <div
              className={`grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 ${
                isDataLoading ? "opacity-50 pointer-events-none" : "opacity-100"
              } transition-opacity`}
            >
              {/* Left Column */}
              <div className="space-y-6 p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                <FormField
                  label="Full Name"
                  placeholder="John Doe"
                  error={errors.fullName?.message}
                  disabled={isDataLoading}
                  {...register("fullName", {
                    required: "Full name is required",
                  })}
                />

                <FormField
                  label="Mobile Number"
                  placeholder="+1 (555) 000-0000"
                  error={errors.mobile?.message}
                  disabled={isDataLoading}
                  {...register("mobile")}
                />

                <FormField
                  label="Email Address"
                  type="email"
                  disabled
                  {...register("email")}
                />
              </div>

              {/* Right Column */}
              <div className="space-y-6 p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                <FormField
                  label="Location"
                  placeholder="City, Country"
                  error={errors.location?.message}
                  disabled={isDataLoading}
                  {...register("location")}
                />

                <div className="space-y-3">
                  <label className="text-sm font-medium text-white/80 flex items-center gap-2">
                    Skills
                    {!isDataLoading && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-normal">
                        <CheckCircle className="w-3 h-3" />
                        Auto-detected
                      </span>
                    )}
                  </label>
                  <textarea
                    {...register("skills", {
                      required: "Skills are required",
                    })}
                    rows={6}
                    disabled={isDataLoading}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-purpleGlow/50 resize-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="React, Node.js, Python, etc."
                  />
                  {errors.skills && (
                    <p className="text-sm text-red-400">
                      {errors.skills.message}
                    </p>
                  )}
                  <p className="text-xs text-white/40">
                    Separate skills with commas. You can edit or add more
                    skills.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-2xl mx-auto pt-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
              <Button
                type="button"
                variant="secondary"
                size="lg"
                onClick={() => {
                  sessionStorage.removeItem("registrationSessionId");
                  sessionStorage.removeItem("showOnboarding");
                  onComplete();
                  navigate("/");
                }}
                className="flex-1 sm:flex-none sm:min-w-48"
              >
                Skip for now
              </Button>
              <Button
                type="submit"
                size="lg"
                disabled={isDataLoading}
                className="flex-1 sm:flex-none sm:min-w-48"
              >
                {isDataLoading ? "Please wait..." : "Complete Registration"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  if (!isOpen) return null;

  return currentStep === 0 ? renderCarousel() : renderReviewForm();
};

export default OnboardingFlow;

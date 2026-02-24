import { useState, useEffect } from "react";
import { Button } from "../index";
import {
  ChevronRight,
  Sparkles,
  Brain,
  Shield,
  Zap,
  Rocket,
  CheckCircle,
} from "lucide-react";

const WelcomeCarousel = ({ onComplete }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const slides = [
    {
      icon: Sparkles,
      gradient: "from-purple-500 via-pink-500 to-orange-500",
      title: "Welcome to Talk2Hire",
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
        "Our advanced AI analyzes your resume and creates personalized interview questions tailored to your expertise",
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
        "Upload your resume and let our AI extract your information automatically - no manual data entry required",
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
        "Your data is encrypted and protected with enterprise-grade security. We never share your information without permission",
      features: [
        "End-to-end encryption",
        "GDPR compliant",
        "Privacy-first approach",
      ],
    },
    {
      icon: Rocket,
      gradient: "from-green-500 via-emerald-500 to-cyan-500",
      title: "Ready to Get Started?",
      description:
        "Join thousands of candidates who are acing their interviews with our AI-powered platform",
      features: [
        "Start interviewing in minutes",
        "Track your progress",
        "Improve with AI feedback",
      ],
    },
  ];

  // Auto-play slides
  useEffect(() => {
    if (!isAutoPlaying) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => {
        if (prev === slides.length - 1) {
          return prev; // Stop at last slide
        }
        return prev + 1;
      });
    }, 5000); // 5 seconds per slide

    return () => clearInterval(interval);
  }, [isAutoPlaying, slides.length]);

  const goToSlide = (index) => {
    setCurrentSlide(index);
    setIsAutoPlaying(false); // Stop auto-play when user manually navigates
  };

  const handleNext = () => {
    if (currentSlide === slides.length - 1) {
      onComplete(); // Finish onboarding
    } else {
      setCurrentSlide((prev) => prev + 1);
      setIsAutoPlaying(false);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const currentSlideData = slides[currentSlide];
  const Icon = currentSlideData.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-linear-to-br from-bgDark via-[#11162a] to-bgDark">
      {/* Animated Background Gradient */}
      <div className="absolute inset-0 opacity-30">
        <div
          className={`absolute top-[-20%] left-[-10%] w-125 h-125 rounded-full bg-linear-to-br ${currentSlideData.gradient} blur-[120px] transition-all duration-1000`}
        />
        <div
          className={`absolute bottom-[-20%] right-[-10%] w-125 h-125 rounded-full bg-linear-to-br ${currentSlideData.gradient} blur-[120px] transition-all duration-1000`}
        />
      </div>

      {/* Content Container */}
      <div className="relative z-10 w-full max-w-4xl mx-4 px-6 py-8">
        {/* Skip Button (Top Right) */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 px-4 py-2 text-sm text-white/60 hover:text-white transition-colors"
        >
          Skip
        </button>

        {/* Slide Content */}
        <div
          key={currentSlide}
          className="text-center space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700"
        >
          {/* Icon */}
          <div className="flex justify-center">
            <div
              className={`inline-flex items-center justify-center w-28 h-28 rounded-3xl bg-linear-to-br ${currentSlideData.gradient} shadow-2xl shadow-purple-500/30 animate-in zoom-in duration-700`}
            >
              <Icon className="w-14 h-14 text-white" strokeWidth={1.5} />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-4xl md:text-5xl font-bold text-white leading-tight max-w-2xl mx-auto">
            {currentSlideData.title}
          </h2>

          {/* Description */}
          <p className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto leading-relaxed">
            {currentSlideData.description}
          </p>

          {/* Features */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center max-w-3xl mx-auto pt-4">
            {currentSlideData.features.map((feature, index) => (
              <div
                key={index}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-500"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-sm text-white/80 font-medium">
                  {feature}
                </span>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center gap-4 pt-6">
            <Button
              onClick={handleNext}
              size="lg"
              className="px-8 py-6 text-lg font-semibold flex items-center gap-2"
            >
              {currentSlide === slides.length - 1 ? "Get Started" : "Next"}
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Dots Navigation */}
        <div className="flex justify-center gap-3 mt-12">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className="group relative"
            >
              {/* Dot */}
              <div
                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                  index === currentSlide
                    ? "bg-white scale-125"
                    : "bg-white/30 hover:bg-white/50"
                }`}
              />

              {/* Active Indicator Ring */}
              {index === currentSlide && (
                <div className="absolute inset-0 -m-1.5 rounded-full border-2 border-white/30 animate-ping" />
              )}
            </button>
          ))}
        </div>

        {/* Progress Bar */}
        <div className="mt-6 max-w-md mx-auto">
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-linear-to-r from-purple-500 to-pink-500 transition-all duration-300 ease-out"
              style={{
                width: `${((currentSlide + 1) / slides.length) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeCarousel;

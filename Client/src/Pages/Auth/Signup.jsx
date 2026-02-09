import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
} from "../../Components/Common/Card";
import { Button } from "../../Components";
import { FormField } from "../../Components/Common/Input";
import { Eye, EyeOff, Upload, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../Hooks/useAuthHook";

const Loader = () => (
  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
);

const Signup = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeError, setResumeError] = useState("");
  const {
    registerUser,
    loading,
    error,
    isAuthenticated,
    user,
    checkResumeStatus,
  } = useAuth();
  const [showUploadStatus, setShowUploadStatus] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm({
    mode: "onTouched",
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      terms: false,
    },
  });

  const handleResumeChange = (e) => {
    const file = e.target.files[0];
    setResumeError("");

    if (!file) {
      setResumeFile(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setResumeError("File size must be less than 5MB");
      setResumeFile(null);
      return;
    }

    const allowedTypes = ["application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      setResumeError("Only PDF files are allowed");
      setResumeFile(null);
      return;
    }

    setResumeFile(file);
  };

  const removeResume = () => {
    setResumeFile(null);
    setResumeError("");
    const fileInput = document.getElementById("resume-upload");
    if (fileInput) fileInput.value = "";
  };

  const onSubmit = async (data) => {
    if (!resumeFile) {
      setResumeError("Please upload your resume");
      return;
    }

    const formData = new FormData();
    formData.append("fullName", data.fullName);
    formData.append("email", data.email);
    formData.append("password", data.password);
    formData.append("resume", resumeFile);

    try {
      await registerUser(formData).unwrap();
      setShowUploadStatus(true);
    } catch (err) {
      console.error("Registration failed:", err);
    }
  };

  // ✅ Poll for resume status if uploading
  useEffect(() => {
    if (isAuthenticated && user?.resumeStatus === "uploading") {
      const interval = setInterval(() => {
        checkResumeStatus();
      }, 5000); // Check every 5 seconds

      return () => clearInterval(interval);
    }
  }, [isAuthenticated, user?.resumeStatus, checkResumeStatus]);

  // ✅ Navigate when upload is complete
  useEffect(() => {
    if (isAuthenticated && user?.resumeStatus === "completed") {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  // ✅ Show upload progress screen
  if (
    showUploadStatus &&
    isAuthenticated &&
    user?.resumeStatus === "uploading"
  ) {
    return (
      <>
        <title>QuantamHash Corporation | Uploading Resume</title>
        <section className="min-h-screen flex items-center justify-center px-6">
          <div className="text-center space-y-6 max-w-md">
            <div className="relative">
              <div className="w-24 h-24 mx-auto">
                <div className="absolute inset-0 border-4 border-purpleGlow/30 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-transparent border-t-purpleGlow rounded-full animate-spin"></div>
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white">
                Registration Successful! 🎉
              </h2>
              <p className="text-white/70">Your account has been created</p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-center gap-2 text-purpleGlow">
                <Upload className="w-5 h-5 animate-pulse" />
                <span className="font-medium">Uploading resume...</span>
              </div>
              <p className="text-sm text-white/50">
                This will only take a moment. You'll be redirected
                automatically.
              </p>
            </div>

            <p className="text-xs text-white/40">
              Powered by QuantamHash Corporation
            </p>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <title>QuantamHash Corporation | Signup</title>
      <section className="min-h-screen flex items-center justify-center px-6 py-20 relative overflow-hidden">
        <div className="relative w-full max-w-md">
          <Card variant="glow" padding="lg">
            <CardHeader>
              <div className="text-center">
                <h1 className="text-2xl font-bold text-white">
                  Create your account
                </h1>
                <p className="mt-2 text-sm text-white/60">
                  Start preparing with AI-powered interviews
                </p>
              </div>
            </CardHeader>

            <CardBody>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  label="Full Name"
                  placeholder="John Doe"
                  error={errors.fullName?.message}
                  {...register("fullName", {
                    required: "Full name is required",
                    minLength: {
                      value: 2,
                      message: "Name must be at least 2 characters",
                    },
                  })}
                />

                <FormField
                  label="Email Address"
                  type="email"
                  placeholder="you@example.com"
                  error={errors.email?.message}
                  {...register("email", {
                    required: "Email is required",
                    pattern: {
                      value: /^\S+@\S+\.\S+$/,
                      message: "Invalid email address",
                    },
                  })}
                />

                <div className="space-y-1">
                  <label className="text-sm font-medium text-white/80">
                    Password
                  </label>
                  <div className="relative">
                    <FormField
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="pr-10"
                      error={errors.password?.message}
                      {...register("password", {
                        required: "Password is required",
                        minLength: {
                          value: 6,
                          message: "Password must be at least 6 characters",
                        },
                      })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/80">
                    Resume (PDF - Max 5MB)
                  </label>

                  {!resumeFile ? (
                    <label
                      htmlFor="resume-upload"
                      className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/20 rounded-lg cursor-pointer hover:border-purpleGlow transition-colors"
                    >
                      <Upload className="w-8 h-8 text-white/40 mb-2" />
                      <span className="text-sm text-white/60">
                        Click to upload resume
                      </span>
                      <span className="text-xs text-white/40 mt-1">
                        PDF only (max 5MB)
                      </span>
                      <input
                        id="resume-upload"
                        type="file"
                        accept=".pdf"
                        onChange={handleResumeChange}
                        className="hidden"
                      />
                    </label>
                  ) : (
                    <div className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-lg">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Upload className="w-4 h-4 text-purpleGlow shrink-0" />
                        <span className="text-sm text-white truncate">
                          {resumeFile.name}
                        </span>
                        <span className="text-xs text-white/40 shrink-0">
                          ({(resumeFile.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={removeResume}
                        className="ml-2 p-1 hover:bg-white/10 rounded transition-colors shrink-0"
                      >
                        <X className="w-4 h-4 text-white/60" />
                      </button>
                    </div>
                  )}

                  {resumeError && (
                    <p className="text-xs text-red-400">{resumeError}</p>
                  )}
                </div>

                <label className="flex items-start gap-2 text-sm text-white/60">
                  <input
                    type="checkbox"
                    className="mt-1 accent-purpleGlow"
                    {...register("terms", {
                      required: "You must accept the terms",
                    })}
                  />
                  <span>I agree to the Terms and Privacy Policy</span>
                </label>

                {errors.terms && (
                  <p className="text-xs text-red-400">{errors.terms.message}</p>
                )}

                {error && (
                  <p className="text-sm text-red-400 text-center">{error}</p>
                )}

                <Button
                  type="submit"
                  size="lg"
                  className="w-full flex justify-center items-center gap-2"
                  disabled={!isValid || loading || !resumeFile}
                >
                  {loading ? (
                    <>
                      <Loader /> Creating account...
                    </>
                  ) : (
                    "Create Account"
                  )}
                </Button>
              </form>
            </CardBody>

            <CardFooter>
              <p className="text-sm text-white/60">
                Already have an account?{" "}
                <Link
                  to="/login"
                  className="text-purpleSoft hover:text-purpleGlow font-medium"
                >
                  Sign in
                </Link>
              </p>
            </CardFooter>
          </Card>
        </div>
      </section>
    </>
  );
};

export default Signup;

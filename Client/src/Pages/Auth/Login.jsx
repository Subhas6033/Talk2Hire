import React, { useState } from "react";
import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
} from "../../Components/Common/Card";
import { Button, Modal } from "../../Components/index";
import { FormField } from "../../Components/Common/Input";
import { Eye, EyeOff } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useAuth } from "../../Hooks/useAuthHook";
import { usePassword } from "../../Hooks/usePassHook";

const Loader = () => (
  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
);

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMailSending, setIsMailSending] = useState(false);
  const { login, loading, error } = useAuth();
  const {
    sendForgotPasswordEmail,
    loading: forgotLoading,
    error: forgotError,
  } = usePassword();

  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm({
    mode: "onTouched",
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data) => {
    try {
      // Login and wait for success
      await login({
        email: data.email,
        password: data.password,
      }).unwrap();

      // Navigate to home after successful login
      navigate("/", { replace: true });
    } catch (err) {
      //  Error is already in Redux state, just log it
      console.error("Login failed:", err);
    }
  };

  // Forgot password form
  const {
    register: registerReset,
    handleSubmit: handleResetSubmit,
    formState: { errors: resetErrors, isValid: isResetValid },
  } = useForm({
    mode: "onTouched",
    defaultValues: {
      resetEmail: "",
    },
  });

  // Forgot password handler
  const onResetSubmit = async (data) => {
    try {
      setIsMailSending(true);
      await sendForgotPasswordEmail(data.resetEmail).unwrap();
      setIsModalOpen(false);
      navigate("/verify-password");
    } catch (error) {
      console.error("Error sending reset mail:", error);
    } finally {
      setIsMailSending(false);
    }
  };

  return (
    <>
      <title>QuantamHash Corporation | Login</title>

      <section className="min-h-screen flex items-center justify-center px-6 py-20 relative overflow-hidden bg-linear-to-br from-bgDark via-[#11162a] to-bgDark">
        {/* Background glows */}
        <div className="absolute top-[-30%] left-[-20%] h-125 w-125 rounded-full bg-purpleGlow/20 blur-[160px]" />
        <div className="absolute bottom-[-30%] right-[-20%] h-125 w-125 rounded-full bg-purpleSoft/20 blur-[160px]" />

        <div className="relative w-full max-w-md">
          <Card variant="glow" padding="lg">
            <CardHeader>
              <div className="text-center">
                <h1 className="text-2xl font-bold text-white">Welcome back</h1>
                <p className="mt-2 text-sm text-white/60">
                  Sign in to continue your AI interview preparation
                </p>
              </div>
            </CardHeader>

            <CardBody>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  label="Email Address"
                  type="email"
                  placeholder="you@example.com"
                  error={errors.email?.message}
                  {...register("email", {
                    required: "Email is required",
                    pattern: {
                      value: /^\S+@\S+\.\S+$/,
                      message: "Enter a valid email address",
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
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-purpleGlow transition"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Error from the backend will show here  */}
                {error && (
                  <p className="text-sm text-red-400 text-center">{error}</p>
                )}

                <Button
                  type="submit"
                  size="lg"
                  className="w-full flex items-center justify-center gap-2"
                  disabled={!isValid || loading}
                >
                  {loading ? (
                    <>
                      <Loader />
                      Signing in...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>
            </CardBody>

            <div className="flex justify-center my-3">
              <Button variant="ghost" onClick={() => setIsModalOpen(true)}>
                Forgot password?
              </Button>
            </div>

            <CardFooter className="flex flex-col items-center gap-3">
              <p className="text-sm text-white/60">
                Don't have an account?{" "}
                <Link
                  to="/signup"
                  className="text-purpleSoft hover:text-purpleGlow font-medium"
                >
                  Create one
                </Link>
              </p>
            </CardFooter>
            <p className="text-sm text-white/60 text-center py-2">
              Register as Company?{" "}
              <Link
                to="/register/company"
                className="text-purpleSoft hover:text-purpleGlow font-medium"
              >
                Create one
              </Link>
            </p>
          </Card>
        </div>

        {/* Forgot password modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => !isMailSending && setIsModalOpen(false)}
          title="Reset your password"
          footer={
            <div className="flex justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => setIsModalOpen(false)}
                disabled={isMailSending}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                form="reset-password-form"
                disabled={!isResetValid || isMailSending}
                className="flex items-center gap-2"
              >
                {isMailSending ? (
                  <>
                    <Loader />
                    Sending...
                  </>
                ) : (
                  "Send reset link"
                )}
              </Button>
              {forgotError && (
                <p className="text-sm text-red-400">{forgotError}</p>
              )}
            </div>
          }
        >
          <form
            id="reset-password-form"
            onSubmit={handleResetSubmit(onResetSubmit)}
            className="space-y-4"
          >
            <p className="text-sm text-white/60">
              Enter your email address and we'll send you a password reset link.
            </p>

            <FormField
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              disabled={isMailSending}
              error={resetErrors.resetEmail?.message}
              {...registerReset("resetEmail", {
                required: "Email is required",
                pattern: {
                  value: /^\S+@\S+\.\S+$/,
                  message: "Enter a valid email address",
                },
              })}
            />
          </form>
        </Modal>
      </section>
    </>
  );
};

export default Login;

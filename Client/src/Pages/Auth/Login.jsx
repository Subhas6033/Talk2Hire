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
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";

const Loader = () => (
  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
);

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMailSending, setIsMailSending] = useState(false);

  // Login Form
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

  const onSubmit = (data) => {
    console.log("Login Data", data);
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

  const onResetSubmit = async (data) => {
    try {
      setIsMailSending(true);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      console.log("Reset mail sent to:", data.resetEmail);
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error sending reset mail:", error);
    } finally {
      setIsMailSending(false);
    }
  };

  return (
    <section className="min-h-screen flex items-center justify-center px-6 py-20 relative overflow-hidden">
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
                        value: 8,
                        message: "Password must be at least 8 characters",
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

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={!isValid}
              >
                Sign In
              </Button>
            </form>
          </CardBody>

          <div className="flex justify-center my-3">
            <Button variant="ghost" onClick={() => setIsModalOpen(true)}>
              Forgot password?
            </Button>
          </div>

          <CardFooter>
            <p className="text-sm text-white/60">
              Don’t have an account?{" "}
              <Link
                to="/signup"
                className="text-purpleSoft hover:text-purpleGlow font-medium"
              >
                Create one
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>

      {/* Forgot password section */}
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
          </div>
        }
      >
        <form
          id="reset-password-form"
          onSubmit={handleResetSubmit(onResetSubmit)}
          className="space-y-4"
        >
          <p className="text-sm text-white/60">
            Enter your email address and we’ll send you a password reset link.
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
  );
};

export default Login;

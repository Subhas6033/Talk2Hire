import React, { useState } from "react";
import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
} from "../../Components/Common/Card";
import { Button } from "../../Components";
import { FormField } from "../../Components/Common/Input";
import { Eye, EyeOff } from "lucide-react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { motion } from "motion/react";
import { pageTransition } from "../../Animations/CommonAnimation";

const Signup = () => {
  const [showPassword, setShowPassword] = useState(false);

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

  const onSubmit = (data) => {
    console.log("Signup data:", data);
  };

  return (
    <motion.section className="min-h-screen flex items-center justify-center px-6 py-20 relative overflow-hidden">
      {/* Background glows */}
      <div className="absolute top-[-30%] left-[-20%] h-125 w-125 rounded-full bg-purpleGlow/20 blur-[160px]" />
      <div className="absolute bottom-[-30%] right-[-20%] h-125 w-125 rounded-full bg-purpleSoft/20 blur-[160px]" />

      <div className="relative w-full max-w-md">
        <Card variant="glow" padding="lg">
          {/* Header */}
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

          {/* Body */}
          <CardBody>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Full Name */}
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

              {/* Email */}
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

              {/* Password */}
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

              {/* Terms */}
              <label className="flex items-start gap-2 text-sm text-white/60">
                <input
                  type="checkbox"
                  className="mt-1 accent-purpleGlow"
                  {...register("terms", {
                    required: "You must accept the terms",
                  })}
                />
                <span>
                  I agree to the{" "}
                  <span className="text-purpleSoft hover:underline cursor-pointer">
                    Terms
                  </span>{" "}
                  and{" "}
                  <span className="text-purpleSoft hover:underline cursor-pointer">
                    Privacy Policy
                  </span>
                </span>
              </label>

              {errors.terms && (
                <p className="text-xs text-red-400">{errors.terms.message}</p>
              )}

              {/* Submit */}
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={!isValid}
              >
                Create Account
              </Button>
            </form>
          </CardBody>

          {/* Footer */}
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
    </motion.section>
  );
};

export default Signup;

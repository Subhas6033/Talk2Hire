import React, { useState } from "react";
import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
} from "../../Components/Common/Card";
import Button from "../../Components/Common/Button";
import { FormField } from "../../Components/Common/Input";
import { Eye, EyeOff } from "lucide-react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);

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

  const onSubmit = (data) => console.log("Login Data", data);

  return (
    <section className="min-h-screen flex items-center justify-center px-6 py-20 relative overflow-hidden">
      {/* Background glows */}
      <div className="absolute top-[-30%] left-[-20%] h-125 w-125 rounded-full bg-purpleGlow/20 blur-[160px]" />
      <div className="absolute bottom-[-30%] right-[-20%] h-125 w-125 rounded-full bg-purpleSoft/20 blur-[160px]" />

      <div className="relative w-full max-w-md">
        <Card variant="glow" padding="lg">
          {/* Header */}
          <CardHeader>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-white">Welcome back</h1>
              <p className="mt-2 text-sm text-white/60">
                Sign in to continue your AI interview preparation
              </p>
            </div>
          </CardHeader>

          {/* Body */}
          <CardBody>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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
                    message: "Enter a valid email address",
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

              {/* Forgot password */}
              <div className="flex justify-end">
                <Link
                  to="/forgot-password"
                  className="text-sm text-purpleSoft hover:text-purpleGlow transition"
                >
                  Forgot password?
                </Link>
              </div>

              {/* Submit */}
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

          {/* Footer */}
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
    </section>
  );
};

export default Login;

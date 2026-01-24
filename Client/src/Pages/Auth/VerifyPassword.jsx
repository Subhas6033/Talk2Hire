import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { FormField } from "../../Components/Common/Input";
import { usePassword } from "../../Hooks/usePassHook";
import { Modal, Button } from "../../Components/index";

const VerifyPassword = () => {
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  const { verifyOtp, updatePassword, loading, error, otpVerified, resetState } =
    usePassword();

  // OTP form
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
  } = useForm({
    mode: "onTouched",
    defaultValues: {
      email: "",
      otp: "",
    },
  });

  const emailValue = watch("email");

  // Reset password form
  const {
    register: registerReset,
    handleSubmit: handleResetSubmit,
    formState: { errors: resetErrors, isValid: isResetValid },
  } = useForm({
    mode: "onTouched",
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmitOtp = (data) => {
    verifyOtp(data.email, data.otp);
  };

  const onResetPassword = (data) => {
    try {
      updatePassword(data.email, data.newPassword, data.confirmPassword);
      console.log("Successfully reset the password");
    } catch (error) {
      console.log(error);
    }
  };

  // 🔑 Open modal when OTP is verified
  useEffect(() => {
    if (otpVerified) {
      setIsResetModalOpen(true);
    }
  }, [otpVerified]);

  // Cleanup on modal close
  const handleCloseModal = () => {
    setIsResetModalOpen(false);
    resetState();
  };

  return (
    <>
      <title>Verify OTP | QuantamHash Corporation</title>

      <section className="min-h-screen flex items-center justify-center px-6 py-20 bg-linear-to-br from-bgDark via-[#11162a] to-bgDark relative overflow-hidden">
        {/* Background glows */}
        <div className="absolute top-[-30%] left-[-20%] h-125 w-125 rounded-full bg-purpleGlow/20 blur-[160px]" />
        <div className="absolute bottom-[-30%] right-[-20%] h-125 w-125 rounded-full bg-purpleSoft/20 blur-[160px]" />

        <div className="relative w-full max-w-md">
          <div className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-8 shadow-[0_0_40px_rgba(0,0,0,0.4)]">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-white">Verify Your OTP</h1>
              <p className="mt-2 text-sm text-white/60">
                Enter the OTP sent to your email
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmitOtp)} className="space-y-5">
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

              <FormField
                label="One Time Password (OTP)"
                type="text"
                placeholder="Enter 4-digit OTP"
                error={errors.otp?.message}
                {...register("otp", {
                  required: "OTP is required",
                  pattern: {
                    value: /^\d{4}$/,
                    message: "OTP must be 4 digits",
                  },
                })}
              />

              {error && <p className="text-sm text-red-400">{error}</p>}

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={!isValid || loading}
              >
                {loading ? "Verifying..." : "Verify OTP"}
              </Button>
            </form>
          </div>
        </div>
      </section>

      {/* Reset Password Modal */}
      <Modal
        isOpen={isResetModalOpen}
        onClose={handleCloseModal}
        title="Reset Your Password"
        footer={
          <Button
            type="submit"
            form="reset-password-form"
            disabled={!isResetValid || loading}
            className="w-full"
          >
            {loading ? "Updating..." : "Update Password"}
          </Button>
        }
      >
        <form
          id="reset-password-form"
          onSubmit={handleResetSubmit(onResetPassword)}
          className="space-y-4"
        >
          <FormField
            label="Email"
            type="email"
            // value={emailValue}
            error={resetErrors.email?.message}
          />

          <FormField
            label="New Password"
            type="password"
            error={resetErrors.newPassword?.message}
            {...registerReset("newPassword", {
              required: "New password is required",
              minLength: {
                value: 6,
                message: "Password must be at least 6 characters",
              },
            })}
          />

          <FormField
            label="Confirm Password"
            type="password"
            error={resetErrors.confirmPassword?.message}
            {...registerReset("confirmPassword", {
              required: "Confirm your password",
              validate: (value, formValues) =>
                value === formValues.newPassword || "Passwords do not match",
            })}
          />
        </form>
      </Modal>
    </>
  );
};

export default VerifyPassword;

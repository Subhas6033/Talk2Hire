import React from "react";
import clsx from "clsx";

const baseStyles = [
  "w-full",
  "rounded-xl",
  "bg-white/5",
  "backdrop-blur-xl",
  "px-4 py-3",
  "text-sm text-textLight",
  "placeholder-white/40",
  "border border-white/10",
  "transition-all duration-200",
  "focus:outline-none",
  "focus:border-purpleGlow",
  "focus:ring-2 focus:ring-purpleGlow/40",
  "disabled:opacity-50",
  "disabled:cursor-not-allowed",
].join(" ");

const errorStyles = [
  "border-red-400/50",
  "focus:border-red-400",
  "focus:ring-red-400/40",
].join(" ");

// Input component
export const Input = React.forwardRef(
  ({ className, error = false, type = "text", ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={clsx(baseStyles, error && errorStyles, className)}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

// FormField component
export const FormField = ({ id, label, error, helperText, ...props }) => {
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-white/80">
          {label}
        </label>
      )}

      <Input id={id} error={!!error} {...props} />

      {/* Keep space reserved even if no helper text */}
      <p
        className={clsx(
          "text-xs",
          error ? "text-red-400" : "text-white/50",
          !(helperText || error) && "invisible"
        )}
      >
        {error || helperText || " "}
      </p>
    </div>
  );
};

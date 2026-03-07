import React from "react";
import clsx from "clsx";

const baseStyles = [
  "w-full",
  "rounded-xl",
  "bg-[#FAFAF9]",
  "px-4 py-3",
  "text-sm text-[#1C1917]",
  "placeholder-stone-400",
  "border border-[#E8E4DE]",
  "transition-all duration-200",
  "focus:outline-none",
  "focus:bg-white",
  "focus:border-indigo-400",
  "focus:ring-2 focus:ring-indigo-200/60",
  "disabled:opacity-50",
  "disabled:cursor-not-allowed",
].join(" ");

const errorStyles = [
  "border-red-300",
  "bg-red-50",
  "focus:border-red-400",
  "focus:ring-red-200/60",
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
  },
);

Input.displayName = "Input";

// FormField component
export const FormField = ({ id, label, error, helperText, ...props }) => {
  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-semibold text-stone-600 tracking-wide font-sora"
        >
          {label}
        </label>
      )}

      <Input id={id} error={!!error} {...props} />

      {/* Keep space reserved even if no helper/error text */}
      <p
        className={clsx(
          "text-xs font-sora",
          error ? "text-red-500" : "text-stone-400",
          !(helperText || error) && "invisible",
        )}
      >
        {error || helperText || " "}
      </p>
    </div>
  );
};

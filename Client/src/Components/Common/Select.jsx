import React from "react";

const Select = ({
  label,
  name,
  value,
  onChange,
  options = [],
  placeholder = "Select an option",
  disabled = false,
  error = "",
  className = "",
}) => {
  return (
    <div className={`w-full space-y-2 ${className}`}>
      {label && (
        <label
          htmlFor={name}
          className="block text-sm font-medium text-textMuted"
        >
          {label}
        </label>
      )}

      <div className="relative">
        <select
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={`
            w-full appearance-none
            rounded-xl
            px-4 py-3 pr-10
            text-sm
            bg-linear-to-br from-white/10 to-white/5
            text-textLight
            placeholder:text-textMuted
            border border-white/10
            focus:outline-none
            focus:ring-2 focus:ring-white/20
            focus:border-white/20
            transition
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? "border-red-500/60" : ""}
          `}
        >
          <option value="" disabled className="bg-bgDark">
            {placeholder}
          </option>

          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              className="bg-bgDark"
            >
              {option.label}
            </option>
          ))}
        </select>

        {/* Chevron Icon */}
        <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center">
          <svg
            className="h-4 w-4 text-textMuted"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>

      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
};

export default Select;

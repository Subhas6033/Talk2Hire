import React from "react";
import { motion } from "motion/react";
import clsx from "clsx";

const baseStyles = `
  inline-flex items-center justify-center
  rounded-xl font-semibold
  transition-all duration-200
  focus:outline-none focus-visible:ring-2 focus-visible:ring-purpleGlow
  disabled:opacity-50 disabled:pointer-events-none hover:cursor-pointer
`;

const variants = {
  primary: `
    bg-linear-to-r from-purpleGlow via-purpleSoft to-purpleGlow
    text-white
    shadow-[0_0_25px_rgba(155,92,255,0.45)]
    hover:shadow-[0_0_40px_rgba(155,92,255,0.75)]
    hover:scale-[1.03]
    active:scale-[0.97]
  `,
  secondary: `
    bg-white/5 text-textLight
    border border-white/15
    backdrop-blur-xl
    hover:bg-white/10
  `,
  ghost: `
    bg-transparent text-purpleSoft
    hover:text-purpleGlow
  `,
};

const sizes = {
  sm: "px-4 py-2 text-sm",
  md: "px-6 py-3 text-sm",
  lg: "px-8 py-4 text-base",
};

const Button = ({
  children,
  variant = "primary",
  size = "md",
  as = "button",
  className,
  ...props
}) => {
  const Component = motion[as] || motion.button;

  return (
    <Component
      whileTap={{ scale: 0.96 }}
      className={clsx(baseStyles, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </Component>
  );
};

export default Button;

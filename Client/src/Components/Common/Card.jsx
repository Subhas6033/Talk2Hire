import React from "react";
import { motion } from "motion/react";
import clsx from "clsx";

const baseStyles = `
  relative
  rounded-2xl
  backdrop-blur-xl
  transition-all duration-300
`;

const variants = {
  default: `
    bg-white/5
    border border-white/10
    shadow-[0_0_40px_rgba(155,92,255,0.15)]
  `,
  solid: `
    bg-[#12091F]
    border border-purpleMain/40
  `,
  glow: `
    bg-white/5
    border border-purpleGlow/40
    shadow-[0_0_60px_rgba(155,92,255,0.35)]
  `,
};

const paddings = {
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export const Card = ({
  children,
  variant = "default",
  padding = "md",
  className,
  hoverable = false,
  ...props
}) => {
  return (
    <motion.div
      whileHover={hoverable ? { y: -4 } : undefined}
      className={clsx(
        baseStyles,
        variants[variant],
        paddings[padding],
        hoverable && "hover:shadow-[0_0_60px_rgba(155,92,255,0.3)]",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export const CardHeader = ({ children }) => (
  <div className="mb-4 text-lg font-semibold text-purpleSoft">{children}</div>
);

export const CardBody = ({ children }) => (
  <div className="text-sm text-white/75">{children}</div>
);

export const CardFooter = ({ children }) => (
  <div className="mt-6 flex items-center justify-end gap-3">{children}</div>
);

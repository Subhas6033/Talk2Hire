import React from "react";
import { motion } from "motion/react";
import clsx from "clsx";

const baseStyles = `
  relative
  rounded-2xl
  transition-all duration-300
`;

const variants = {
  default: `
    bg-white
    border border-[#E8E4DE]
    shadow-[0_1px_3px_rgba(0,0,0,0.05),0_4px_16px_rgba(0,0,0,0.04)]
  `,
  solid: `
    bg-[#F7F5F2]
    border border-[#E8E4DE]
    shadow-[0_1px_3px_rgba(0,0,0,0.04)]
  `,
  glow: `
    bg-white
    border border-indigo-100
    shadow-[0_0_0_1px_rgba(99,102,241,0.08),0_4px_24px_rgba(99,102,241,0.10)]
  `,
  scrollable: `
    bg-white
    border border-[#E8E4DE]
    shadow-[0_1px_3px_rgba(0,0,0,0.05),0_4px_16px_rgba(0,0,0,0.04)]
    max-h-[80vh]
    overflow-y-auto
  `,
};

const paddings = {
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
  none: "p-0",
};

const scrollbarStyles = `
  [class*="scrollbar-hide"]::-webkit-scrollbar {
    display: none;
  }
  [class*="scrollbar-hide"] {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
`;

export const Card = ({
  children,
  variant = "default",
  padding = "md",
  className,
  hoverable = false,
  scrollable = false,
  maxHeight,
  hideScrollbar = false,
  ...props
}) => {
  const cardVariant = scrollable ? "scrollable" : variant;
  const customStyles = maxHeight ? { maxHeight } : {};

  return (
    <>
      {hideScrollbar && <style>{scrollbarStyles}</style>}
      <motion.div
        whileHover={
          hoverable
            ? {
                y: -3,
                boxShadow:
                  "0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
              }
            : undefined
        }
        className={clsx(
          baseStyles,
          variants[cardVariant],
          paddings[padding],
          hoverable && "cursor-pointer",
          scrollable &&
            !hideScrollbar &&
            "scrollbar-thin scrollbar-thumb-stone-300 scrollbar-track-transparent",
          scrollable && hideScrollbar && "scrollbar-hide overflow-y-auto",
          className,
        )}
        style={customStyles}
        {...props}
      >
        {children}
      </motion.div>
    </>
  );
};

export const CardHeader = ({ children, headerClass }) => (
  <div
    className={clsx(
      "mb-4 text-base font-semibold text-[#1C1917] font-sora leading-snug",
      headerClass,
    )}
  >
    {children}
  </div>
);

export const CardBody = ({
  children,
  scrollable = false,
  maxHeight,
  hideScrollbar = false,
}) => {
  const customStyles = maxHeight ? { maxHeight } : {};

  if (scrollable) {
    return (
      <>
        {hideScrollbar && <style>{scrollbarStyles}</style>}
        <div
          className={clsx(
            "text-sm text-stone-500 overflow-y-auto pr-2",
            hideScrollbar
              ? "scrollbar-hide"
              : "scrollbar-thin scrollbar-thumb-stone-300 scrollbar-track-transparent",
          )}
          style={customStyles}
        >
          {children}
        </div>
      </>
    );
  }

  return (
    <div className="text-sm text-stone-500 leading-relaxed">{children}</div>
  );
};

export const CardFooter = ({ children, sticky = false }) => (
  <div
    className={clsx(
      "mt-6 flex items-center justify-center gap-3",
      sticky &&
        "sticky bottom-0 bg-white/95 backdrop-blur-sm pt-4 -mx-6 px-6 -mb-6 pb-6 border-t border-[#E8E4DE]",
    )}
  >
    {children}
  </div>
);

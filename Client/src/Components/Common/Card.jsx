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
  scrollable: `
    bg-white/5
    border border-white/10
    shadow-[0_0_40px_rgba(155,92,255,0.15)]
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

//  FIXED: Hidden scrollbar styles
const scrollbarStyles = `
  /* Hide scrollbar for Chrome, Safari and Opera */
  [class*="scrollbar-hide"]::-webkit-scrollbar {
    display: none;
  }

  /* Hide scrollbar for IE, Edge and Firefox */
  [class*="scrollbar-hide"] {
    -ms-overflow-style: none;  /* IE and Edge */
    scrollbar-width: none;  /* Firefox */
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
  hideScrollbar = false, //  NEW: Option to hide scrollbar
  ...props
}) => {
  const cardVariant = scrollable ? "scrollable" : variant;

  const customStyles = maxHeight ? { maxHeight } : {};

  return (
    <>
      {/*  Inject scrollbar styles */}
      {hideScrollbar && <style>{scrollbarStyles}</style>}

      <motion.div
        whileHover={hoverable ? { y: -4 } : undefined}
        className={clsx(
          baseStyles,
          variants[cardVariant],
          paddings[padding],
          hoverable && "hover:shadow-[0_0_60px_rgba(155,92,255,0.3)]",
          scrollable &&
            !hideScrollbar &&
            "scrollbar-thin scrollbar-thumb-purpleMain/50 scrollbar-track-transparent",
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
  <div className={`mb-4 text-lg font-semibold text-purpleSoft ${headerClass}`}>
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
            "text-sm text-white/75 overflow-y-auto pr-2",
            hideScrollbar
              ? "scrollbar-hide"
              : "scrollbar-thin scrollbar-thumb-purpleMain/50 scrollbar-track-transparent",
          )}
          style={customStyles}
        >
          {children}
        </div>
      </>
    );
  }

  return <div className="text-sm text-white/75">{children}</div>;
};

export const CardFooter = ({ children, sticky = false }) => (
  <div
    className={clsx(
      "mt-6 flex items-center justify-center gap-3",
      sticky &&
        "sticky bottom-0 bg-[#12091F]/95 backdrop-blur-sm pt-4 -mx-6 px-6 -mb-6 pb-6 border-t border-white/10",
    )}
  >
    {children}
  </div>
);

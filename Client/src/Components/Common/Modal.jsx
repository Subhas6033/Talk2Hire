import React, { useEffect } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Card } from "./Card";

const sizeClasses = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
  full: "max-w-7xl",
};

const Modal = ({ isOpen, onClose, title, children, footer, size = "md" }) => {
  // Close on Escape key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  // Freeze background scroll while open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          aria-modal="true"
          role="dialog"
        >
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-stone-900/30 backdrop-blur-[2px]"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          />

          {/* Modal panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
            className={`relative z-50 w-full mx-4 ${sizeClasses[size]} max-h-[90vh] overflow-y-auto md:overflow-visible`}
          >
            <Card padding="md" variant="glow">
              {/* Header */}
              {(title || onClose) && (
                <div className="flex items-center justify-between mb-5 pb-3.5 border-b border-[#F0EDE8]">
                  {title && (
                    <h2 className="font-sora text-base font-semibold text-[#1C1917] leading-snug">
                      {title}
                    </h2>
                  )}
                  {onClose && (
                    <button
                      onClick={onClose}
                      className="
                        w-7 h-7 rounded-lg flex items-center justify-center
                        text-stone-400 hover:text-stone-700
                        bg-transparent hover:bg-[#F7F5F2]
                        border border-transparent hover:border-[#E8E4DE]
                        transition-all duration-150
                        focus:outline-none focus:ring-2 focus:ring-indigo-300/50
                      "
                    >
                      <X size={15} strokeWidth={2} />
                    </button>
                  )}
                </div>
              )}

              {/* Body */}
              <div className="text-sm text-stone-500 leading-relaxed">
                {children}
              </div>

              {/* Footer */}
              {footer && (
                <div className="mt-5 pt-4 border-t border-[#F0EDE8]">
                  {footer}
                </div>
              )}
            </Card>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default Modal;

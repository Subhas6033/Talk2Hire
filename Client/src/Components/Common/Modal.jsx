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
  // On pressing the Esc. Key close the Modal
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  // Freeze the Background while Modal is open
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
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className={`relative z-50 w-full mx-4 ${sizeClasses[size]} max-h-[90vh] overflow-y-auto md:overflow-visible`}
          >
            <Card padding="md" variant="glow">
              {(title || onClose) && (
                <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
                  {title && (
                    <h2 className="text-lg font-semibold text-white/80">
                      {title}
                    </h2>
                  )}
                  {onClose && (
                    <button
                      onClick={onClose}
                      className="text-white/50 hover:text-white transition rounded-full p-1 focus:outline-none focus:ring-2 focus:ring-purpleGlow/50"
                    >
                      <X size={20} />
                    </button>
                  )}
                </div>
              )}

              <div className="text-textLight">{children}</div>

              {footer && (
                <div className="mt-6 border-t border-white/10 pt-4">
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

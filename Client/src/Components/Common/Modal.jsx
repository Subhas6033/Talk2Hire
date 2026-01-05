import React, { useEffect } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Card } from "./Card";

const Modal = ({ isOpen, onClose, title, children, footer }) => {
  // Close the Card when Esc. pressed
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          aria-modal="true"
          role="dialog"
        >
          {/* Backdrop with fade out */}
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          ></motion.div>

          {/* Modal Container*/}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="relative z-50 w-full max-w-lg mx-4"
          >
            <Card padding="md" variant="glow">
              {/* Header */}
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

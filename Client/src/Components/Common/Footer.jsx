import React from "react";
import { Link } from "react-router-dom";

const Footer = () => (
  <footer
    className="
      relative
      bg-linear-to-r from-bgDark via-purpleMain to-purpleSecondary
      text-textLight
      border-t border-white/10
    "
  >
    {/* Soft glow overlay */}
    <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_bottom,rgba(155,92,255,0.15),transparent_60%)]" />

    <div className="relative mx-auto max-w-7xl px-6 py-8">
      <div className="flex flex-col md:flex-row md:justify-between items-center gap-6">
        <div className="text-sm text-center md:text-left">
          <div
            className="
              text-lg font-bold
              bg-linear-to-r from-purpleGlow to-purpleSoft
              bg-clip-text text-transparent
            "
          >
            AI Interview System
          </div>
          <p className="mt-1 text-xs text-white/70">
            Secure AI-powered voice interview platform
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-6 text-sm text-white/80">
          <Link
            to="/privacy"
            className="hover:text-purpleGlow transition-colors"
          >
            Privacy Policy
          </Link>
          <Link to="/terms" className="hover:text-purpleGlow transition-colors">
            Terms of Service
          </Link>
          <Link
            to="/support"
            className="hover:text-purpleGlow transition-colors"
          >
            Support
          </Link>
        </div>
      </div>

      {/* Bottom */}
      <div className="mt-6 border-t border-white/10 pt-4 text-center text-xs text-white/60">
        &copy; {new Date().getFullYear()} AI Interview System. All rights
        reserved.
      </div>
    </div>
  </footer>
);

export default Footer;

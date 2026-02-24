import React from "react";
import { Link } from "react-router-dom";

const Footer = () => (
  <footer
    className="
      relative
      bg-linear-to-br from-bgDark/95 via-[#11162a]/95 to-bgDark/95
      backdrop-blur-xl
      border-t border-white/10
      text-white
    "
  >
    {/* Subtle purple glow */}
    <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_bottom,rgba(155,92,255,0.12),transparent_65%)]" />

    <div className="relative mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-col md:flex-row md:justify-between items-center gap-6">
        {/* Brand */}
        <div className="text-sm text-center md:text-left">
          <div
            className="
              text-lg font-semibold 
              bg-white
              bg-clip-text text-transparent
            "
          >
            Talk2Hire
          </div>
          <p className="mt-1 text-xs text-white/70">
            Secure AI-powered voice interview platform
          </p>
        </div>

        {/* Links */}
        <div className="flex flex-wrap justify-center gap-6 text-sm text-white/70">
          <Link to="/about" className="hover:text-purpleGlow transition-colors">
            About Us
          </Link>
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
            to="/contact"
            className="hover:text-purpleGlow transition-colors"
          >
            Support
          </Link>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="mt-8 border-t border-white/10 pt-4 text-center text-xs text-white/60">
        &copy; {new Date().getFullYear()} Talk2Hire. All rights reserved.
      </div>
    </div>
  </footer>
);

export default Footer;

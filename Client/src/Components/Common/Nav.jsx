import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Avatar } from "../index";
import { useAuth } from "../../Hooks/useAuthHook";

const Nav = () => {
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();

  const handleLogout = () => {
    logout({});
    navigate("/login");
  };

  return (
    <header
      className="
        sticky top-0 z-50
        bg-linear-to-br from-bgDark/90 via-[#11162a]/90 to-bgDark/90
        backdrop-blur-xl
        border-b border-white/10
      "
    >
      <nav className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link
          to="/"
          className="
            text-xl font-bold
            bg-linear-to-r from-purpleGlow to-purpleSoft
            bg-clip-text text-white
            tracking-tight
          "
        >
          AI Interview System
        </Link>

        {/* Links */}
        <div className="hidden md:flex gap-8 text-sm font-medium text-white/70">
          {isAuthenticated && (
            <>
              <Link
                to="/dashboard"
                className="hover:text-purpleGlow transition-colors"
              >
                Dashboard
              </Link>
              <Link
                to="/interview"
                className="hover:text-purpleGlow transition-colors"
              >
                Interview
              </Link>
              <Link
                to="/jobs"
                className="hover:text-purpleGlow transition-colors"
              >
                Jobs
              </Link>
            </>
          )}
        </div>

        {/* Auth Buttons */}
        <div className="flex items-center gap-4">
          {!isAuthenticated ? (
            <>
              <Link
                to="/login"
                className="text-sm text-white/70 hover:text-purpleGlow transition"
              >
                Login
              </Link>

              <Link
                to="/signup"
                className="
                  rounded-xl
                  bg-purpleGlow
                  px-4 py-2
                  text-sm font-semibold text-white
                  shadow-[0_0_20px_rgba(155,92,255,0.45)]
                  hover:scale-105 hover:shadow-[0_0_30px_rgba(155,92,255,0.7)]
                  transition
                "
              >
                Get Started
              </Link>
            </>
          ) : (
            <Avatar />
          )}
        </div>
      </nav>
    </header>
  );
};

export default Nav;

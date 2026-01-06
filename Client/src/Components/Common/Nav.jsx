import React from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "./Button";

const Nav = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <header
      className="
        sticky top-0 z-50
        bg-linear-to-r from-purpleSecondary via-purpleMain to-bgDark
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
            bg-clip-text text-transparent
            tracking-tight
          "
        >
          AI Interview System
        </Link>

        {/* Links */}
        <div className="hidden md:flex gap-8 text-sm font-medium text-textLight">
          {token && (
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
                to="/results"
                className="hover:text-purpleGlow transition-colors"
              >
                Results
              </Link>
            </>
          )}
        </div>

        {/* Auth Buttons */}
        <div className="flex items-center gap-4">
          {!token ? (
            <>
              <Link
                to="/login"
                className="text-sm text-textLight hover:text-purpleGlow transition"
              >
                Login
              </Link>

              <Link
                to="/signup"
                className="
                  rounded-lg
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
            <Button onClick={handleLogout} variants="secondary">
              Logout
            </Button>
          )}
        </div>
      </nav>
    </header>
  );
};

export default Nav;

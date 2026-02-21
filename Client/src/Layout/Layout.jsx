import React from "react";
import { Nav, Footer } from "../Components";
import { motion } from "motion/react";
import { useLocation } from "react-router-dom";

const FULLSCREEN_ROUTES = ["/interview", "/interview/live"];

const Layout = ({ children }) => {
  const { pathname } = useLocation();
  const isFullscreen = FULLSCREEN_ROUTES.includes(pathname);

  return (
    <div className="min-h-screen bg-linear-to-br from-bgDark via-sidebar-bg to-bgDark text-textLight flex flex-col">
      {!isFullscreen && <Nav />}

      <motion.main
        className="flex-1 w-full"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        {children}
      </motion.main>

      {!isFullscreen && <Footer />}
    </div>
  );
};

export default Layout;

import React from "react";
import { Nav, Footer, CompanyNavbar } from "../Components/index.js";
import { motion } from "motion/react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../Hooks/useAuthHook.js";
import { useCompany } from "../Hooks/useCompanyAuthHook.js";

const FULLSCREEN_ROUTES = ["/interview", "/interview/live"];

const ROLE_NAV = {
  company: CompanyNavbar,
  user: Nav,
  guest: Nav,
};

const Layout = ({ children }) => {
  const { pathname } = useLocation();
  const {
    isAuthenticated: isUserAuth,
    hydrated: userHydrated,
    role: userRole,
  } = useAuth();
  const { isAuthenticated: isCompanyAuth, hydrated: companyHydrated } =
    useCompany();

  const isFullscreen = FULLSCREEN_ROUTES.includes(pathname);

  const hydrated = userHydrated && companyHydrated;

  const role = isCompanyAuth ? "company" : userRole;
  const RoleNav = ROLE_NAV[role] ?? Nav;

  const bgClass =
    role === "company"
      ? "min-h-screen bg-gray-50 text-gray-900 flex flex-col"
      : "min-h-screen bg-linear-to-br from-bgDark via-sidebar-bg to-bgDark text-textLight flex flex-col";

  return (
    <div className={bgClass}>
      {/* Only render the navbar once we know who the user is */}
      {!isFullscreen && hydrated && <RoleNav />}

      <motion.main
        className="flex-1 w-full"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        {children}
      </motion.main>

      {!isFullscreen && role !== "company" && <Footer />}
    </div>
  );
};

export default Layout;

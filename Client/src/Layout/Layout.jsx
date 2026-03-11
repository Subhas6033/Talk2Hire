import React from "react";
import { Nav, Footer, CompanyNavbar, AdminNav } from "../Components/index.js";
import { motion } from "motion/react";
import { useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { useAuth } from "../Hooks/useAuthHook.js";
import { useCompany } from "../Hooks/useCompanyAuthHook.js";
import { useMicrosoftAuth } from "../Hooks/useMicrosoftCompanyAuthHook.js";
import { useMicrosoftUserAuth } from "../Hooks/useMicrosoftAuth.js";

const FULLSCREEN_ROUTES = ["/interview", "/interview/live", "/admin/login"];

const ROLE_NAV = {
  admin: AdminNav,
  company: CompanyNavbar,
  user: Nav,
  guest: Nav,
};

const Layout = ({ children, isNotFound = false }) => {
  const { pathname } = useLocation();

  const adminAccessToken = useSelector((state) => state.adminAuth.accessToken);

  const adminActiveSection = pathname.split("/")[2] || "dashboard";
  const [adminActive, setAdminActive] = React.useState(adminActiveSection);

  React.useEffect(() => {
    setAdminActive(pathname.split("/")[2] || "dashboard");
  }, [pathname]);

  const {
    isAuthenticated: isUserAuth,
    hydrated: userHydrated,
    role: userRole,
  } = useAuth();
  const { isAuthenticated: isCompanyAuth, hydrated: companyHydrated } =
    useCompany();
  const { isAuthenticated: isMsCompanyAuth, hydrated: msCompanyHydrated } =
    useMicrosoftAuth();
  const { isAuthenticated: isMsUserAuth, hydrated: msUserHydrated } =
    useMicrosoftUserAuth();

  const isFullscreen =
    FULLSCREEN_ROUTES.includes(pathname) ||
    (isNotFound && !pathname.startsWith("/admin"));
  const hydrated =
    userHydrated && companyHydrated && msCompanyHydrated && msUserHydrated;

  const role = adminAccessToken
    ? "admin"
    : isCompanyAuth || isMsCompanyAuth
      ? "company"
      : isUserAuth || isMsUserAuth
        ? userRole
        : "guest";

  const RoleNav = ROLE_NAV[role] ?? Nav;
  const showFooter = !isFullscreen && role !== "company" && role !== "admin";

  return (
    <div
      className="min-h-screen bg-white text-gray-900 flex flex-col"
      style={{ isolation: "isolate" }}
    >
      {!isFullscreen && hydrated && (
        <RoleNav active={adminActive} setActive={setAdminActive} />
      )}

      <motion.main
        className="flex-1 w-full"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        {children}
      </motion.main>

      {showFooter && <Footer />}
    </div>
  );
};

export default Layout;

import React, { useEffect, useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Layout from "./Layout/Layout";
import Loader from "./Components/Loader/Loader";
import { AnimatePresence, motion } from "motion/react";
import { pageTransition } from "./Animations/CommonAnimation";
import { ScrollToTop, OnboardingFlow } from "./Components/index";
import { useSelector } from "react-redux";
import { RoleBasedRoute, PublicRoute } from "./Security/ProtectedRoutes.jsx";
import {
  Home,
  About,
  Login,
  NotFound,
  Privacy,
  Terms,
  Contact,
  InterviewDashboard,
  Profile,
  VerifyPassword,
  MobileCameraPage,
  RegistrationForm,
  InterviewLive,
  CompanyRegister,
  Companylogin,
  CompanyDashboard,
  CompanyJob,
  CompanyInterviews,
  UserJob,
  UserJobDetail,
  CompanyProfile,
  AppliedJobs,
  SavedJobs,
  CompanyPage,
  CompanyDetail,
} from "./Pages/index.pages.js";
import { InterviewSetup } from "./Components/index.js";
import { useStreams } from "./Hooks/streamContext";

const App = () => {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const location = useLocation();
  const streamsRef = useStreams();

  const hydrated = useSelector(
    (state) => state.auth.hydrated && state.company.hydrated,
  );

  useEffect(() => {
    const shouldShowOnboarding = sessionStorage.getItem("showOnboarding");
    if (shouldShowOnboarding === "true" && location.pathname === "/") {
      setShowOnboarding(true);
    } else {
      setShowOnboarding(false);
    }
  }, [location.pathname]);

  const handleOnboardingComplete = () => {
    sessionStorage.removeItem("showOnboarding");
    sessionStorage.removeItem("registrationSessionId");
    setShowOnboarding(false);
  };

  if (!hydrated) {
    return <Loader label="Setting up your session" />;
  }

  return (
    <Layout>
      {showOnboarding ? (
        <OnboardingFlow
          isOpen={showOnboarding}
          onComplete={handleOnboardingComplete}
        />
      ) : (
        <>
          <ScrollToTop />
          <AnimatePresence mode="wait" initial={true}>
            <motion.main
              key={location.pathname}
              {...pageTransition}
              className="flex-1"
            >
              <Routes>
                {/* PUBLIC ROUTES */}
                <Route path="/" element={<Home />} />
                <Route path="/about" element={<About />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/verify-password" element={<VerifyPassword />} />
                <Route path="/companies" element={<CompanyPage />} />
                <Route path="/companies/:id" element={<CompanyDetail />} />

                <Route
                  path="/login"
                  element={
                    <PublicRoute>
                      <Login />
                    </PublicRoute>
                  }
                />
                <Route
                  path="/signup"
                  element={
                    <PublicRoute>
                      <RegistrationForm />
                    </PublicRoute>
                  }
                />
                <Route
                  path="/signup/company"
                  element={
                    <PublicRoute>
                      <CompanyRegister />
                    </PublicRoute>
                  }
                />
                <Route
                  path="/login/company"
                  element={
                    <PublicRoute>
                      <Companylogin />
                    </PublicRoute>
                  }
                />

                {/* USER ONLY ROUTES */}
                <Route
                  path="/dashboard"
                  element={
                    <RoleBasedRoute allowedRole="user">
                      <InterviewDashboard />
                    </RoleBasedRoute>
                  }
                />
                <Route
                  path="/profile/:id"
                  element={
                    <RoleBasedRoute allowedRole="user">
                      <Profile />
                    </RoleBasedRoute>
                  }
                />
                <Route
                  path="/interview"
                  element={
                    <RoleBasedRoute allowedRole="user">
                      <InterviewSetup />
                    </RoleBasedRoute>
                  }
                />
                <Route
                  path="/interview/live"
                  element={
                    <RoleBasedRoute allowedRole="user">
                      <InterviewLive />
                    </RoleBasedRoute>
                  }
                />
                <Route
                  path="/jobs"
                  element={
                    <RoleBasedRoute allowedRole="user">
                      <UserJob />
                    </RoleBasedRoute>
                  }
                />
                <Route
                  path="/jobs/:id"
                  element={
                    <RoleBasedRoute allowedRole="user">
                      <UserJobDetail />
                    </RoleBasedRoute>
                  }
                />
                <Route
                  path="/applications"
                  element={
                    <RoleBasedRoute allowedRole="user">
                      <AppliedJobs />
                    </RoleBasedRoute>
                  }
                />
                <Route
                  path="/saved"
                  element={
                    <RoleBasedRoute allowedRole="user">
                      <SavedJobs />
                    </RoleBasedRoute>
                  }
                />
                {/* COMPANY ONLY ROUTES */}
                <Route
                  path="/company/dashboard"
                  element={
                    <RoleBasedRoute allowedRole="company">
                      <CompanyDashboard />
                    </RoleBasedRoute>
                  }
                />
                <Route
                  path="/company/interviews"
                  element={
                    <RoleBasedRoute allowedRole="company">
                      <CompanyInterviews />
                    </RoleBasedRoute>
                  }
                />
                <Route
                  path="/company/jobs"
                  element={
                    <RoleBasedRoute allowedRole="company">
                      <CompanyJob />
                    </RoleBasedRoute>
                  }
                />
                <Route
                  path="/company/profile"
                  element={
                    <RoleBasedRoute allowedRole="company">
                      <CompanyProfile />
                    </RoleBasedRoute>
                  }
                />

                <Route path="/mobile-camera" element={<MobileCameraPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </motion.main>
          </AnimatePresence>
        </>
      )}
    </Layout>
  );
};

export default App;

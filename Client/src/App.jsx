import React, { useEffect, useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Layout from "./Layout/Layout";
import Loader from "./Components/Loader/Loader";
import { AnimatePresence, motion } from "motion/react";
import { pageTransition } from "./Animations/CommonAnimation";
import { ScrollToTop, OnboardingFlow } from "./Components/index";
import { useSelector } from "react-redux";
import { ProtectedRoute, PublicRoute } from "./Security/ProtectedRoutes.jsx";
import {
  Home,
  About,
  Interview,
  Login,
  NotFound,
  Privacy,
  Terms,
  Contact,
  InterviewDashboard,
  Profile,
  VerifyPassword,
  Hire,
  MobileCameraPage,
  RegistrationForm,
} from "./Pages/index.pages.js";

import { Guidlines, MobileSecurityCamera } from "./Components/index.js";
import InterviewSetup from "./Components/new/InterviewSetup.jsx";
import InterviewLive from "./Components/new/Interviewlive.jsx";
import { useStreams } from "./Hooks/streamContext";

const App = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const location = useLocation();
  const streamsRef = useStreams();

  // Read from Redux store
  const { hydrated } = useSelector((state) => state.auth);

  useEffect(() => {
    if (hydrated) {
      setIsLoading(false);
    }
  }, [hydrated]);

  useEffect(() => {
    console.log("🔍 App mounted - StreamContext available:", {
      hasContext: !!streamsRef,
      hasCurrentValue: !!streamsRef?.current,
    });
  }, []);

  // Check for onboarding flag whenever route changes
  useEffect(() => {
    const shouldShowOnboarding = sessionStorage.getItem("showOnboarding");

    if (shouldShowOnboarding === "true" && location.pathname === "/") {
      setShowOnboarding(true);
    } else {
      console.log("⏸️ Not showing onboarding");
      setShowOnboarding(false);
    }
  }, [location.pathname]);

  // Handle onboarding completion
  const handleOnboardingComplete = () => {
    sessionStorage.removeItem("showOnboarding");
    sessionStorage.removeItem("registrationSessionId");
    setShowOnboarding(false);
  };

  return (
    <Layout>
      {isLoading ? (
        <Loader label="Setting up your interview" />
      ) : (
        <>
          {/*  IMPROVED: Show onboarding as full-page overlay when active */}
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
                    <Route path="/guidlines" element={<Guidlines />} />
                    <Route path="/hire" element={<Hire />} />
                    <Route
                      path="/mobile-security"
                      element={<MobileSecurityCamera />}
                    />
                    <Route
                      path="/verify-password"
                      element={<VerifyPassword />}
                    />

                    {/* Redirect to home if already logged in */}
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

                    {/* PROTECTED ROUTES */}
                    <Route
                      path="/interview"
                      element={
                        <ProtectedRoute>
                          <InterviewSetup />
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/interview/live"
                      element={
                        <ProtectedRoute>
                          <InterviewLive />
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/mobile-camera"
                      element={<MobileCameraPage />}
                    />
                    <Route
                      path="/dashboard"
                      element={
                        <ProtectedRoute>
                          <InterviewDashboard />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/profile/:id"
                      element={
                        <ProtectedRoute>
                          <Profile />
                        </ProtectedRoute>
                      }
                    />

                    {/* NOT FOUND */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </motion.main>
              </AnimatePresence>
            </>
          )}
        </>
      )}
    </Layout>
  );
};

export default App;

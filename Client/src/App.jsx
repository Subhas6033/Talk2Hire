import React, { useEffect, useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Layout from "./Layout/Layout";
import Loader from "./Components/Loader/Loader";
import { AnimatePresence, motion } from "motion/react";
import { pageTransition } from "./Animations/CommonAnimation";
import { ScrollToTop } from "./Components/index";
import { useSelector } from "react-redux";
import { ProtectedRoute, PublicRoute } from "./Security/ProtectedRoutes.jsx";
import {
  Home,
  About,
  Interview,
  Login,
  Signup,
  NotFound,
  Privacy,
  Terms,
  Contact,
  InterviewDashboard,
  Profile,
  VerifyPassword,
  Hire,
} from "./Pages/index.pages.js";

import { Guidlines, MobileSecurityCamera } from "./Components/index.js";

const App = () => {
  const [isLoading, setIsLoading] = useState(true);
  const location = useLocation();

  // Read from Redux store
  const { hydrated } = useSelector((state) => state.auth);

  useEffect(() => {
    if (hydrated) {
      setIsLoading(false);
    }
  }, [hydrated]);

  return (
    <Layout>
      {isLoading ? (
        <Loader label="Setting up your interview" />
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
                <Route path="/verify-password" element={<VerifyPassword />} />

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
                      <Signup />
                    </PublicRoute>
                  }
                />

                {/* PROTECTED ROUTES */}
                <Route
                  path="/interview"
                  element={
                    <ProtectedRoute>
                      <Interview />
                    </ProtectedRoute>
                  }
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
    </Layout>
  );
};

export default App;

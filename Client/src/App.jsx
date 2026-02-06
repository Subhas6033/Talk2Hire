import React, { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Layout from "./Layout/Layout";
import Loader from "./Components/Loader/Loader";
import { AnimatePresence, motion } from "motion/react";
import { pageTransition } from "./Animations/CommonAnimation";
import { ScrollToTop } from "./Components/index";
import { useSelector } from "react-redux";

const App = () => {
  const [isLoading, setIsLoading] = useState(true);
  const location = useLocation();

  // ✅ Just read from Redux store - NO API call
  const { hydrated } = useSelector((state) => state.auth);

  useEffect(() => {
    // ✅ REMOVED: dispatch(getCurrentUser());
    // Auth is already loaded from localStorage via AuthProvider

    // Wait for auth hydration and artificial delay
    if (hydrated) {
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 2000);

      return () => clearTimeout(timer);
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
              <Outlet />
            </motion.main>
          </AnimatePresence>
        </>
      )}
    </Layout>
  );
};

export default App;

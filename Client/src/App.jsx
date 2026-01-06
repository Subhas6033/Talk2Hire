import React, { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Layout from "./Layout/Layout";
import Loader from "./Components/Loader/Loader";
import { AnimatePresence, motion } from "motion/react";
import { pageTransition } from "./Animations/CommonAnimation";

const App = () => {
  const [isLoading, setIsLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return <Loader label="Setting up your interview" />;
  }

  return (
    <Layout>
      <AnimatePresence mode="wait" initial={false}>
        <motion.main
          key={location.pathname}
          {...pageTransition}
          className="flex-1"
        >
          <Outlet />
        </motion.main>
      </AnimatePresence>
    </Layout>
  );
};

export default App;

import React, { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Layout from "./Layout/Layout";
import Loader from "./Components/Loader/Loader";

const App = () => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return <Loader label="Setting Up your Interview" />;
  }

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
};

export default App;

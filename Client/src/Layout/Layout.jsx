import React from "react";
import { Nav, Footer } from "../Components";
import { motion } from "motion/react";

const Layout = ({ children }) => {
  return (
    <div className="min-h-screen bg-linear-to-br from-bgDark via-[#11162a] to-bgDark text-textLight flex flex-col">
      <Nav />

      <motion.main
        className="flex-1 w-full"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        {children}
      </motion.main>

      <Footer />
    </div>
  );
};

export default Layout;

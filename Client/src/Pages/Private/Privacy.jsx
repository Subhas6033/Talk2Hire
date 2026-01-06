import React from "react";
import { motion } from "motion/react";
import { Card } from "../../Components/Common/Card";

const Privacy = () => {
  return (
    <>
      <title>QuantamHash Corporation | Privacy</title>
      <section className="min-h-screen flex items-center justify-center px-6 py-20 relative overflow-hidden">
        {/* Background glows */}
        <div className="absolute top-[-30%] left-[-20%] h-125 w-125 rounded-full bg-purpleGlow/20 blur-[160px]" />
        <div className="absolute bottom-[-30%] right-[-20%] h-125 w-125 rounded-full bg-purpleSoft/20 blur-[160px]" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="relative w-full max-w-3xl"
        >
          <Card variant="glow" padding="lg">
            <div className="space-y-4 text-center">
              <h1 className="text-3xl font-bold text-white">Privacy Policy</h1>

              <p className="text-white/70 text-sm leading-relaxed">
                Your privacy is important to us. We are currently working on a
                detailed privacy policy to explain how your data is collected,
                used, and protected.
              </p>

              <p className="text-white/50 text-sm">
                Full privacy details coming soon.
              </p>
            </div>
          </Card>
        </motion.div>
      </section>
    </>
  );
};

export default Privacy;

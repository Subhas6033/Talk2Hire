import React from "react";
import { motion } from "motion/react";
import { Card } from "../../Components/Common/Card";

const Privacy = () => {
  return (
    <>
      {/* Basic SEO */}
      <title>Privacy Policy | Talk2Hire </title>

      <meta
        name="description"
        content="Read the Privacy Policy of Talk2Hire to understand how we collect, use, and protect your personal information and data."
      />

      <meta name="robots" content="index, follow" />

      <link rel="canonical" href="https://talk2hire.com/privacy" />

      {/* Open Graph */}
      <meta property="og:title" content="Privacy Policy | Talk2Hire" />
      <meta
        property="og:description"
        content="Learn how Talk2Hire protects your data and ensures privacy across our AI-powered job and interview platform."
      />
      <meta property="og:type" content="website" />
      <meta property="og:url" content="https://talk2hire.com/privacy" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content="Privacy Policy | Talk2Hire" />
      <meta
        name="twitter:description"
        content="Understand how Talk2Hire collects, uses, and protects your personal information."
      />

      {/* Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "Privacy Policy",
          url: "https://talk2hire.com/privacy",
          description:
            "Privacy Policy explaining how Talk2Hire collects, processes, and safeguards user data.",
          publisher: {
            "@type": "Organization",
            name: "Talk2Hire",
            url: "https://talk2hire.com/",
          },
        })}
      </script>

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

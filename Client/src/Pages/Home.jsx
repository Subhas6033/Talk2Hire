import React from "react";
import { motion } from "motion/react";
import {
  fadeUp,
  staggerContainer,
  fadeUpItem,
} from "../Animations/CommonAnimation";
import { Button, TrustedCompaniesSlider } from "../Components";
import { Card, CardHeader, CardBody } from "../Components/Common/Card";
import { useNavigate } from "react-router-dom";
import { featuresData } from "../Data/HomePageData";

const Home = () => {
  const navigate = useNavigate();

  return (
    <>
      {/* SEO */}
      <title>AI Interview Preparation | Homepage</title>
      <meta
        name="description"
        content="AI Online Voice Interview System: Conduct dynamic, secure, voice-based technical interviews. Upload your resume, answer AI-generated questions, and receive detailed scoring and feedback."
      />
      <meta
        name="keywords"
        content="AI interview, technical interview, voice interview, AI interview preparation, mock interviews"
      />
      <meta name="robots" content="index, follow" />
      <link rel="canonical" href="https://www.google.com/" />

      {/*  Hero Sections */}
      <section className="relative overflow-hidden">
        {/* Decorative Glows */}
        <div className="absolute top-[-20%] left-[-10%] h-125 w-125 rounded-full bg-purpleGlow/20 blur-[140px]" />
        <div className="absolute bottom-[-20%] right-[-10%] h-125 w-125 rounded-full bg-purpleSoft/20 blur-[160px]" />

        <div className="relative mx-auto max-w-7xl px-6 pt-28 pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 items-center gap-12">
            <motion.div {...fadeUp} className="max-w-3xl">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">
                <span className="bg-linear-to-r from-purpleGlow to-purpleSoft bg-clip-text text-transparent">
                  AI-Powered
                </span>{" "}
                Voice Interviews
                <br />
                Built for the Future
              </h1>

              <p className="mt-6 text-lg text-white/75">
                Experience next-generation technical interviews powered by AI,
                real-time voice intelligence, and adaptive evaluation.
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                <Button size="lg" onClick={() => navigate("/interview")}>
                  Start Interview
                </Button>

                <Button
                  size="lg"
                  variant="secondary"
                  onClick={() => navigate("/dashboard")}
                >
                  View Dashboard
                </Button>
              </div>
            </motion.div>
          </div>

          {/* Features Sections */}
          <motion.div
            variants={staggerContainer(0.15)}
            initial="hidden"
            animate="show"
            className="mt-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {featuresData.map((item, index) => (
              <motion.div key={index} variants={fadeUpItem}>
                <Card variant="glow" padding="md" hoverable className="h-full">
                  <CardHeader>{item.title}</CardHeader>
                  <CardBody>{item.desc}</CardBody>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Trusted Companies */}
        <div>
          <TrustedCompaniesSlider />
        </div>
      </section>
    </>
  );
};

export default Home;

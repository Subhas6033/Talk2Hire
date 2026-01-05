import React from "react";
import { motion } from "motion/react";
import {
  fadeUp,
  staggerContainer,
  fadeUpItem,
} from "../Animations/CommonAnimation";

const Home = () => {
  return (
    <>
      {/* SEO Optimizations */}
      <title>AI Interview Preparation | Homepage</title>
      <meta
        name="description"
        content="AI Online Voice Interview System: Conduct dynamic, secure, voice-based technical interviews. Upload your resume, answer AI-generated questions, and receive detailed scoring and feedback through a professional dashboard."
      />
      <meta
        name="keywords"
        content="AI interview, technical interview, online interview, voice-based interview, resume assessment, AI interview preparation, interview scoring, job interview practice, AI interview platform"
      />
      <meta name="robots" content="index, follow" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      {/* TODO: Update with the real URL */}
      <link rel="canonical" href="https://www.google.com/" />
      {/* Open Graph / Facebook */}
      <meta property="og:title" content="AI Interview Preparation | Homepage" />
      <meta
        property="og:description"
        content="Conduct dynamic, secure, voice-based AI interviews. Get scored, detailed feedback, and improve your technical skills with our professional AI interview platform."
      />
      <meta property="og:type" content="website" />
      {/* TODO: Update with the real URL*/}
      <meta property="og:url" content="https://www.google.com" />
      {/* TODO: Update the real image url */}
      <meta property="og:image" content="https://www.google.com" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta
        name="twitter:title"
        content="AI Interview Preparation | Homepage"
      />
      <meta
        name="twitter:description"
        content="Prepare for technical interviews with our AI-powered voice interview system. Upload your resume, answer questions, and get detailed scoring and feedback."
      />
      {/*  TODO: Update the real image url */}
      <meta name="twitter:image" content="https://www.gogle.com" />

      {/* Main Body Starts  */}
      <section className="relative overflow-hidden">
        {/* Decorative glow ONLY */}
        <div className="absolute top-[-20%] left-[-10%] h-125 w-125 rounded-full bg-purpleGlow/20 blur-[140px]" />
        <div className="absolute bottom-[-20%] right-[-10%] h-125 w-125 rounded-full bg-purpleSoft/20 blur-[160px]" />

        {/* CONTENT WRAPPER */}
        <div className="relative mx-auto max-w-7xl px-6 pt-28 pb-20">
          {/* Hero */}
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
              <button className="rounded-xl bg-purpleGlow px-8 py-3 text-sm font-semibold text-white shadow-[0_0_30px_rgba(155,92,255,0.6)] hover:scale-105 transition">
                Start Interview
              </button>

              <button className="rounded-xl border border-white/20 px-8 py-3 text-sm font-medium hover:bg-white/10 transition">
                View Dashboard
              </button>
            </div>
          </motion.div>

          {/* Feature Cards */}
          <motion.div
            variants={staggerContainer(0.15)}
            initial="hidden"
            animate="show"
            className="mt-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {[
              {
                title: "AI-Generated Questions",
                desc: "Dynamic questions based on role, experience, and resume tech stack.",
              },
              {
                title: "Live Voice Evaluation",
                desc: "Real-time speech-to-text analysis with intelligent scoring.",
              },
              {
                title: "Detailed Scoring Reports",
                desc: "Rubric-based marks, accuracy %, and improvement suggestions.",
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                variants={fadeUpItem}
                className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6 shadow-[0_0_40px_rgba(155,92,255,0.15)]"
              >
                <h3 className="text-lg font-semibold text-purpleSoft">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-white/70">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>
    </>
  );
};

export default Home;

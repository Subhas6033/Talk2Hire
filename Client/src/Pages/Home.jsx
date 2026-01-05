import React from "react";
import { motion } from "motion/react";
import { fadeUp } from "../Animations/CommonAnimation";
import { staggerContainer, fadeUpItem } from "../Animations/VarityAnimation";

const Home = () => {
  return (
    <section className="relative overflow-hidden">
      {/* Decorative glow ONLY */}
      <div className="absolute top-[-20%] left-[-10%] h-[500px] w-[500px] rounded-full bg-purpleGlow/20 blur-[140px]" />
      <div className="absolute bottom-[-20%] right-[-10%] h-[500px] w-[500px] rounded-full bg-purpleSoft/20 blur-[160px]" />

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
  );
};

export default Home;

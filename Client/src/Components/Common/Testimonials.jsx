import React from "react";
import { motion } from "motion/react";
import { Card, CardBody } from "../Common/Card";
import { fadeUp } from "../../Animations/CommonAnimation";
import { testimonials } from "../../Data/HomePageData";

export const TestimonialsSlider = () => {
  return (
    <section className="relative py-28 overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 bg-linear-to-b from-transparent via-purpleGlow/5 to-transparent" />

      <div className="relative mx-auto max-w-7xl px-6">
        {/* Section Header */}
        <motion.div
          {...fadeUp}
          viewport={{ once: true, amount: 0.3 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-white/90">
            Loved by Developers Worldwide
          </h2>
          <p className="mt-4 text-white/60 max-w-2xl mx-auto">
            Trusted by professionals preparing for real-world technical
            interviews.
          </p>
        </motion.div>

        {/* Slider */}
        <div className="relative overflow-hidden">
          <motion.div
            className="flex gap-8"
            animate={{ x: ["0%", "-50%"] }}
            transition={{
              repeat: Infinity,
              ease: "linear",
              duration: 35,
            }}
            whileHover={{ animationPlayState: "paused" }}
          >
            {[...testimonials, ...testimonials].map((item, index) => (
              <div
                key={`${item.name}-${index}`}
                className="min-w-[320px] max-w-sm"
              >
                <Card
                  variant="glow"
                  padding="lg"
                  hoverable
                  className="h-full flex flex-col"
                >
                  {/* Quote */}
                  <CardBody className="flex-1 text-white/75">
                    “{item.quote}”
                  </CardBody>

                  {/* User */}
                  <div className="mt-6 flex items-center gap-4">
                    <img
                      src={item.avatar}
                      alt={item.name}
                      loading="lazy"
                      className="h-12 w-12 rounded-full object-cover border border-white/10"
                    />
                    <div>
                      <p className="font-semibold text-white">{item.name}</p>
                      <p className="text-sm text-white/60">{item.role}</p>
                    </div>
                  </div>
                </Card>
              </div>
            ))}
          </motion.div>

          {/* Edge fade */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-linear-to-r from-black to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-linear-to-l from-black to-transparent" />
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSlider;

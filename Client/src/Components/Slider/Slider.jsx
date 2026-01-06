import React from "react";
import { motion } from "motion/react";
import clsx from "clsx";
import { Card } from "../Common/Card";

export const TrustedCompaniesSlider = () => {
  const companies = [
    {
      name: "Google",
      logo: "/google.webp",
      className: "h-10",
    },
    {
      name: "Amazon",
      logo: "/amazon.png",
      className: "h-12",
    },
    {
      name: "Microsoft",
      logo: "/microsoft.png",
      className: "h-20",
    },
    {
      name: "Netflix",
      logo: "/netflix.png",
      className: "h-9",
    },
    {
      name: "Meta",
      logo: "/meta.png",
      className: "h-10",
    },
  ];

  return (
    <section className="relative mt-28 overflow-hidden">
      {/* Section Title */}
      <div className="mb-10 text-center">
        <p className="text-2xl font-semibold uppercase tracking-wider text-purpleSoft">
          Trusted by teams from
        </p>
      </div>

      {/* Slider */}
      <div className="relative overflow-hidden">
        <motion.div
          className="flex gap-12"
          aria-label="Trusted companies"
          animate={{ x: ["0%", "-50%"] }}
          transition={{
            repeat: Infinity,
            ease: "linear",
            duration: 30,
          }}
        >
          {[...companies, ...companies].map((company, index) => (
            <div
              key={`${company.name}-${index}`}
              className="flex min-w-45items-center justify-center"
            >
              <Card
                variant="glow"
                padding="sm"
                hoverable
                className="h-20 w-40 flex items-center justify-center"
              >
                <img
                  src={company.logo}
                  alt={`${company.name} logo`}
                  loading="lazy"
                  className={clsx(
                    "w-auto object-contain transition-transform duration-300",
                    "brightness-110 contrast-110",
                    "group-hover:scale-110",
                    company.className
                  )}
                />
              </Card>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

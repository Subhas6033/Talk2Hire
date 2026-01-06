import React from "react";
import { motion } from "motion/react";
import { Card, CardHeader, CardBody, CardFooter } from "../Common/Card";
import Button from "../Common/Button";
import { fadeUp } from "../../Animations/CommonAnimation";
import { pricingPlans } from "../../Data/HomePageData";

export const PricingSection = () => {
  return (
    <section className="relative py-28 bg-black/20 overflow-hidden">
      {/* Section Title */}
      <motion.div
        initial={fadeUp.initial}
        whileInView={fadeUp.animate}
        viewport={{ once: true, amount: 0.3 }}
        transition={fadeUp.transition}
        className="text-center mb-16"
      >
        <h2 className="text-3xl sm:text-4xl font-bold text-white/90">
          Pricing Plans
        </h2>
        <p className="mt-4 text-white/60">
          Choose the plan that fits your AI interview preparation needs.
        </p>
      </motion.div>

      {/* Pricing Cards */}
      <div className="max-w-7xl mx-auto grid gap-8 sm:grid-cols-2 lg:grid-cols-3 px-6">
        {pricingPlans.map((plan, index) => (
          <motion.div
            key={plan.name}
            initial={fadeUp.initial}
            whileInView={fadeUp.animate}
            viewport={{ once: true, amount: 0.3 }}
            transition={{
              ...fadeUp.transition,
              delay: index * 0.15,
            }}
            className="h-full"
          >
            <Card
              variant={plan.variant}
              padding="lg"
              hoverable
              className="h-full flex flex-col justify-between"
            >
              <div>
                <CardHeader className="text-xl font-bold">
                  {plan.name}
                </CardHeader>
                <CardBody>
                  <p className="text-3xl font-semibold mt-2 mb-4 text-white">
                    {plan.price}
                    {plan.price !== "Contact Us" && (
                      <span className="text-sm text-white/70">/month</span>
                    )}
                  </p>
                  <p className="mb-4 text-white/70">{plan.description}</p>
                  <ul className="space-y-2 mb-6 list-disc list-inside text-white/70">
                    {plan.features.map((feature, i) => (
                      <li key={i}>{feature}</li>
                    ))}
                  </ul>
                </CardBody>
              </div>

              <CardFooter className="mt-auto">
                <Button
                  size="lg"
                  variant={plan.variant === "solid" ? "secondary" : "primary"}
                  className="w-full"
                >
                  {plan.buttonText}
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

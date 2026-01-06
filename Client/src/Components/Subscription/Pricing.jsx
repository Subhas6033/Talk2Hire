import React, { useState } from "react";
import { motion } from "motion/react";
import { Card, CardHeader, CardBody, CardFooter } from "../Common/Card";
import Button from "../Common/Button";
import { fadeUp } from "../../Animations/CommonAnimation";
import { pricingPlans } from "../../Data/HomePageData";
import PricingModal from "./PricingModal";
import { useNavigate } from "react-router-dom";

export const PricingSection = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const navigate = useNavigate();

  const handleOpenModal = (plan) => {
    if (plan.price === "Contact Us") return;

    setSelectedPlan({
      name: plan.name,
      description: plan.description,
      price: plan.price,
      currency: plan.currency || "",
      billingNote: plan.billingNote || "Billed monthly",
      features: plan.features,
    });
    setIsModalOpen(true);
  };

  const handlePayment = async (paymentData) => {
    console.log("Selected plan:", selectedPlan);
    console.log("Payment data:", paymentData);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsModalOpen(false);
  };

  return (
    <>
      <section className="relative py-28 bg-black/20 overflow-hidden">
        <motion.div
          initial={fadeUp.initial}
          whileInView={fadeUp.animate}
          viewport={{ once: true, amount: 0.3 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-white/90">
            Pricing Plans
          </h2>
          <p className="mt-4 text-white/60">
            Choose the plan that fits your AI interview preparation needs.
          </p>
        </motion.div>

        <div className="max-w-7xl mx-auto grid gap-8 sm:grid-cols-2 lg:grid-cols-3 px-6">
          {pricingPlans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={fadeUp.initial}
              whileInView={fadeUp.animate}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ delay: index * 0.15 }}
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
                    onClick={() =>
                      plan.variant === "solid"
                        ? navigate("/contact")
                        : handleOpenModal(plan)
                    }
                  >
                    {plan.buttonText}
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Payment Modal */}
      {selectedPlan && (
        <PricingModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          product={selectedPlan}
          onPay={handlePayment}
        />
      )}
    </>
  );
};

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { Card, CardHeader, CardBody } from "../Components/Common/Card";
import { Button } from "../Components/index";
import { FormField } from "../Components/Common/Input";
import { motion } from "motion/react";

const ContactPage = () => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitSuccessful },
  } = useForm();

  const [submitted, setSubmitted] = useState(false);

  const onSubmit = (data) => {
    console.log("Contact form submitted:", data);
    setSubmitted(true);
    reset();
  };

  return (
    <>
      {/* Basic SEO */}
      <title>Contact Talk2Hire | Get in Touch | Quantumhash Corporation </title>

      <meta
        name="description"
        content="Contact QuantamHash Corporation for business inquiries, partnerships, or support. Visit our San Francisco office or send us a message online."
      />

      <meta
        name="keywords"
        content="Contact, QuantamHash Corporation, business inquiry, support, San Francisco tech company"
      />

      <meta name="robots" content="index, follow" />

      <link rel="canonical" href="https://talk2hire.com/contact" />

      {/* Open Graph */}
      <meta property="og:title" content="Contact QuantamHash Corporation" />
      <meta
        property="og:description"
        content="Reach out to our team for inquiries, partnerships, or support."
      />
      <meta property="og:type" content="website" />
      <meta property="og:url" content="https://talk2hire.com/contact" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="Contact QuantamHash Corporation" />
      <meta
        name="twitter:description"
        content="Get in touch with QuantamHash Corporation."
      />

      {/* Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "QuantamHash Corporation",
          url: "https://talk2hire.com",
          logo: "https://talk2hire.com/talk2hirelogo.png",
          contactPoint: {
            "@type": "ContactPoint",
            telephone: "+91-013456789",
            contactType: "customer support",
            email: "support@talk2hire.com",
          },
          address: {
            "@type": "PostalAddress",
            streetAddress: "800 N King Street, Suite 304",
            addressLocality: "Wilmington",
            addressRegion: "DE",
            postalCode: "19801",
            addressCountry: "US",
          },
        })}
      </script>
      {/* Main Components */}
      <motion.div
        className="min-h-screen bg-[#0f111a] px-4 py-16 flex justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Side - Map & Contact Info */}
          <div className="space-y-6">
            <Card
              variant="glow"
              padding="lg"
              className="border-transparent h-full"
            >
              <CardHeader>
                <h2 className="text-3xl font-bold text-white">Contact Info</h2>
              </CardHeader>
              <CardBody className="space-y-6">
                {/* Map Embed */}
                <div className="w-full h-64 rounded-xl overflow-hidden border border-white/10">
                  <iframe
                    title="Company Location"
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3153.019570798683!2d-122.41941518468169!3d37.77492977975954!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8085818c1b4e9f15%3A0x20b8d77d108c2f62!2sSan+Francisco%2C+CA%2C+USA!5e0!3m2!1sen!2sin!4v1698995605123!5m2!1sen!2sin"
                    width="100%"
                    height="100%"
                    className="border-0"
                    allowFullScreen=""
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  ></iframe>
                </div>

                {/* Contact Details */}
                <div className="space-y-2 mt-5">
                  <p className="text-white/70">
                    <span className="font-semibold text-white">Email:</span>{" "}
                    contact@quantamhashcorporation.com
                  </p>
                  <p className="text-white/70">
                    <span className="font-semibold text-white">Phone:</span> +91
                    013456789
                  </p>
                  <p className="text-white/70">
                    <span className="font-semibold text-white">Address:</span>{" "}
                    123 Main St, San Francisco, CA
                  </p>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Right Side - Contact Form */}
          <div className="space-y-6">
            <Card variant="glow" padding="lg" className="border-transparent">
              <CardHeader>
                <h2 className="text-3xl font-bold text-white">
                  Send a Message
                </h2>
              </CardHeader>
              <CardBody>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    id="name"
                    label="Full Name"
                    {...register("name", { required: "Name is required" })}
                    error={errors.name?.message}
                  />

                  <FormField
                    id="email"
                    label="Email Address"
                    type="email"
                    {...register("email", {
                      required: "Email is required",
                      pattern: {
                        value: /\S+@\S+\.\S+/,
                        message: "Invalid email address",
                      },
                    })}
                    error={errors.email?.message}
                  />

                  <FormField
                    id="subject"
                    label="Subject"
                    {...register("subject", {
                      required: "Subject is required",
                    })}
                    error={errors.subject?.message}
                  />

                  <FormField
                    id="message"
                    label="Message"
                    type="textarea"
                    className="h-32 resize-none"
                    {...register("message", {
                      required: "Message is required",
                    })}
                    error={errors.message?.message}
                  />

                  <div className="flex flex-wrap gap-4 items-center justify-between">
                    <Button variant="primary" size="lg" type="submit">
                      Send Message
                    </Button>
                    {submitted && isSubmitSuccessful && (
                      <p className="text-green-400 mt-2 text-sm">
                        Your message has been sent successfully!
                      </p>
                    )}
                  </div>
                </form>
              </CardBody>
            </Card>
          </div>
        </div>
      </motion.div>
    </>
  );
};

export default ContactPage;

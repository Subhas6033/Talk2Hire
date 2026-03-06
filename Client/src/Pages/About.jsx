import React from "react";
import { Card, CardHeader, CardBody } from "../Components/Common/Card";
import { Button } from "../Components/index";
import { useNavigate } from "react-router-dom";

const AboutPage = () => {
  const navigate = useNavigate();

  return (
    <>
      {/* Basic SEO */}
      <title>About Talk2Hire | AI-Powered Interview Preparation Platform</title>
      <meta
        name="description"
        content="Learn about Talk2Hire, an AI-powered interview preparation platform that simulates real interviews, provides instant scoring, and helps candidates improve with personalized feedback."
      />
      <meta
        name="keywords"
        content="AI interview platform, mock interview practice, interview preparation online, AI interview simulator, Talk2Hire platform"
      />
      <meta name="robots" content="index, follow" />
      <link rel="canonical" href="https://talk2hire.com/about" />
      {/* Open Graph */}
      <meta
        property="og:title"
        content="About Talk2Hire | AI Interview Preparation Platform"
      />
      <meta
        property="og:description"
        content="Discover how Talk2Hire uses AI to simulate realistic interviews, evaluate answers, and help candidates improve with instant feedback."
      />
      <meta property="og:type" content="website" />
      <meta property="og:url" content="https://talk2hire.com/about" />
      <meta
        property="og:image"
        content="https://talk2hire.com/talk2hirelogo.png"
      />
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta
        name="twitter:title"
        content="About Talk2Hire | AI Interview Platform"
      />
      <meta
        name="twitter:description"
        content="AI-powered mock interviews with instant scoring and personalized feedback."
      />
      <meta
        name="twitter:image"
        content="https://talk2hire.com/talk2hirelogo.png"
      />
      {/* Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Talk2Hire",
          url: "https://talk2hire.com/",
          logo: "https://talk2hire.com/talk2hirelogo.png",
          description:
            "Talk2Hire is an AI-powered interview preparation platform offering realistic mock interviews, instant scoring, and personalized feedback across multiple domains.",
          sameAs: [
            "https://www.linkedin.com/company/quantumhash-corporation/",
            "https://x.com/QuantumhashCrp",
            "https://www.instagram.com/quantumhash_corporation/",
            "https://www.facebook.com/profile.php?id=61582410893482",
            "https://www.youtube.com/@QuantumHashCorporation",
            "https://github.com/Quantumhash-Corporation",
          ],
        })}
      </script>
      <div className="min-h-screen bg-linear-to-br from-bgDark via-[#11162a] to-bgDark px-4 py-16 flex justify-center">
        <div className="max-w-5xl w-full space-y-8">
          {/* Page Header */}
          <Card
            variant="glow"
            padding="lg"
            className="border-transparent text-center"
          >
            <CardHeader>
              <h1 className="text-4xl sm:text-5xl font-bold text-white mb-2">
                About Talk2Hire Platform
              </h1>
            </CardHeader>
            <CardBody>
              <p className="text-white/70 text-md sm:text-lg">
                Our platform leverages AI to help candidates practice interviews
                in a realistic environment. We provide dynamic question sets
                based on technology, finance, healthcare, and education domains,
                evaluate answers, and provide scoring & feedback.
              </p>
            </CardBody>
          </Card>

          {/* Features */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              {
                title: "Realistic Interviews",
                desc: "Simulate real interview conditions with AI-driven questions and voice recognition.",
              },
              {
                title: "Instant Scoring",
                desc: "Get instant feedback with a rubric-based scoring system for every answer.",
              },
              {
                title: "Suggestions & Tips",
                desc: "Receive personalized suggestions to improve clarity, confidence, and technical depth.",
              },
              {
                title: "Multi-domain Coverage",
                desc: "Covers multiple domains including Technology, Finance, Healthcare, and Education.",
              },
            ].map((item, i) => (
              <Card
                key={i}
                variant="glow"
                padding="md"
                className="border-transparent"
              >
                <CardHeader>{item.title}</CardHeader>
                <CardBody>
                  <p className="text-white/70 text-sm">{item.desc}</p>
                </CardBody>
              </Card>
            ))}
          </div>

          {/* CTA */}
          <div className="text-center mt-6">
            <Button
              variant="primary"
              size="lg"
              onClick={() => navigate("/interview")}
            >
              Start Your Interview
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default AboutPage;

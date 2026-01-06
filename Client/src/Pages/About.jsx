import React from "react";
import { Card, CardHeader, CardBody } from "../Components/Common/Card";
import { Button } from "../Components/index";
import { useNavigate } from "react-router-dom";

const AboutPage = () => {
  const navigate = useNavigate();

  return (
    <>
      <title>QuantamHash Corporation | About</title>
      <div className="min-h-screen bg-[#0f111a] px-4 py-16 flex justify-center">
        <div className="max-w-5xl w-full space-y-8">
          {/* Page Header */}
          <Card
            variant="glow"
            padding="lg"
            className="border-transparent text-center"
          >
            <CardHeader>
              <h1 className="text-4xl sm:text-5xl font-bold text-white mb-2">
                About AI Interview Platform
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

          {/* Features / Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Card variant="glow" padding="md" className="border-transparent">
              <CardHeader>Realistic AI Interviews</CardHeader>
              <CardBody>
                <p className="text-white/70 text-sm">
                  Simulate real interview conditions with AI-driven questions
                  and voice recognition.
                </p>
              </CardBody>
            </Card>

            <Card variant="glow" padding="md" className="border-transparent">
              <CardHeader>Instant Scoring</CardHeader>
              <CardBody>
                <p className="text-white/70 text-sm">
                  Get instant feedback with a rubric-based scoring system for
                  every answer.
                </p>
              </CardBody>
            </Card>

            <Card variant="glow" padding="md" className="border-transparent">
              <CardHeader>Suggestions & Tips</CardHeader>
              <CardBody>
                <p className="text-white/70 text-sm">
                  Receive personalized suggestions to improve clarity,
                  confidence, and technical depth.
                </p>
              </CardBody>
            </Card>

            <Card variant="glow" padding="md" className="border-transparent">
              <CardHeader>Multi-domain Coverage</CardHeader>
              <CardBody>
                <p className="text-white/70 text-sm">
                  Covers multiple domains including Technology, Finance,
                  Healthcare, and Education.
                </p>
              </CardBody>
            </Card>
          </div>

          {/* Call to Action */}
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

import React from "react";
import { Card, CardHeader, CardBody } from "../Components/Common/Card";
import { Button } from "../Components/index";
import { useNavigate } from "react-router-dom";

const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <>
      <title>QuantamHash Corporation | Not Found</title>

      <div
        className="
          min-h-screen flex items-center justify-center px-4
          bg-bgDark/90 backdrop-blur-xl
          relative overflow-hidden
        "
      >
        {/* Soft background glow (same family as footer) */}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(155,92,255,0.12),transparent_60%)]" />

        <Card
          variant="glow"
          padding="lg"
          className="relative z-10 max-w-lg w-full text-center border-transparent"
        >
          <CardHeader>
            <h1 className="text-6xl font-bold text-white mb-2">
              404 Not Found
            </h1>
          </CardHeader>

          <CardBody>
            <p className="text-white/60 mb-6">
              Oops! The page you are looking for does not exist.
            </p>

            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button
                variant="primary"
                onClick={() => navigate("/")}
                className="w-full sm:w-auto"
              >
                Go to Home
              </Button>

              <Button
                variant="secondary"
                onClick={() => navigate(-1)}
                className="w-full sm:w-auto"
              >
                Go Back
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
};

export default NotFoundPage;

import React from "react";
import { Card, CardHeader, CardBody } from "../Components/Common/Card";
import { Button } from "../Components/index";
import { useNavigate } from "react-router-dom";

const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <>
      <title>QuantamHash Corporation | Not Found</title>
      <div className="min-h-screen flex items-center justify-center bg-[#0f111a] px-4">
        <Card
          variant="glow"
          padding="lg"
          className="max-w-md w-full text-center border-transparent"
        >
          <CardHeader>
            <h1 className="text-6xl font-bold text-white mb-2">404</h1>
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

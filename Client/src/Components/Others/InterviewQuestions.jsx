import React, { useEffect, useRef, useState } from "react";
import { Button, Modal } from "../index";
import { Card } from "../Common/Card";
import useInterview from "../../Hooks/useInterviewHook";

const InterviewQuestions = ({ isOpen, onCancel, formData }) => {
  const {
    currentQuestion,
    isLastQuestion,
    goNext,
    loadQuestions,
    status,
    duration,
    resetInterview,
  } = useInterview();

  const totalDuration = duration || 300;
  const [timeLeft, setTimeLeft] = useState(totalDuration);
  const videoRef = useRef(null);

  const loaded = useRef(false);

  // Load questions only once
  useEffect(() => {
    const fetchQuestions = async () => {
      if (!loaded.current && isOpen && formData?.resume) {
        const res = await loadQuestions(formData);
        loaded.current = true;
        if (res.meta.requestStatus !== "fulfilled") {
          console.error("Failed to load questions", res);
        }
      }
    };
    fetchQuestions();
  }, [isOpen, formData, loadQuestions]);

  //  Reset interview on close
  useEffect(() => {
    if (!isOpen) {
      resetInterview();
      loaded.current = false;
      setTimeLeft(totalDuration);
    }
  }, [isOpen, resetInterview, totalDuration]);

  //  Countdown timer
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(
      () => setTimeLeft((t) => (t > 0 ? t - 1 : 0)),
      1000
    );
    return () => clearInterval(interval);
  }, [isOpen]);

  //  Camera stream
  useEffect(() => {
    if (!isOpen) return;
    let stream;
    navigator.mediaDevices.getUserMedia({ video: true }).then((s) => {
      stream = s;
      if (videoRef.current) videoRef.current.srcObject = stream;
    });
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [isOpen]);

  const minutes = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const seconds = String(timeLeft % 60).padStart(2, "0");

  return (
    <section>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card variant="glow" className="flex gap-6">
            <div className="flex items-end gap-1 h-20">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-purple-500 rounded-full animate-bounce"
                  style={{
                    animationDelay: `${i * 100}ms`,
                    height: `${Math.random() * 50 + 10}px`, // random height for wave effect
                  }}
                />
              ))}
            </div>

            <div className="text-lg">
              {status === "loading" && "Loading questions..."}
              {status === "failed" && "Failed to load questions"}
              {status === "succeeded" && currentQuestion
                ? currentQuestion
                : status === "succeeded"
                  ? "No questions available"
                  : null}
            </div>
          </Card>

          <Card>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={onCancel}>
                Cancel
              </Button>

              <Button
                onClick={goNext}
                disabled={status !== "succeeded" || !currentQuestion}
              >
                {isLastQuestion ? "Submit Interview" : "Next Question"}
              </Button>
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card className="text-center">
            <div className="text-3xl font-mono">
              {minutes}:{seconds}
            </div>
          </Card>

          <Card className="p-0 overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              muted
              className="w-full h-64 object-cover"
            />
          </Card>
        </div>
      </div>
    </section>
  );
};

export default InterviewQuestions;

import React, { useState } from "react";
import { motion } from "motion/react";
import { Button } from "../index";
import { Camera, Maximize, ShieldCheck } from "lucide-react";

const Guidelines = ({ onStartInterview }) => {
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [error, setError] = useState("");

  const handleStartFullscreen = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });

      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }

      setPermissionsGranted(true);
      setError("");

      stream.getTracks().forEach((track) => track.stop());
    } catch (err) {
      setError(
        "Fullscreen mode and camera access are mandatory to start the interview."
      );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-linear-to-br from-bgDark via-[#11162a] to-bgDark">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-3xl"
      >
        <div className="relative rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_0_60px_rgba(155,92,255,0.15)] p-8 md:p-10">
          {/* Header */}
          <div className="mb-8 text-center">
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-3xl md:text-4xl font-bold text-white"
            >
              AI Interview Guidelines
            </motion.h1>
            <p className="mt-3 text-white/60 text-sm md:text-base">
              Please read carefully before starting your interview
            </p>
          </div>

          {/* Guidelines */}
          <div className="space-y-4 text-white/80 mb-8">
            {[
              "Ensure your microphone and camera are working properly",
              "Sit in a quiet environment with good lighting",
              "Close other tabs and applications",
              "Answer clearly and confidently",
              "Fullscreen and camera access are mandatory",
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + index * 0.05 }}
                className="flex items-start gap-3"
              >
                <ShieldCheck className="text-purpleGlow mt-0.5" size={18} />
                <span>{item}</span>
              </motion.div>
            ))}
          </div>

          {/* Permission Notice */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className={`rounded-xl p-4 mb-6 border ${
              permissionsGranted
                ? "border-green-400/30 bg-green-400/10 text-green-300"
                : "border-yellow-400/30 bg-yellow-400/10 text-yellow-300"
            }`}
          >
            <div className="flex items-center gap-3">
              <Camera size={18} />
              <Maximize size={18} />
              <span className="text-sm font-medium">
                {permissionsGranted
                  ? "Permissions granted. You’re ready to start."
                  : "Camera & fullscreen permission required"}
              </span>
            </div>
          </motion.div>

          {/* Error */}
          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-red-400 text-sm mb-4"
            >
              {error}
            </motion.p>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              size="lg"
              variant="primary"
              className="flex-1"
              onClick={handleStartFullscreen}
            >
              Enable Fullscreen & Camera
            </Button>

            <Button
              size="lg"
              variant={permissionsGranted ? "primary" : "secondary"}
              disabled={!permissionsGranted}
              className="flex-1"
              onClick={onStartInterview}
            >
              Start Interview
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Guidelines;

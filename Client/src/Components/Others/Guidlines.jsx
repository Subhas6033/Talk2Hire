import React, { useState } from "react";
import { motion } from "motion/react";
import { Button } from "../index";
import { Camera, Maximize, ShieldCheck } from "lucide-react";

const Guidelines = ({ onClick }) => {
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

      //Notify parent to close guidelines & open mic check
      onClick?.();
    } catch (err) {
      setError(
        "Fullscreen mode and camera access are mandatory to start the interview."
      );
    }
  };

  return (
    <div className="w-full px-6">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="relative rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 p-8 md:p-10">
          <div className="mb-8 text-center">
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              AI Interview Guidelines
            </h1>
            <p className="mt-3 text-white/60">
              Please read carefully before starting your interview
            </p>
          </div>

          <div className="space-y-4 text-white/80 mb-8">
            {[
              "Ensure your microphone and camera are working properly",
              "Sit in a quiet environment with good lighting",
              "Close other tabs and applications",
              "Answer clearly and confidently",
              "Fullscreen and camera access are mandatory",
            ].map((item, index) => (
              <div key={index} className="flex gap-3">
                <ShieldCheck className="text-purpleGlow mt-1" size={18} />
                <span>{item}</span>
              </div>
            ))}
          </div>

          <div
            className={`rounded-xl p-4 mb-6 border ${
              permissionsGranted
                ? "border-green-400/30 bg-green-400/10 text-green-300"
                : "border-yellow-400/30 bg-yellow-400/10 text-yellow-300"
            }`}
          >
            <div className="flex items-center gap-3">
              <Camera size={18} />
              <Maximize size={18} />
              <span className="text-sm">
                {permissionsGranted
                  ? "Permissions granted. You’re ready."
                  : "Camera & fullscreen permission required"}
              </span>
            </div>
          </div>

          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

          <Button size="lg" className="w-full" onClick={handleStartFullscreen}>
            Enable Fullscreen & Camera
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default Guidelines;

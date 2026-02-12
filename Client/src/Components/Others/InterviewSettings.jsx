import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import {
  SkillsSelector,
  Button,
  Guidlines,
  Modal,
  MicrophoneCheck,
  CameraCheck,
} from "../index";
import { Card } from "../Common/Card";
import { useDispatch, useSelector } from "react-redux";
import { startInterview } from "../../API/interviewApi";

const InterviewSettings = ({ onInterviewReady }) => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  const { watch, setValue, handleSubmit } = useForm({
    mode: "onChange",
    defaultValues: { skills: [] },
  });

  const skills = watch("skills");

  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [openGuideLines, setOpenGuideLines] = useState(false);
  const [isMicOpen, setIsMicOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const [sessionData, setSessionData] = useState(null);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [questionsReady, setQuestionsReady] = useState(false);

  const hasExistingSkills = user?.skill && user.skill.trim() !== "";

  // Store selected skills for later use
  const selectedSkillsRef = useRef(null);

  // ✅ CRITICAL FIX: Store stream ONLY in ref (not state)
  const cameraStreamRef = useRef(null);

  // ✅ Track if we've already started
  const hasStartedInterviewRef = useRef(false);

  useEffect(() => {
    if (hasExistingSkills) {
      const skillsArray = user.skill
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      setValue("skills", skillsArray);
    }
  }, [user, hasExistingSkills, setValue]);

  // ✅ Generate questions in the background
  const generateQuestionsInBackground = async () => {
    if (!user?.id) {
      setError("User not authenticated.");
      return;
    }

    try {
      setIsGeneratingQuestions(true);
      setQuestionsReady(false);

      // Start question generation
      const result = await dispatch(
        startInterview({
          skills: !hasExistingSkills ? selectedSkillsRef.current : undefined,
        }),
      ).unwrap();

      if (!result?.sessionId) {
        throw new Error("Session ID not returned from server");
      }

      const newSessionData = {
        interviewId: result.sessionId,
        userId: user?.id,
      };

      setSessionData(newSessionData);

      setTimeout(() => {
        setQuestionsReady(true);
        setIsGeneratingQuestions(false);
      }, 100);
    } catch (err) {
      console.error("❌ Question generation error:", err);
      setError(err?.message || "Failed to generate questions");
      setIsGeneratingQuestions(false);
      setQuestionsReady(false);
    }
  };

  const onSubmit = async () => {
    if (!hasExistingSkills && (!skills || skills.length === 0)) {
      setError("Please select at least one skill to continue.");
      return;
    }

    if (!user?.id) {
      setError("User not authenticated.");
      return;
    }

    try {
      setStatus("loading");
      setError(null);

      selectedSkillsRef.current = skills;

      setOpenGuideLines(true);
      setStatus("succeeded");

      generateQuestionsInBackground();
    } catch (err) {
      console.error("❌ Submit error:", err);
      setError(err?.message || "Failed to start interview");
      setStatus("failed");
    }
  };

  // ✅ CRITICAL FIX: Handle camera success - store in ref and check immediately
  const handleCameraSuccess = (stream) => {
    console.log("📹 Primary camera stream received");

    // ✅ Store ONLY in ref (not state)
    cameraStreamRef.current = stream;

    // ✅ Verify stream immediately
    const videoTrack = stream.getVideoTracks()[0];

    console.log("📹 Stream stored and verified:", {
      streamId: stream.id,
      active: stream.active,
      trackState: videoTrack?.readyState,
      trackEnabled: videoTrack?.enabled,
    });

    // ✅ Add track ended listener
    if (videoTrack) {
      videoTrack.addEventListener(
        "ended",
        () => {
          console.error(
            "❌ CRITICAL: Video track ended unexpectedly in InterviewSettings!",
          );
          alert("Camera stream stopped. Please refresh and try again.");
        },
        { once: true },
      );
    }

    setIsCameraOpen(false);

    console.log("✅ Camera ready, checking if can start now...");

    // ✅ CRITICAL: Check if we can start immediately
    tryStartInterview();
  };

  // ✅ CRITICAL FIX: Consolidated start logic
  const tryStartInterview = () => {
    // Check all conditions
    const canStart =
      questionsReady &&
      sessionData &&
      cameraStreamRef.current &&
      !isGeneratingQuestions &&
      !hasStartedInterviewRef.current;

    /* console.log("🔍 tryStartInterview check:", {
      questionsReady,
      hasSessionData: !!sessionData,
      hasStream: !!cameraStreamRef.current,
      streamActive: cameraStreamRef.current?.active,
      isGenerating: isGeneratingQuestions,
      hasStarted: hasStartedInterviewRef.current,
      canStart,
    }); */

    if (!canStart) {
      return;
    }

    // Mark as started
    hasStartedInterviewRef.current = true;

    // Get stream from ref
    const stream = cameraStreamRef.current;

    // ✅ CRITICAL: Verify stream one final time
    const videoTrack = stream.getVideoTracks()[0];

    if (!videoTrack) {
      console.error("❌ No video track!");
      setError("No video track found. Please refresh and try again.");
      hasStartedInterviewRef.current = false;
      return;
    }

    if (videoTrack.readyState !== "live") {
      console.error("❌ Video track not live:", videoTrack.readyState);
      setError(
        `Video track is ${videoTrack.readyState}. Please refresh and try again.`,
      );
      hasStartedInterviewRef.current = false;
      return;
    }

    if (!stream.active) {
      console.error("❌ Stream not active!");
      setError("Camera stream is not active. Please refresh and try again.");
      hasStartedInterviewRef.current = false;
      return;
    }

    console.log("✅ ALL VERIFICATIONS PASSED:", {
      streamActive: stream.active,
      trackState: videoTrack.readyState,
      trackEnabled: videoTrack.enabled,
      sessionId: sessionData.interviewId,
    });

    setError(null);

    // ✅ Start immediately
    try {
      onInterviewReady({
        ...sessionData,
        cameraStream: stream,
      });
    } catch (err) {
      console.error("❌ Error starting interview:", err);
      alert("Failed to start interview: " + err.message);
      hasStartedInterviewRef.current = false;
    }
  };

  // ✅ Watch for questions ready - but use ref for stream
  useEffect(() => {
    if (questionsReady && !isGeneratingQuestions) {
      tryStartInterview();
    }
  }, [questionsReady, isGeneratingQuestions]);

  // ✅ Cleanup on unmount
  useEffect(() => {
    return () => {
      // Only stop if we haven't started the interview yet
      if (!hasStartedInterviewRef.current && cameraStreamRef.current) {
        console.log("🛑 Stopping camera (interview never started)");
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      } else if (hasStartedInterviewRef.current) {
      }

      cameraStreamRef.current = null;
      hasStartedInterviewRef.current = false;
    };
  }, []);

  return (
    <>
      <Card className="p-6 sm:p-8">
        {!hasExistingSkills ? (
          <div className="mb-10">
            <SkillsSelector
              selectedSkills={skills || []}
              onSkillsChange={(newSkills) =>
                setValue("skills", newSkills, { shouldValidate: true })
              }
            />
          </div>
        ) : (
          <div className="mb-10">
            <Card variant="default" padding="lg" className="w-full">
              <div className="text-center space-y-3">
                <div className="flex items-center justify-center gap-2 text-green-500">
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="font-semibold">
                    Skills Already Configured
                  </span>
                </div>
                <p className="text-sm text-white/70">
                  Your skills are on file. You can proceed directly to the
                  interview.
                </p>
                <div className="flex flex-wrap gap-2 justify-center mt-4 p-3 bg-white/5 rounded-lg border border-white/10 max-w-2xl mx-auto">
                  {user.skill.split(",").map((skill, idx) => (
                    <div
                      key={idx}
                      className="inline-flex items-center px-3 py-1.5 bg-purpleGlow/20 border border-purpleGlow rounded-lg text-purpleGlow text-xs font-medium"
                    >
                      {skill.trim()}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)}>
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm text-center">{error}</p>
            </div>
          )}

          <div className="flex justify-center">
            <Button
              type="submit"
              disabled={
                (!hasExistingSkills && (!skills || skills.length === 0)) ||
                status === "loading"
              }
              className="px-10"
            >
              {status === "loading" ? "Starting Setup..." : "Start Interview"}
            </Button>
          </div>
        </form>
      </Card>

      <Modal
        isOpen={openGuideLines}
        onClose={() => setOpenGuideLines(false)}
        title="AI Interview Guidelines"
        size="xl"
      >
        <Guidlines
          onClick={() => {
            setOpenGuideLines(false);
            setIsMicOpen(true);
          }}
        />
      </Modal>

      <MicrophoneCheck
        isOpen={isMicOpen}
        onClose={() => setIsMicOpen(false)}
        onSuccess={() => {
          setIsMicOpen(false);
          setIsCameraOpen(true);
        }}
      />

      <CameraCheck
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onSuccess={handleCameraSuccess}
      />
    </>
  );
};

export default InterviewSettings;

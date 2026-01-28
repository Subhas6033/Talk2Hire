import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  ResumeUploadCard,
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
    defaultValues: { resume: null },
  });

  const resume = watch("resume");

  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [openGuideLines, setOpenGuideLines] = useState(false);
  const [isMicOpen, setIsMicOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const [sessionData, setSessionData] = useState(null);

  const onSubmit = async () => {
    if (!resume || !user?.id) return;

    try {
      setStatus("loading");
      setError(null);

      const res = await dispatch(startInterview({ resume })).unwrap();

      if (!res?.sessionId) {
        throw new Error("Session ID not returned from server");
      }

      setSessionData({
        interviewId: res.sessionId,
        userId: user?.id,
      });

      setOpenGuideLines(true);
      setStatus("succeeded");
    } catch (err) {
      setError(err?.message || "Failed to start interview");
      setStatus("failed");
    }
  };

  return (
    <>
      <Card className="p-6 sm:p-8">
        <div className="mb-10">
          <ResumeUploadCard
            resume={resume}
            onFileChange={(file) =>
              setValue("resume", file, { shouldValidate: true })
            }
          />
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          {error && <p className="text-red-500 text-center mb-4">{error}</p>}

          <div className="flex justify-center">
            <Button
              type="submit"
              disabled={!resume || status === "loading"}
              className="px-10"
            >
              {status === "loading"
                ? "Setting Interview..."
                : "Start Interview"}
            </Button>
          </div>
        </form>
      </Card>

      {/* Guidelines */}
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

      {/* Mic */}
      <MicrophoneCheck
        isOpen={isMicOpen}
        onClose={() => setIsMicOpen(false)}
        onSuccess={() => {
          setIsMicOpen(false);
          setIsCameraOpen(true);
        }}
      />

      {/* Camera */}
      <CameraCheck
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onSuccess={() => {
          setIsCameraOpen(false);
          if (sessionData) {
            onInterviewReady(sessionData);
          }
        }}
      />
    </>
  );
};

export default InterviewSettings;

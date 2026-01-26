import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import {
  Select,
  ResumeUploadCard,
  Button,
  Guidlines,
  Modal,
  MicrophoneCheck,
  CameraCheck,
} from "../index";
import { Card } from "../Common/Card";
import {
  jobDomainOptions,
  categoryMap,
  jobDifficulty as jobDifficultyOptions,
  experienceLevel,
} from "../../Data/InterviewQuestions";
import useInterview from "../../Hooks/useInterviewHook";

const InterviewSettings = ({ onInterviewReady }) => {
  const {
    control,
    watch,
    setValue,
    handleSubmit,
    formState: { isValid },
  } = useForm({
    mode: "onChange",
    defaultValues: {
      domain: "",
      role: "",
      experience: "",
      difficulty: "",
      resume: null,
    },
  });

  const { loadQuestions, status, error } = useInterview();
  const [openGuideLines, setOpenGuideLines] = useState(false);
  const [isMicOpen, setIsMicOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const domain = watch("domain");
  const role = watch("role");
  const experience = watch("experience");
  const resume = watch("resume");

  const roleOptions = domain ? categoryMap[domain] : [];

  const onSubmit = async (formData) => {
    const res = await loadQuestions(formData);

    if (res.meta.requestStatus === "fulfilled") {
      setOpenGuideLines(true);
    }
  };

  // Reset the fields
  useEffect(() => {
    setValue("role", "");
    setValue("experience", "");
    setValue("difficulty", "");
  }, [domain, setValue]);

  useEffect(() => {
    setValue("experience", "");
    setValue("difficulty", "");
  }, [role, setValue]);

  useEffect(() => {
    setValue("difficulty", "");
  }, [experience, setValue]);

  return (
    <>
      <Card className="p-6 sm:p-8">
        {/* Resume Upload */}
        <div className="mb-10">
          <ResumeUploadCard
            resume={resume}
            onFileChange={(file) =>
              setValue("resume", file, { shouldValidate: true })
            }
          />
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Controller
              name="domain"
              control={control}
              rules={{ required: true }}
              render={({ field }) => (
                <Select
                  label="Job Sector"
                  {...field}
                  options={jobDomainOptions}
                  placeholder="Choose a domain"
                />
              )}
            />

            <Controller
              name="role"
              control={control}
              rules={{ required: true }}
              render={({ field }) => (
                <Select
                  label="Job Role"
                  {...field}
                  options={roleOptions}
                  placeholder={domain ? "Choose a role" : "Select domain first"}
                  disabled={!domain}
                />
              )}
            />

            <Controller
              name="experience"
              control={control}
              rules={{ required: true }}
              render={({ field }) => (
                <Select
                  label="Experience Level"
                  {...field}
                  options={experienceLevel}
                  placeholder={
                    role
                      ? "Select experience level"
                      : "Select domain & role first"
                  }
                  disabled={!domain || !role}
                />
              )}
            />

            <Controller
              name="difficulty"
              control={control}
              rules={{ required: true }}
              render={({ field }) => (
                <Select
                  label="Interview Difficulty"
                  {...field}
                  options={jobDifficultyOptions}
                  placeholder={
                    experience ? "Select difficulty" : "Select experience first"
                  }
                  disabled={!domain || !role || !experience}
                />
              )}
            />
          </div>
          {/* Show the err */}
          {error && (
            <p className="text-red-500 mt-2 text-center">
              {typeof error === "string"
                ? error
                : error.message || "Something went wrong"}
            </p>
          )}
          <div className="pt-8 flex justify-center">
            <Button
              type="submit"
              disabled={!isValid || !resume || status === "loading"}
              className="px-10 flex items-center gap-2"
            >
              {status === "loading" && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              {status === "loading"
                ? "Setting Interview..."
                : "Start the Interview"}
            </Button>
          </div>
        </form>
      </Card>

      {/* Guidelines Modal */}
      <Modal
        isOpen={openGuideLines}
        onClose={() => setOpenGuideLines(false)}
        title="AI Interview Guidelines"
        size="xl"
      >
        <Guidlines
          onClick={() => {
            setOpenGuideLines(false); //close guidelines
            setIsMicOpen(true); // open mic check
          }}
        />
      </Modal>

      {/* Mic testing components */}
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
        onSuccess={() => {
          setIsCameraOpen(false);
          onInterviewReady();
        }}
      />
    </>
  );
};

export default InterviewSettings;

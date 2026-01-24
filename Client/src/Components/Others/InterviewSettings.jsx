import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { Select, ResumeUploadCard, Button, Guidlines, Modal } from "../index";
import { Card } from "../Common/Card";
import {
  jobDomainOptions,
  categoryMap,
  jobDifficulty as jobDifficultyOptions,
  experienceLevel,
} from "../../Data/InterviewQuestions";
import useFileResponse from "../../Hooks/useFileResponseHook";

const InterviewSettings = () => {
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
  // Hooks
  const { startInterview, loading, error, data } = useFileResponse();

  const [openGuideLines, setOpenGuideLines] = useState(false);
  const domain = watch("domain");
  const role = watch("role");
  const experience = watch("experience");
  const resume = watch("resume");

  const roleOptions = domain ? categoryMap[domain] : [];

  const onSubmit = async (formData) => {
    const res = await startInterview(formData);

    if (res.meta.requestStatus === "fulfilled") {
      setOpenGuideLines(true);
    }
  };

  // Reset dependent fields
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
          {/* Select Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Job Sector */}
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

            {/* Job Role */}
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

            {/* Experience Level */}
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

            {/* Difficulty */}
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

          <div className="pt-8 flex justify-center">
            <Button
              type="submit"
              disabled={!isValid || !resume || loading}
              className="px-10 flex items-center gap-2"
            >
              {loading && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}

              {loading ? "Setting Interview..." : "Start the Interview"}
            </Button>
          </div>
        </form>
      </Card>

      {/* Show the guidelines modal  after successfull form submission */}
      <div>
        <Modal
          isOpen={openGuideLines}
          onClose={() => setOpenGuideLines(false)}
          title="AI Interview Guidelines"
          size="xl"
        >
          <Guidlines />
        </Modal>
      </div>
    </>
  );
};

export default InterviewSettings;

import { InterviewSettings } from "../Components/index";

const Interview = () => {
  return (
    <section className="w-full px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-7xl mx-auto space-y-10">
        {/* Page Header */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl sm:text-4xl font-semibold">
            Interview Preparation
          </h1>
          <p className="text-textMuted max-w-2xl mx-auto">
            Upload your resume and configure your interview preferences to get
            personalized interview questions.
          </p>
        </div>

        {/* Interview Settings */}
        <div>
          <InterviewSettings />
        </div>
      </div>
    </section>
  );
};

export default Interview;

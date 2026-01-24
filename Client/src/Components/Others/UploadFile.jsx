import { useEffect, useState } from "react";
import { Card, CardHeader, CardBody } from "../Common/Card";

const ResumeUploadCard = ({ resume, onFileChange }) => {
  const [fileUrl, setFileUrl] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | success | error
  const [message, setMessage] = useState("");

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];

    if (!file) {
      setStatus("error");
      setMessage("No file selected.");
      return;
    }

    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!allowedTypes.includes(file.type)) {
      setStatus("error");
      setMessage("Only PDF, DOC, or DOCX files are allowed.");
      return;
    }

    try {
      onFileChange(file);
      setStatus("success");
      setMessage("Resume uploaded successfully.");
    } catch {
      setStatus("error");
      setMessage("Failed to upload resume.");
    }
  };

  useEffect(() => {
    if (!resume) return;

    const url = URL.createObjectURL(resume);
    setFileUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [resume]);

  return (
    <Card variant="default" padding="lg" className="w-full mb-5">
      <CardHeader headerClass="text-center">Resume Upload</CardHeader>

      <CardBody>
        <label className="block border-2 border-dashed border-blue-600 rounded-xl p-6 text-center cursor-pointer hover:border-purpleGlow transition">
          <input
            type="file"
            accept=".pdf,.doc,.docx"
            className="hidden"
            onChange={handleFileUpload}
          />

          {!resume && (
            <div className="flex flex-col items-center gap-2 text-white/70">
              <span className="font-semibold text-white">
                Upload Your Resume
              </span>
              <span className="text-xs text-white/40">PDF, DOC, DOCX</span>
            </div>
          )}

          {resume && (
            <div className="flex flex-col gap-2 items-center">
              <p className="text-xs text-purpleGlow truncate max-w-xs">
                {resume.name}
              </p>

              {fileUrl && (
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs underline text-blue-400 hover:text-blue-300"
                >
                  View Resume
                </a>
              )}
            </div>
          )}
        </label>

        {/* Status Message */}
        {status !== "idle" && (
          <p
            className={`mt-3 text-xs text-center ${
              status === "success" ? "text-green-400" : "text-red-400"
            }`}
          >
            {message}
          </p>
        )}
      </CardBody>
    </Card>
  );
};

export default ResumeUploadCard;

import { useEffect, useState } from "react";
import { Card, CardHeader, CardBody } from "../Common/Card";
import { Button, Modal } from "../index";

export default function ResumeUploadCard({ resume, onFileSelect }) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    onFileSelect(file);
  };

  useEffect(() => {
    if (!resume) return;

    const url = URL.createObjectURL(resume);
    setPreviewUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [resume]);

  return (
    <>
      <Card variant="default" padding="lg" className="w-full">
        <CardHeader>Resume Upload</CardHeader>

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
              <div className="flex flex-col gap-3 items-center">
                <p className="text-xs text-purpleGlow">{resume.name}</p>

                {resume.type === "application/pdf" ? (
                  <div
                    className="w-1/2 h-40 border border-white/10 rounded-lg overflow-hidden cursor-pointer"
                    onClick={() => setIsPreviewOpen(true)}
                  >
                    <iframe
                      src={previewUrl}
                      className="w-full h-full pointer-events-none"
                      title="Resume Preview"
                    />
                  </div>
                ) : (
                  <div className="w-1/2 h-40 flex items-center justify-center border border-white/10 rounded-lg text-white/60 text-sm">
                    DOC / DOCX Preview Not Available
                  </div>
                )}
              </div>
            )}
          </label>
        </CardBody>
      </Card>

      {resume?.type === "application/pdf" && (
        <Modal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          title="Resume Preview"
          size="full"
        >
          <iframe
            src={previewUrl}
            className="w-full h-[80vh] rounded-xl border border-white/10"
            title="Full Resume"
          />
        </Modal>
      )}
    </>
  );
}

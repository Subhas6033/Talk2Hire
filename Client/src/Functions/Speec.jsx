export const handleFileUpload = (e) => {
  const file = e.target.files[0];
  if (file) setResume(file);
};

import { useRef, useState, useCallback, useEffect } from "react";
import axios from "axios";

const CHUNK_DURATION = 10000; // Send video chunks every 10 seconds
const baseURL = import.meta.env.VITE_BACKEND_URL;

const useVideoRecording = (interviewId, userId, cameraStream) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState([]);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const uploadIntervalRef = useRef(null);
  const isUploadingRef = useRef(false);

  // Start recording
  const startRecording = useCallback(() => {
    if (!cameraStream || isRecording) {
      console.log("⚠️ Cannot start recording:", {
        hasStream: !!cameraStream,
        isRecording,
      });
      return;
    }

    try {
      console.log("🎥 Starting video recording...");

      const mediaRecorder = new MediaRecorder(cameraStream, {
        mimeType: "video/webm;codecs=vp9",
        videoBitsPerSecond: 2500000,
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          console.log("📦 Video chunk available:", event.data.size, "bytes");
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        console.log("🛑 MediaRecorder stopped");
      };

      mediaRecorder.onerror = (event) => {
        console.error("❌ MediaRecorder error:", event.error);
      };

      mediaRecorder.start(CHUNK_DURATION);
      setIsRecording(true);

      // ✅ FIX: Set up periodic upload with better error handling
      uploadIntervalRef.current = setInterval(() => {
        if (!isUploadingRef.current) {
          uploadChunks();
        } else {
          console.log("⏳ Previous upload still in progress, skipping...");
        }
      }, CHUNK_DURATION);

      console.log("✅ Video recording started");
    } catch (error) {
      console.error("❌ Failed to start video recording:", error);
    }
  }, [cameraStream, isRecording, interviewId, userId]);

  // ✅ FIX: Upload chunks with better error handling and retry
  const uploadChunks = useCallback(async () => {
    if (chunksRef.current.length === 0) {
      console.log("⏭️ No chunks to upload");
      return;
    }

    if (isUploadingRef.current) {
      console.log("⏳ Upload already in progress");
      return;
    }

    isUploadingRef.current = true;

    try {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      console.log("📤 Uploading video chunk:", blob.size, "bytes");

      const formData = new FormData();
      formData.append(
        "video",
        blob,
        `interview_${interviewId}_${Date.now()}.webm`,
      );
      formData.append("interviewId", interviewId);
      formData.append("userId", userId);
      formData.append("timestamp", new Date().toISOString());
      formData.append("chunkNumber", Math.floor(Date.now() / CHUNK_DURATION));
      formData.append("videoType", "primary_camera");

      // ✅ FIX: Add timeout and retry logic
      const response = await axios.post(
        `${baseURL}/api/v1/interview/upload-video-chunk`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          withCredentials: true,
          timeout: 60000, // 60 second timeout
        },
      );

      console.log("✅ Video chunk uploaded successfully:", response.data);

      // Clear uploaded chunks
      chunksRef.current = [];

      // Restart recording for next chunk
      if (mediaRecorderRef.current && isRecording) {
        if (mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
        setTimeout(() => {
          if (mediaRecorderRef.current && isRecording) {
            try {
              mediaRecorderRef.current.start(CHUNK_DURATION);
              console.log("🔄 Recording restarted for next chunk");
            } catch (error) {
              console.error("❌ Failed to restart recording:", error);
            }
          }
        }, 100);
      }
    } catch (error) {
      console.error("❌ Failed to upload video chunk:", error);

      // ✅ FIX: Retry logic for failed uploads
      if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
        console.log("⏳ Upload timeout, will retry on next interval");
        // Keep chunks for retry
      } else {
        console.error("❌ Upload failed permanently:", error.message);
        // Keep chunks for retry
      }
    } finally {
      isUploadingRef.current = false;
    }
  }, [interviewId, userId, isRecording]);

  // ✅ FIX: Stop recording and upload final chunk
  const stopRecording = useCallback(async () => {
    if (!isRecording || !mediaRecorderRef.current) {
      console.log("⚠️ No active recording to stop");
      return null;
    }

    console.log("🛑 Stopping video recording...");

    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current;

      // Stop the upload interval
      if (uploadIntervalRef.current) {
        clearInterval(uploadIntervalRef.current);
        uploadIntervalRef.current = null;
      }

      mediaRecorder.onstop = async () => {
        console.log("📦 Creating final video blob...");

        // Upload any remaining chunks
        if (chunksRef.current.length > 0) {
          console.log("📤 Uploading final chunks...");
          await uploadChunks();
        }

        const finalBlob = new Blob(chunksRef.current, { type: "video/webm" });

        // ✅ FIX: Upload final video with proper error handling
        try {
          const formData = new FormData();
          formData.append(
            "video",
            finalBlob,
            `interview_${interviewId}_final.webm`,
          );
          formData.append("interviewId", interviewId);
          formData.append("userId", userId);
          formData.append("timestamp", new Date().toISOString());
          formData.append("isFinal", "true");
          formData.append("videoType", "primary_camera");

          const response = await axios.post(
            `${baseURL}/api/v1/interview/upload-video-final`,
            formData,
            {
              headers: {
                "Content-Type": "multipart/form-data",
              },
              withCredentials: true,
              timeout: 120000, // 2 minute timeout for final upload
            },
          );

          console.log("✅ Final video uploaded successfully:", response.data);
        } catch (error) {
          console.error("❌ Failed to upload final video:", error);
          // Don't throw - let interview continue even if final upload fails
        }

        setIsRecording(false);
        chunksRef.current = [];
        resolve(finalBlob);
      };

      // Stop recording
      if (mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
      } else {
        // Already stopped
        mediaRecorder.onstop();
      }
    });
  }, [isRecording, interviewId, userId, uploadChunks]);

  // ✅ FIX: Cleanup on unmount
  const cleanup = useCallback(() => {
    console.log("🧹 Cleaning up video recording...");

    if (uploadIntervalRef.current) {
      clearInterval(uploadIntervalRef.current);
    }

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }

    isUploadingRef.current = false;
  }, []);

  // Auto-cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    isRecording,
    recordedChunks,
    startRecording,
    stopRecording,
    cleanup,
  };
};

export default useVideoRecording;

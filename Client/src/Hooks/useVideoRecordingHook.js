import { useRef, useState, useCallback } from "react";
import axios from "axios";

const CHUNK_DURATION = 10000; // Send video chunks every 10 seconds
const baseURL = import.meta.env.VITE_BACKEND_URL;

const useVideoRecording = (interviewId, userId, cameraStream) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState([]);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const uploadIntervalRef = useRef(null);

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

      // Create MediaRecorder with the camera stream
      const mediaRecorder = new MediaRecorder(cameraStream, {
        mimeType: "video/webm;codecs=vp9", // High quality codec
        videoBitsPerSecond: 2500000, // 2.5 Mbps
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      // Handle data available event
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          console.log("📦 Video chunk available:", event.data.size, "bytes");
          chunksRef.current.push(event.data);
        }
      };

      // Handle recording stop
      mediaRecorder.onstop = () => {
        console.log("🛑 MediaRecorder stopped");
      };

      // Handle errors
      mediaRecorder.onerror = (event) => {
        console.error("❌ MediaRecorder error:", event.error);
      };

      // Start recording
      mediaRecorder.start(CHUNK_DURATION); // Collect data every 10 seconds
      setIsRecording(true);

      // Set up periodic upload
      uploadIntervalRef.current = setInterval(() => {
        uploadChunks();
      }, CHUNK_DURATION);

      console.log("✅ Video recording started");
    } catch (error) {
      console.error("❌ Failed to start video recording:", error);
    }
  }, [cameraStream, isRecording, interviewId, userId]);

  // Upload chunks to server
  const uploadChunks = useCallback(async () => {
    if (chunksRef.current.length === 0) {
      console.log("⏭️ No chunks to upload");
      return;
    }

    try {
      // Create a blob from accumulated chunks
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      console.log("📤 Uploading video chunk:", blob.size, "bytes");

      // Create FormData
      const formData = new FormData();
      formData.append(
        "video",
        blob,
        `interview_${interviewId}_${Date.now()}.webm`
      );
      formData.append("interviewId", interviewId);
      formData.append("userId", userId);
      formData.append("timestamp", new Date().toISOString());
      formData.append("chunkNumber", Math.floor(Date.now() / CHUNK_DURATION));

      // Upload to server
      const response = await axios.post(
        `${baseURL}/api/v1/interview/upload-video-chunk`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          withCredentials: true,
        }
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
            mediaRecorderRef.current.start(CHUNK_DURATION);
          }
        }, 100);
      }
    } catch (error) {
      console.error("❌ Failed to upload video chunk:", error);
      // Keep chunks for retry
    }
  }, [interviewId, userId, isRecording]);

  // Stop recording and upload final chunk
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

      // Handle final stop
      mediaRecorder.onstop = async () => {
        console.log("📦 Creating final video blob...");

        // Upload any remaining chunks
        if (chunksRef.current.length > 0) {
          await uploadChunks();
        }

        // Create final blob
        const finalBlob = new Blob(chunksRef.current, { type: "video/webm" });

        // Upload final video
        try {
          const formData = new FormData();
          formData.append(
            "video",
            finalBlob,
            `interview_${interviewId}_final.webm`
          );
          formData.append("interviewId", interviewId);
          formData.append("userId", userId);
          formData.append("timestamp", new Date().toISOString());
          formData.append("isFinal", "true");

          const response = await axios.post(
            `${baseURL}/api/v1/interview/upload-video-final`,
            formData,
            {
              headers: {
                "Content-Type": "multipart/form-data",
              },
              withCredentials: true,
            }
          );

          console.log("✅ Final video uploaded successfully:", response.data);
        } catch (error) {
          console.error("❌ Failed to upload final video:", error);
        }

        setIsRecording(false);
        chunksRef.current = [];
        resolve(finalBlob);
      };

      // Stop recording
      if (mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
      }
    });
  }, [isRecording, interviewId, userId, uploadChunks]);

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    if (uploadIntervalRef.current) {
      clearInterval(uploadIntervalRef.current);
    }
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
  }, []);

  return {
    isRecording,
    recordedChunks,
    startRecording,
    stopRecording,
    cleanup,
  };
};

export default useVideoRecording;

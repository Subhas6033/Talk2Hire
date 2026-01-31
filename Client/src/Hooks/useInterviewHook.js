import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  connectSocket,
  socketConnected,
  receivePartialTranscript,
  receiveFinalAnswer,
  receiveNextQuestion,
  receiveAudioChunk,
} from "../API/interviewApi";

export const useInterviewSocket = (userId) => {
  const dispatch = useDispatch();
  const { sessionId, status } = useSelector((state) => state.interview);

  useEffect(() => {
    if (!sessionId || !userId) return; // exit early if sessionId/userId missing

    const ws = new WebSocket(
      `${import.meta.env.VITE_WS_URL}?interviewId=${sessionId}&userId=${userId}`
    );

    ws.onopen = () => dispatch(socketConnected());

    ws.onmessage = (event) => {
      if (typeof event.data === "string") {
        const data = JSON.parse(event.data);

        if (data.type === "partial")
          dispatch(receivePartialTranscript(data.text));

        if (data.type === "next_question") dispatch(receiveNextQuestion(data));

        if (data.type === "final_answer")
          dispatch(receiveFinalAnswer(data.answer));
      } else {
        dispatch(receiveAudioChunk(event.data));
      }
    };

    dispatch(connectSocket(ws));

    return () => ws.close();
  }, [sessionId, userId, dispatch]);

  return { sessionId, status };
};

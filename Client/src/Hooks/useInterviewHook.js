import { useDispatch, useSelector } from "react-redux";
import {
  fetchInterviewQuestions,
  nextQuestion,
  resetInterview,
} from "../API/interviewApi";

const useInterview = () => {
  const dispatch = useDispatch();
  const interview = useSelector((state) => state.interview);

  const loadQuestions = (formData) => {
    // returns the actions
    return dispatch(fetchInterviewQuestions(formData));
  };

  const goNext = () => {
    dispatch(nextQuestion());
  };
  console.log(interview.status);
  return {
    questions: interview.questions,
    currentQuestion: interview.questions[interview.currentIndex],
    currentIndex: interview.currentIndex,
    isLastQuestion: interview.currentIndex === interview.questions.length - 1,
    // TODO: Problem with this status
    status: interview.status || "",
    duration: interview.duration,
    error: interview.error,
    loadQuestions,
    goNext,
    resetInterview: () => dispatch(resetInterview()),
  };
};

export default useInterview;

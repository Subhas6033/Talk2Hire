import { useDispatch, useSelector } from "react-redux";
import { startInterview, resetInterviewState } from "../API/processFileApi";

/**
 * Custom hook to start interview with resume upload
 */
const useFileResponse = () => {
  const dispatch = useDispatch();

  const { loading, error, data } = useSelector((state) => state.interview);

  const start = async (formValues) => {
    return dispatch(startInterview(formValues));
  };

  const reset = () => {
    dispatch(resetInterviewState());
  };

  return {
    startInterview: start,
    loading,
    error,
    data,
    reset,
  };
};

export default useFileResponse;

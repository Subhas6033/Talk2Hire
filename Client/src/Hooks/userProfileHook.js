import { useDispatch, useSelector } from "react-redux";
import {
  fetchProfileStats,
  updateProfileFiles,
  fetchUserInterviews,
  clearProfileError,
  patchProfile,
} from "../API/userProfileApi";

export const useProfile = () => {
  const dispatch = useDispatch();
  const {
    data,
    loading,
    updating,
    error,
    updateError,
    interviews,
    interviewsPagination,
    interviewsLoading,
    interviewsError,
  } = useSelector((state) => state.profile);

  return {
    profile: data,
    loading,
    updating,
    error,
    updateError,
    interviews,
    interviewsPagination,
    interviewsLoading,
    interviewsError,
    loadProfile: () => dispatch(fetchProfileStats()),
    uploadFiles: (formData) => dispatch(updateProfileFiles(formData)),
    loadInterviews: (params) => dispatch(fetchUserInterviews(params)),
    patchLocal: (fields) => dispatch(patchProfile(fields)),
    clearError: () => dispatch(clearProfileError()),
  };
};

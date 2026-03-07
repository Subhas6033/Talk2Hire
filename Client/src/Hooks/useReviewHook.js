import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { submitUserReview, resetReviewState } from "../API/userReviewApi";

const useReview = () => {
  const dispatch = useDispatch();
  const { loading, success, error, review } = useSelector(
    (state) => state.review,
  );

  /* Auto-reset after 5 s so the success banner doesn't stay forever */
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => dispatch(resetReviewState()), 5000);
      return () => clearTimeout(t);
    }
  }, [success, dispatch]);

  const submitReview = (formData) => {
    dispatch(submitUserReview(formData));
  };

  const reset = () => dispatch(resetReviewState());

  return { submitReview, loading, success, error, review, reset };
};

export default useReview;

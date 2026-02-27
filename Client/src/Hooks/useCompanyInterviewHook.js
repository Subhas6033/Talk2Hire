import { useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchInterviews,
  fetchInterviewById,
  fetchViolations,
  hireCandidate,
  rejectCandidate,
  setFilterStatus,
  setFilterJobId,
  setSearch,
  clearSelectedInterview,
  resetFilters,
  selectFilteredInterviews,
  selectCounts,
  selectJobs,
  selectFilters,
  selectSelectedInterview,
  selectListStatus,
  selectDetailStatus,
  selectDecisionStatus,
  selectDecisionError,
  selectViolations,
  selectViolationsStatus,
  selectViolationsError,
} from "../API/companyInterviewApi";

export const useCompanyInterviews = () => {
  const dispatch = useDispatch();

  const interviews = useSelector(selectFilteredInterviews);
  const counts = useSelector(selectCounts);
  const jobs = useSelector(selectJobs);
  const filters = useSelector(selectFilters);
  const selectedInterview = useSelector(selectSelectedInterview);
  const listStatus = useSelector(selectListStatus);
  const detailStatus = useSelector(selectDetailStatus);
  const decisionStatus = useSelector(selectDecisionStatus);
  const decisionError = useSelector(selectDecisionError);
  const violationsStatus = useSelector(selectViolationsStatus);
  const violationsError = useSelector(selectViolationsError);

  // Violations for the currently open interview (null = not yet fetched)
  const violations = useSelector(
    selectViolations(selectedInterview?.id ?? null),
  );

  useEffect(() => {
    dispatch(fetchInterviews());
  }, [dispatch]);

  const loadInterviews = useCallback(
    (params = {}) => dispatch(fetchInterviews(params)),
    [dispatch],
  );

  const openInterview = useCallback(
    async (id) => {
      await dispatch(fetchInterviewById(id));
    },
    [dispatch],
  );

  // Fetch violations for the open interview (called when user opens Violations tab)
  const loadViolations = useCallback(
    (interviewId) => dispatch(fetchViolations(interviewId)),
    [dispatch],
  );

  const closeInterview = useCallback(() => {
    dispatch(clearSelectedInterview());
  }, [dispatch]);

  const hire = useCallback(
    async (id) => {
      const result = await dispatch(hireCandidate(id));
      return !result.error;
    },
    [dispatch],
  );

  const reject = useCallback(
    async (id) => {
      const result = await dispatch(rejectCandidate(id));
      return !result.error;
    },
    [dispatch],
  );

  const changeStatus = useCallback(
    (status) => dispatch(setFilterStatus(status)),
    [dispatch],
  );

  const changeJob = useCallback(
    (jobId) => dispatch(setFilterJobId(jobId)),
    [dispatch],
  );

  const changeSearch = useCallback(
    (term) => dispatch(setSearch(term)),
    [dispatch],
  );

  const clearFilters = useCallback(() => dispatch(resetFilters()), [dispatch]);

  return {
    interviews,
    counts,
    jobs,
    selectedInterview,

    ...filters,
    changeStatus,
    changeJob,
    changeSearch,
    clearFilters,

    loadInterviews,
    openInterview,
    closeInterview,
    hire,
    reject,

    // violations
    violations,
    loadViolations,
    isLoadingViolations: violationsStatus === "loading",
    violationsError,

    isLoadingList: listStatus === "loading",
    isLoadingDetail: detailStatus === "loading",
    isDeciding: decisionStatus === "loading",
    listFailed: listStatus === "failed",
    decisionError,
  };
};

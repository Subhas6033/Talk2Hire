// hooks/useCompanyInterviews.js
// Custom hook for the company interview dashboard.
// Wraps Redux dispatch + selector logic so the page stays clean.

import { useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchInterviews,
  fetchInterviewById,
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
} from "../API/companyInterviewApi";

export const useCompanyInterviews = () => {
  const dispatch = useDispatch();

  /* ── Selectors ─────────────────────────────────────────────────────────── */
  const interviews = useSelector(selectFilteredInterviews);
  const counts = useSelector(selectCounts);
  const jobs = useSelector(selectJobs);
  const filters = useSelector(selectFilters);
  const selectedInterview = useSelector(selectSelectedInterview);
  const listStatus = useSelector(selectListStatus);
  const detailStatus = useSelector(selectDetailStatus);
  const decisionStatus = useSelector(selectDecisionStatus);
  const decisionError = useSelector(selectDecisionError);

  /* ── Initial fetch ─────────────────────────────────────────────────────── */
  useEffect(() => {
    dispatch(fetchInterviews());
  }, [dispatch]);

  /* ── Actions ───────────────────────────────────────────────────────────── */
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
    (status) => {
      dispatch(setFilterStatus(status));
    },
    [dispatch],
  );

  const changeJob = useCallback(
    (jobId) => {
      dispatch(setFilterJobId(jobId));
    },
    [dispatch],
  );

  const changeSearch = useCallback(
    (term) => {
      dispatch(setSearch(term));
    },
    [dispatch],
  );

  const clearFilters = useCallback(() => {
    dispatch(resetFilters());
  }, [dispatch]);

  /* ── Derived booleans ──────────────────────────────────────────────────── */
  const isLoadingList = listStatus === "loading";
  const isLoadingDetail = detailStatus === "loading";
  const isDeciding = decisionStatus === "loading";
  const listFailed = listStatus === "failed";

  return {
    // data
    interviews,
    counts,
    jobs,
    selectedInterview,

    // filters
    ...filters,
    changeStatus,
    changeJob,
    changeSearch,
    clearFilters,

    // actions
    loadInterviews,
    openInterview,
    closeInterview,
    hire,
    reject,

    // status
    isLoadingList,
    isLoadingDetail,
    isDeciding,
    listFailed,
    decisionError,
  };
};

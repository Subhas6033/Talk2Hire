// hooks/useDashboard.js
import { useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchDashboard,
  fetchDashboardStats,
  fetchPipeline,
  fetchRecentJobs,
  fetchRecentInterviews,
  clearDashboardError,
} from "../API/companyDashboardApi";

const STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes

const useDashboard = () => {
  const dispatch = useDispatch();
  const {
    stats,
    pipeline,
    recentJobs,
    recentInterviews,
    loading,
    error,
    lastFetched,
  } = useSelector((state) => state.dashboard);

  // ── Fetch on mount (skip if data is fresh) ─────────────────
  useEffect(() => {
    const isStale = !lastFetched || Date.now() - lastFetched > STALE_THRESHOLD;
    if (isStale) {
      dispatch(fetchDashboard());
    }
  }, [dispatch, lastFetched]);

  // ── Manual refetch (e.g. pull-to-refresh) ──────────────────
  const refetch = useCallback(() => {
    dispatch(fetchDashboard());
  }, [dispatch]);

  // ── Targeted refetches ─────────────────────────────────────
  const refetchStats = useCallback(
    () => dispatch(fetchDashboardStats()),
    [dispatch],
  );
  const refetchPipeline = useCallback(
    () => dispatch(fetchPipeline()),
    [dispatch],
  );
  const refetchJobs = useCallback(
    () => dispatch(fetchRecentJobs()),
    [dispatch],
  );
  const refetchInterviews = useCallback(
    () => dispatch(fetchRecentInterviews()),
    [dispatch],
  );

  // ── Derived stat card data (matches STATS array shape in UI) ─
  const statCards = [
    {
      label: "Active Jobs",
      value: String(stats.activeJobs ?? 0),
      change: `+${stats.newJobsThisMonth ?? 0} this month`,
      color: "indigo",
    },
    {
      label: "Total Applicants",
      value: String(stats.totalApplicants ?? 0),
      change: `+${stats.interviewsThisWeek ?? 0} this week`,
      color: "violet",
    },
    {
      label: "Interviews Done",
      value: String(stats.interviewsDone ?? 0),
      change: `+${stats.interviewsThisWeek ?? 0} this week`,
      color: "blue",
    },
    {
      label: "Hired This Month",
      value: String(stats.hiredThisMonth ?? 0),
      change: `+${Math.max(0, (stats.hiredThisMonth ?? 0) - (stats.hiredLastMonth ?? 0))} vs last month`,
      color: "emerald",
    },
  ];

  // ── Derived pipeline bars (matches pipeline card shape in UI) ─
  const applied = pipeline.applied || 0;
  const pipelineBars = [
    {
      label: "Applied",
      count: applied,
      pct: 100,
      color: "bg-indigo-400",
    },
    {
      label: "Interviewed",
      count: pipeline.interviewed ?? 0,
      pct: applied ? Math.round((pipeline.interviewed / applied) * 100) : 0,
      color: "bg-violet-400",
    },
    {
      label: "Under Review",
      count: pipeline.underReview ?? 0,
      pct: applied ? Math.round((pipeline.underReview / applied) * 100) : 0,
      color: "bg-amber-400",
    },
    {
      label: "Hired",
      count: pipeline.hired ?? 0,
      pct: applied ? Math.round((pipeline.hired / applied) * 100) : 0,
      color: "bg-emerald-400",
    },
  ];

  return {
    // Raw data
    stats,
    pipeline,
    recentJobs,
    recentInterviews,

    // Derived / shaped for UI
    statCards,
    pipelineBars,

    // Loading flags
    isLoading: loading.dashboard,
    isLoadingStats: loading.stats,
    isLoadingPipeline: loading.pipeline,
    isLoadingJobs: loading.recentJobs,
    isLoadingInterviews: loading.recentInterviews,

    // Actions
    error,
    refetch,
    refetchStats,
    refetchPipeline,
    refetchJobs,
    refetchInterviews,
    clearError: () => dispatch(clearDashboardError()),
  };
};

export default useDashboard;

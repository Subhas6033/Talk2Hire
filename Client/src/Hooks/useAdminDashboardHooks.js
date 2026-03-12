import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchAdminDashboard } from "../API/adminDashboardApi";

export const useAdminDashboard = () => {
  const dispatch = useDispatch();
  const {
    stats,
    weeklyScreenings,
    planBreakdown,
    recentActivity,
    activityFeed,
    loading,
    error,
  } = useSelector((state) => state.adminDashboard);

  useEffect(() => {
    dispatch(fetchAdminDashboard());
  }, [dispatch]);

  return {
    stats,
    weeklyScreenings,
    planBreakdown,
    recentActivity,
    activityFeed,
    loading,
    error,
  };
};

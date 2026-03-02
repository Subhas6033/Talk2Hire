import { useEffect, useCallback, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchMyApplications,
  updateAppStatus,
  toggleAppStar,
  deleteApp,
  updateAppNotes,
  clearAppError,
} from "../API/ApplicationApi";

export const useApplications = () => {
  const dispatch = useDispatch();
  const { applications, loading, error, mutatingId } = useSelector(
    (state) => state.applications,
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date");

  useEffect(() => {
    dispatch(fetchMyApplications());
  }, [dispatch]);

  const handleUpdateStatus = useCallback(
    (id, status) => dispatch(updateAppStatus({ id, status })),
    [dispatch],
  );

  const handleToggleStar = useCallback(
    (id) => dispatch(toggleAppStar(id)),
    [dispatch],
  );

  const handleDelete = useCallback((id) => dispatch(deleteApp(id)), [dispatch]);

  const handleUpdateNotes = useCallback(
    (id, notes) => dispatch(updateAppNotes({ id, notes })),
    [dispatch],
  );

  const handleClearError = useCallback(
    () => dispatch(clearAppError()),
    [dispatch],
  );

  // Derived: filter + search + sort
  const filtered = applications
    .filter((a) => activeFilter === "all" || a.status === activeFilter)
    .filter(
      (a) =>
        !searchQuery ||
        [
          a.company,
          a.role,
          a.location,
          ...(a.skills ? JSON.parse(a.skills) : []),
        ]
          .filter(Boolean)
          .some((v) => v.toLowerCase().includes(searchQuery.toLowerCase())),
    )
    .sort((a, b) => {
      if (sortBy === "starred")
        return (b.starred ? 1 : 0) - (a.starred ? 1 : 0);
      if (sortBy === "company") return a.company.localeCompare(b.company);
      return new Date(b.appliedAt) - new Date(a.appliedAt); // date desc
    });

  // Counts per status
  const counts = [
    "applied",
    "screening",
    "interviewing",
    "offer",
    "rejected",
  ].reduce((acc, key) => {
    acc[key] = applications.filter((a) => a.status === key).length;
    return acc;
  }, {});

  return {
    // data
    applications: filtered,
    allApplications: applications,
    counts,
    total: applications.length,
    // state
    isFetching: loading.fetch,
    error,
    mutatingId,
    // filters
    searchQuery,
    setSearchQuery,
    activeFilter,
    setActiveFilter,
    sortBy,
    setSortBy,
    // actions
    updateStatus: handleUpdateStatus,
    toggleStar: handleToggleStar,
    deleteApplication: handleDelete,
    updateNotes: handleUpdateNotes,
    clearError: handleClearError,
  };
};

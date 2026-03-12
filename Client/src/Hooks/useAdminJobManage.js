import { useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchJobs,
  updateJobStatus,
  deleteJob,
  setFilters,
  setPage,
  clearError,
} from "../API/AdminJobManageApi";

export const useAdminJobs = () => {
  const dispatch = useDispatch();
  const { jobs, pagination, loading, actionLoading, error, filters } =
    useSelector((state) => state.adminJobs);

  const loadJobs = useCallback(() => {
    dispatch(fetchJobs(filters));
  }, [dispatch, filters]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const handleSearch = useCallback(
    (search) => dispatch(setFilters({ search, page: 1 })),
    [dispatch],
  );

  const handleStatusFilter = useCallback(
    (status) => dispatch(setFilters({ status, page: 1 })),
    [dispatch],
  );

  const handleTypeFilter = useCallback(
    (type) => dispatch(setFilters({ type, page: 1 })),
    [dispatch],
  );

  const handleSort = useCallback(
    (sortBy) =>
      dispatch(
        setFilters({
          sortBy,
          sortOrder:
            filters.sortBy === sortBy && filters.sortOrder === "desc"
              ? "asc"
              : "desc",
          page: 1,
        }),
      ),
    [dispatch, filters.sortBy, filters.sortOrder],
  );

  const handlePageChange = useCallback(
    (page) => dispatch(setPage(page)),
    [dispatch],
  );

  const handleUpdateStatus = useCallback(
    (id, status) => dispatch(updateJobStatus({ id, status })),
    [dispatch],
  );

  const handleDelete = useCallback((id) => dispatch(deleteJob(id)), [dispatch]);

  const handleClearError = useCallback(
    () => dispatch(clearError()),
    [dispatch],
  );

  return {
    jobs,
    pagination,
    loading,
    actionLoading,
    error,
    filters,
    handleSearch,
    handleStatusFilter,
    handleTypeFilter,
    handleSort,
    handlePageChange,
    handleUpdateStatus,
    handleDelete,
    handleClearError,
    reload: loadJobs,
  };
};

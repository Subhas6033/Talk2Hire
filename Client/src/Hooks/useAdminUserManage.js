import { useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchUsers,
  updateUserStatus,
  deleteUser,
  setFilters,
  setPage,
  clearError,
} from "../API/adminUserManageApi";

export const useAdminUsers = () => {
  const dispatch = useDispatch();
  const { users, pagination, loading, actionLoading, error, filters } =
    useSelector((state) => state.adminUsers);

  const loadUsers = useCallback(() => {
    dispatch(fetchUsers(filters));
  }, [dispatch, filters]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleSearch = useCallback(
    (search) => dispatch(setFilters({ search, page: 1 })),
    [dispatch],
  );

  const handleStatusFilter = useCallback(
    (status) => dispatch(setFilters({ status, page: 1 })),
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

  const handleToggleStatus = useCallback(
    (id, currentStatus) =>
      dispatch(
        updateUserStatus({ id, is_active: currentStatus === 1 ? false : true }),
      ),
    [dispatch],
  );

  const handleDelete = useCallback(
    (id) => dispatch(deleteUser(id)),
    [dispatch],
  );

  const handleClearError = useCallback(
    () => dispatch(clearError()),
    [dispatch],
  );

  return {
    users,
    pagination,
    loading,
    actionLoading,
    error,
    filters,
    handleSearch,
    handleStatusFilter,
    handleSort,
    handlePageChange,
    handleToggleStatus,
    handleDelete,
    handleClearError,
    reload: loadUsers,
  };
};

import { useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchCompanies,
  deleteCompany,
  setFilters,
  setPage,
  clearError,
} from "../API/adminCompanyManageApi";

export const useAdminCompanies = () => {
  const dispatch = useDispatch();
  const { companies, pagination, loading, actionLoading, error, filters } =
    useSelector((state) => state.adminCompanies);

  const loadCompanies = useCallback(() => {
    dispatch(fetchCompanies(filters));
  }, [dispatch, filters]);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  const handleSearch = useCallback(
    (search) => dispatch(setFilters({ search, page: 1 })),
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

  const handleDelete = useCallback(
    (id) => dispatch(deleteCompany(id)),
    [dispatch],
  );

  const handleClearError = useCallback(
    () => dispatch(clearError()),
    [dispatch],
  );

  return {
    companies,
    pagination,
    loading,
    actionLoading,
    error,
    filters,
    handleSearch,
    handleSort,
    handlePageChange,
    handleDelete,
    handleClearError,
    reload: loadCompanies,
  };
};

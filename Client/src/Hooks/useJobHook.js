import { useState, useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchJobs,
  fetchPublicJobs,
  createJob,
  updateJob,
  deleteJob,
  toggleJobStatus,
  clearError,
  clearSuccess,
} from "../API/jobApi";

const useJobs = () => {
  const dispatch = useDispatch();
  const { jobs, counts, total, loading, mutatingId, error, successMessage } =
    useSelector((state) => state.jobs);

  // ── Local filter state (mirrors CompanyJob UI) ─────────────
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDept, setFilterDept] = useState("all");

  // ── Modal state ────────────────────────────────────────────
  const [modal, setModal] = useState(null); // null | "create" | job object

  // ── Fetch on filter change ─────────────────────────────────
  useEffect(() => {
    const timeout = setTimeout(() => {
      dispatch(
        fetchJobs({ status: filterStatus, department: filterDept, search }),
      );
    }, 300); // debounce search input

    return () => clearTimeout(timeout);
  }, [dispatch, search, filterStatus, filterDept]);

  // ── Auto-clear messages ────────────────────────────────────
  useEffect(() => {
    if (successMessage) {
      const t = setTimeout(() => dispatch(clearSuccess()), 3000);
      return () => clearTimeout(t);
    }
  }, [successMessage, dispatch]);

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => dispatch(clearError()), 5000);
      return () => clearTimeout(t);
    }
  }, [error, dispatch]);

  // ── Modal helpers ──────────────────────────────────────────
  const openCreate = useCallback(() => setModal("create"), []);
  const openEdit = useCallback((job) => setModal(job), []);
  const closeModal = useCallback(() => setModal(null), []);

  // ── CRUD handlers ──────────────────────────────────────────
  const handleSave = useCallback(
    async (formData) => {
      const isEdit = !!formData.id;
      const action = isEdit
        ? dispatch(updateJob({ id: formData.id, ...formData }))
        : dispatch(createJob(formData));

      const result = await action;

      // Close modal only on success
      if (!result.error) {
        closeModal();
      }

      return result;
    },
    [dispatch, closeModal],
  );

  const handleDelete = useCallback((id) => dispatch(deleteJob(id)), [dispatch]);

  const handleToggleStatus = useCallback(
    (id) => dispatch(toggleJobStatus(id)),
    [dispatch],
  );

  // ── Derived: unique departments for filter dropdown ────────
  const uniqueDepts = [...new Set(jobs.map((j) => j.department))];

  // ── Derived: client-side filtered list ────────────────────
  // (server already filters, but this keeps UI snappy during typing)
  const filtered = jobs.filter((j) => {
    const matchSearch =
      j.title.toLowerCase().includes(search.toLowerCase()) ||
      j.department.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || j.status === filterStatus;
    const matchDept = filterDept === "all" || j.department === filterDept;
    return matchSearch && matchStatus && matchDept;
  });

  // ── Per-card loading helpers ───────────────────────────────
  const isDeleting = (id) => loading.delete && mutatingId === id;
  const isToggling = (id) => loading.toggle && mutatingId === id;
  const isUpdating = (id) => loading.update && mutatingId === id;

  return {
    // Data
    jobs: filtered,
    counts,
    total,
    uniqueDepts,

    // Filter state
    search,
    setSearch,
    filterStatus,
    setFilterStatus,
    filterDept,
    setFilterDept,

    // Modal state
    modal,
    openCreate,
    openEdit,
    closeModal,

    // Actions
    handleSave,
    handleDelete,
    handleToggleStatus,

    // Loading flags
    isFetching: loading.fetch,
    isCreating: loading.create,
    isUpdating: loading.update,
    isDeleting,
    isToggling,
    isSaving: loading.create || loading.update,

    // Feedback
    error,
    successMessage,
  };
};

// ─── Public Jobs Hook (for candidate job listing page) ────────
export const usePublicJobs = () => {
  const dispatch = useDispatch();
  const { publicJobs, publicTotal, loading, error } = useSelector(
    (state) => state.jobs,
  );

  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [type, setType] = useState("");
  const [experience, setExperience] = useState("");

  const filters = { search, department, location, type, experience };

  useEffect(() => {
    const timeout = setTimeout(() => {
      dispatch(fetchPublicJobs(filters));
    }, 300);
    return () => clearTimeout(timeout);
  }, [dispatch, search, department, location, type, experience]);

  const resetFilters = useCallback(() => {
    setSearch("");
    setDepartment("");
    setLocation("");
    setType("");
    setExperience("");
  }, []);

  const hasActiveFilters = Object.values(filters).some(Boolean);

  return {
    jobs: publicJobs,
    total: publicTotal,
    isFetching: loading.fetchPublic,
    error,
    filters,
    search,
    setSearch,
    department,
    setDepartment,
    location,
    setLocation,
    type,
    setType,
    experience,
    setExperience,
    resetFilters,
    hasActiveFilters,
  };
};

export default useJobs;

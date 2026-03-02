import { useState, useEffect, useCallback, useRef } from "react";
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

// ─── Admin hook (unchanged) ───────────────────────────────────
const useJobs = () => {
  const dispatch = useDispatch();
  const { jobs, counts, total, loading, mutatingId, error, successMessage } =
    useSelector((state) => state.jobs);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDept, setFilterDept] = useState("all");
  const [modal, setModal] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => {
      dispatch(
        fetchJobs({ status: filterStatus, department: filterDept, search }),
      );
    }, 300);
    return () => clearTimeout(t);
  }, [dispatch, search, filterStatus, filterDept]);

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

  const openCreate = useCallback(() => setModal("create"), []);
  const openEdit = useCallback((job) => setModal(job), []);
  const closeModal = useCallback(() => setModal(null), []);

  const handleSave = useCallback(
    async (formData) => {
      const action = formData.id
        ? dispatch(updateJob({ id: formData.id, ...formData }))
        : dispatch(createJob(formData));
      const result = await action;
      if (!result.error) closeModal();
      return result;
    },
    [dispatch, closeModal],
  );

  const handleDelete = useCallback((id) => dispatch(deleteJob(id)), [dispatch]);
  const handleToggleStatus = useCallback(
    (id) => dispatch(toggleJobStatus(id)),
    [dispatch],
  );

  const uniqueDepts = [...new Set(jobs.map((j) => j.department))];

  const filtered = jobs.filter((j) => {
    const matchSearch =
      j.title.toLowerCase().includes(search.toLowerCase()) ||
      j.department.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || j.status === filterStatus;
    const matchDept = filterDept === "all" || j.department === filterDept;
    return matchSearch && matchStatus && matchDept;
  });

  const isDeleting = (id) => loading.delete && mutatingId === id;
  const isToggling = (id) => loading.toggle && mutatingId === id;
  const isUpdating = (id) => loading.update && mutatingId === id;

  return {
    jobs: filtered,
    counts,
    total,
    uniqueDepts,
    search,
    setSearch,
    filterStatus,
    setFilterStatus,
    filterDept,
    setFilterDept,
    modal,
    openCreate,
    openEdit,
    closeModal,
    handleSave,
    handleDelete,
    handleToggleStatus,
    isFetching: loading.fetch,
    isCreating: loading.create,
    isUpdating: loading.update,
    isDeleting,
    isToggling,
    isSaving: loading.create || loading.update,
    error,
    successMessage,
  };
};

// ─── Public Jobs Hook ─────────────────────────────────────────
export const usePublicJobs = () => {
  const dispatch = useDispatch();
  const { publicJobs, publicTotal, publicPagination, loading, error } =
    useSelector((state) => state.jobs);

  const [q, setQ] = useState("");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [type, setType] = useState("");
  const [experience, setExperience] = useState("");
  const [page, setPage] = useState(1);

  const debounceRef = useRef(null);

  // Fetch whenever any filter/page changes
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      dispatch(
        fetchPublicJobs({
          q,
          department,
          location,
          type,
          experience,
          page,
          limit: 9,
        }),
      );
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [q, department, location, type, experience, page, dispatch]);

  const resetPage = useCallback(() => setPage(1), []);

  const handleSetQ = useCallback(
    (v) => {
      setQ(v);
      resetPage();
    },
    [resetPage],
  );
  const handleSetDept = useCallback(
    (v) => {
      setDepartment(v);
      resetPage();
    },
    [resetPage],
  );
  const handleSetLoc = useCallback(
    (v) => {
      setLocation(v);
      resetPage();
    },
    [resetPage],
  );
  const handleSetType = useCallback(
    (v) => {
      setType(v);
      resetPage();
    },
    [resetPage],
  );
  const handleSetExperience = useCallback(
    (v) => {
      setExperience(v);
      resetPage();
    },
    [resetPage],
  );

  const resetFilters = useCallback(() => {
    setQ("");
    setDepartment("");
    setLocation("");
    setType("");
    setExperience("");
    setPage(1);
  }, []);

  const hasActiveFilters = !!(
    q ||
    department ||
    location ||
    type ||
    experience
  );

  return {
    jobs: publicJobs,
    total: publicTotal,
    pagination: publicPagination,
    isFetching: loading.fetchPublic,
    error,
    q,
    department,
    location,
    type,
    experience,
    page,
    setQ: handleSetQ,
    setDepartment: handleSetDept,
    setLocation: handleSetLoc,
    setType: handleSetType,
    setExperience: handleSetExperience,
    setPage,
    resetFilters,
    hasActiveFilters,
  };
};

export default useJobs;

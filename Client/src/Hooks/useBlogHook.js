import { useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchPosts,
  fetchStats,
  createPost,
  updatePost,
  publishPost,
  unpublishPost,
  softDeletePost,
  restorePost,
  permanentDeletePost,
  emptyTrash,
  clearError,
  fetchPublicPosts,
  fetchPublicPostBySlug,
  fetchRelatedPosts,
  fetchPublicPostsByCategory,
  clearPublicError,
  clearActivePost,
} from "../API/blogApi";

export function useBlog(queryParams = {}) {
  const dispatch = useDispatch();
  const { posts, stats, pagination, loading, statsLoading, saving, error } =
    useSelector((state) => state.blog);

  useEffect(() => {
    dispatch(fetchPosts(queryParams));
  }, [
    dispatch,
    queryParams.status,
    queryParams.category,
    queryParams.search,
    queryParams.sortBy,
    queryParams.page,
    queryParams.limit,
  ]);

  useEffect(() => {
    dispatch(fetchStats());
  }, [dispatch]);

  const refetch = useCallback(
    (params) => {
      dispatch(fetchPosts(params || queryParams));
      dispatch(fetchStats());
    },
    [dispatch, queryParams],
  );

  const handleCreate = useCallback(
    async (payload) => {
      const result = await dispatch(createPost(payload));
      if (!result.error) {
        dispatch(fetchPosts(queryParams));
        dispatch(fetchStats());
      }
      return result;
    },
    [dispatch, queryParams],
  );

  const handleUpdate = useCallback(
    async (id, payload) => {
      const result = await dispatch(updatePost({ id, ...payload }));
      if (!result.error) dispatch(fetchStats());
      return result;
    },
    [dispatch],
  );

  const handlePublish = useCallback(
    async (id) => {
      const result = await dispatch(publishPost(id));
      if (!result.error) dispatch(fetchStats());
      return result;
    },
    [dispatch],
  );

  const handleUnpublish = useCallback(
    async (id) => {
      const result = await dispatch(unpublishPost(id));
      if (!result.error) dispatch(fetchStats());
      return result;
    },
    [dispatch],
  );

  const handleSoftDelete = useCallback(
    async (id) => {
      const result = await dispatch(softDeletePost(id));
      if (!result.error) dispatch(fetchStats());
      return result;
    },
    [dispatch],
  );

  const handleRestore = useCallback(
    async (id) => {
      const result = await dispatch(restorePost(id));
      if (!result.error) dispatch(fetchStats());
      return result;
    },
    [dispatch],
  );

  const handlePermanentDelete = useCallback(
    async (id) => {
      const result = await dispatch(permanentDeletePost(id));
      if (!result.error) dispatch(fetchStats());
      return result;
    },
    [dispatch],
  );

  const handleEmptyTrash = useCallback(async () => {
    const result = await dispatch(emptyTrash());
    if (!result.error) dispatch(fetchStats());
    return result;
  }, [dispatch]);

  const handleClearError = useCallback(
    () => dispatch(clearError()),
    [dispatch],
  );

  return {
    posts,
    stats,
    pagination,
    loading,
    statsLoading,
    saving,
    error,
    refetch,
    createPost: handleCreate,
    updatePost: handleUpdate,
    publishPost: handlePublish,
    unpublishPost: handleUnpublish,
    softDeletePost: handleSoftDelete,
    restorePost: handleRestore,
    permanentDeletePost: handlePermanentDelete,
    emptyTrash: handleEmptyTrash,
    clearError: handleClearError,
  };
}

export function usePublicBlog(queryParams = {}) {
  const dispatch = useDispatch();
  const {
    publicPosts,
    publicPagination,
    publicLoading,
    activePost,
    activePostLoading,
    relatedPosts,
    relatedLoading,
    publicError,
  } = useSelector((state) => state.blog);

  useEffect(() => {
    dispatch(fetchPublicPosts(queryParams));
  }, [
    dispatch,
    queryParams.category,
    queryParams.search,
    queryParams.sortBy,
    queryParams.page,
    queryParams.limit,
  ]);

  const loadPost = useCallback(
    async (slug) => {
      const result = await dispatch(fetchPublicPostBySlug(slug));
      if (!result.error) dispatch(fetchRelatedPosts(slug));
      return result;
    },
    [dispatch],
  );

  const loadByCategory = useCallback(
    async (category, params = {}) => {
      return dispatch(fetchPublicPostsByCategory({ category, ...params }));
    },
    [dispatch],
  );

  const refetch = useCallback(
    (params) => dispatch(fetchPublicPosts(params || queryParams)),
    [dispatch, queryParams],
  );

  const handleClearActivePost = useCallback(
    () => dispatch(clearActivePost()),
    [dispatch],
  );

  const handleClearError = useCallback(
    () => dispatch(clearPublicError()),
    [dispatch],
  );

  return {
    posts: publicPosts,
    pagination: publicPagination,
    loading: publicLoading,
    activePost,
    activePostLoading,
    relatedPosts,
    relatedLoading,
    error: publicError,
    loadPost,
    loadByCategory,
    refetch,
    clearActivePost: handleClearActivePost,
    clearError: handleClearError,
  };
}

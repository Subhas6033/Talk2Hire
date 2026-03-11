import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

const BASE = `${import.meta.env.VITE_BACKEND_URL}/api/v1/admin/blog`;
const PUBLIC_BASE = `${import.meta.env.VITE_BACKEND_URL}/api/v1/admin/blog/public`;

const getAdminToken = () => {
  const match = document.cookie.match(/(^| )adminAccessToken=([^;]+)/);
  return match ? match[2] : null;
};

const authHeaders = () => ({
  headers: { Authorization: `Bearer ${getAdminToken()}` },
});

export const fetchPosts = createAsyncThunk(
  "blog/fetchPosts",
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${BASE}/posts`, {
        params,
        ...authHeaders(),
      });
      return data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch posts",
      );
    }
  },
);

export const fetchStats = createAsyncThunk(
  "blog/fetchStats",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${BASE}/stats`, authHeaders());
      return data.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch stats",
      );
    }
  },
);

export const createPost = createAsyncThunk(
  "blog/createPost",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await axios.post(
        `${BASE}/posts`,
        payload,
        authHeaders(),
      );
      return data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to create post",
      );
    }
  },
);

export const updatePost = createAsyncThunk(
  "blog/updatePost",
  async ({ id, ...payload }, { rejectWithValue }) => {
    try {
      const { status: _ignored, ...safePayload } = payload;
      const { data } = await axios.put(
        `${BASE}/posts/${id}`,
        safePayload,
        authHeaders(),
      );
      return { id, ...safePayload, ...data.data };
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to update post",
      );
    }
  },
);

export const publishPost = createAsyncThunk(
  "blog/publishPost",
  async (id, { rejectWithValue }) => {
    try {
      await axios.patch(`${BASE}/posts/${id}/publish`, {}, authHeaders());
      return id;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to publish",
      );
    }
  },
);

export const unpublishPost = createAsyncThunk(
  "blog/unpublishPost",
  async (id, { rejectWithValue }) => {
    try {
      await axios.patch(`${BASE}/posts/${id}/unpublish`, {}, authHeaders());
      return id;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to unpublish",
      );
    }
  },
);

export const softDeletePost = createAsyncThunk(
  "blog/softDeletePost",
  async (id, { rejectWithValue }) => {
    try {
      await axios.delete(`${BASE}/posts/${id}/soft`, authHeaders());
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to delete");
    }
  },
);

export const restorePost = createAsyncThunk(
  "blog/restorePost",
  async (id, { rejectWithValue }) => {
    try {
      await axios.patch(`${BASE}/posts/${id}/restore`, {}, authHeaders());
      return id;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to restore",
      );
    }
  },
);

export const permanentDeletePost = createAsyncThunk(
  "blog/permanentDeletePost",
  async (id, { rejectWithValue }) => {
    try {
      await axios.delete(`${BASE}/posts/${id}/permanent`, authHeaders());
      return id;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to permanently delete",
      );
    }
  },
);

export const emptyTrash = createAsyncThunk(
  "blog/emptyTrash",
  async (_, { rejectWithValue }) => {
    try {
      await axios.delete(`${BASE}/trash/empty`, authHeaders());
      return true;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to empty trash",
      );
    }
  },
);

export const fetchPublicPosts = createAsyncThunk(
  "blog/fetchPublicPosts",
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${PUBLIC_BASE}/posts`, { params });
      return data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch public posts",
      );
    }
  },
);

export const fetchPublicPostBySlug = createAsyncThunk(
  "blog/fetchPublicPostBySlug",
  async (slug, { rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${PUBLIC_BASE}/posts/${slug}`);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Post not found");
    }
  },
);

export const fetchRelatedPosts = createAsyncThunk(
  "blog/fetchRelatedPosts",
  async (slug, { rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${PUBLIC_BASE}/posts/related/${slug}`);
      return data.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch related posts",
      );
    }
  },
);

export const fetchPublicPostsByCategory = createAsyncThunk(
  "blog/fetchPublicPostsByCategory",
  async ({ category, ...params }, { rejectWithValue }) => {
    try {
      const { data } = await axios.get(
        `${PUBLIC_BASE}/posts/category/${category}`,
        { params },
      );
      return data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch category posts",
      );
    }
  },
);

const blogSlice = createSlice({
  name: "blog",
  initialState: {
    posts: [],
    stats: {
      total: 0,
      published: 0,
      draft: 0,
      deleted: 0,
      total_views: 0,
      total_words: 0,
    },
    pagination: { total: 0, page: 1, limit: 20, totalPages: 1 },
    loading: false,
    statsLoading: false,
    saving: false,
    error: null,

    publicPosts: [],
    publicPagination: { total: 0, page: 1, limit: 20, totalPages: 1 },
    publicLoading: false,
    activePost: null,
    activePostLoading: false,
    relatedPosts: [],
    relatedLoading: false,
    publicError: null,
  },
  reducers: {
    clearError(state) {
      state.error = null;
    },
    clearPublicError(state) {
      state.publicError = null;
    },
    clearActivePost(state) {
      state.activePost = null;
      state.relatedPosts = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPosts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPosts.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.posts = payload.data;
        state.pagination = payload.pagination;
      })
      .addCase(fetchPosts.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload;
      })

      .addCase(fetchStats.pending, (state) => {
        state.statsLoading = true;
      })
      .addCase(fetchStats.fulfilled, (state, { payload }) => {
        state.statsLoading = false;
        state.stats = payload;
      })
      .addCase(fetchStats.rejected, (state) => {
        state.statsLoading = false;
      })

      .addCase(createPost.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(createPost.fulfilled, (state) => {
        state.saving = false;
      })
      .addCase(createPost.rejected, (state, { payload }) => {
        state.saving = false;
        state.error = payload;
      })

      .addCase(updatePost.pending, (state) => {
        state.saving = true;
      })
      .addCase(updatePost.fulfilled, (state, { payload }) => {
        state.saving = false;
        const idx = state.posts.findIndex((p) => p.id === payload.id);
        if (idx !== -1) state.posts[idx] = { ...state.posts[idx], ...payload };
      })
      .addCase(updatePost.rejected, (state, { payload }) => {
        state.saving = false;
        state.error = payload;
      })

      .addCase(publishPost.fulfilled, (state, { payload: id }) => {
        const post = state.posts.find((p) => p.id === id);
        if (post) post.status = "published";
      })
      .addCase(unpublishPost.fulfilled, (state, { payload: id }) => {
        const post = state.posts.find((p) => p.id === id);
        if (post) post.status = "draft";
      })
      .addCase(softDeletePost.fulfilled, (state, { payload: id }) => {
        const post = state.posts.find((p) => p.id === id);
        if (post) post.status = "deleted";
      })
      .addCase(restorePost.fulfilled, (state, { payload: id }) => {
        const post = state.posts.find((p) => p.id === id);
        if (post) {
          post.status = "draft";
          post.deleted_at = null;
        }
      })
      .addCase(permanentDeletePost.fulfilled, (state, { payload: id }) => {
        state.posts = state.posts.filter((p) => p.id !== id);
      })
      .addCase(emptyTrash.fulfilled, (state) => {
        state.posts = state.posts.filter((p) => p.status !== "deleted");
      })

      .addCase(fetchPublicPosts.pending, (state) => {
        state.publicLoading = true;
        state.publicError = null;
      })
      .addCase(fetchPublicPosts.fulfilled, (state, { payload }) => {
        state.publicLoading = false;
        state.publicPosts = payload.data;
        state.publicPagination = payload.pagination;
      })
      .addCase(fetchPublicPosts.rejected, (state, { payload }) => {
        state.publicLoading = false;
        state.publicError = payload;
      })

      .addCase(fetchPublicPostBySlug.pending, (state) => {
        state.activePostLoading = true;
        state.publicError = null;
      })
      .addCase(fetchPublicPostBySlug.fulfilled, (state, { payload }) => {
        state.activePostLoading = false;
        state.activePost = payload;
      })
      .addCase(fetchPublicPostBySlug.rejected, (state, { payload }) => {
        state.activePostLoading = false;
        state.publicError = payload;
      })

      .addCase(fetchRelatedPosts.pending, (state) => {
        state.relatedLoading = true;
      })
      .addCase(fetchRelatedPosts.fulfilled, (state, { payload }) => {
        state.relatedLoading = false;
        state.relatedPosts = payload;
      })
      .addCase(fetchRelatedPosts.rejected, (state) => {
        state.relatedLoading = false;
      })

      .addCase(fetchPublicPostsByCategory.pending, (state) => {
        state.publicLoading = true;
        state.publicError = null;
      })
      .addCase(fetchPublicPostsByCategory.fulfilled, (state, { payload }) => {
        state.publicLoading = false;
        state.publicPosts = payload.data;
        state.publicPagination = payload.pagination;
      })
      .addCase(fetchPublicPostsByCategory.rejected, (state, { payload }) => {
        state.publicLoading = false;
        state.publicError = payload;
      });
  },
});

export const { clearError, clearPublicError, clearActivePost } =
  blogSlice.actions;
export default blogSlice.reducer;

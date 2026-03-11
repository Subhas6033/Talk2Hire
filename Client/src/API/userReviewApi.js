import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
const apiBaseUrl = import.meta.env.VITE_BACKEND_URL;

export const submitUserReview = createAsyncThunk(
  "review/submitUserReview",
  async ({ full_name, email, subject, message }, { rejectWithValue }) => {
    try {
      const { data } = await axios.post(
        `${apiBaseUrl}/api/v1/review/send-user-review`,
        { full_name, email, subject, message },
        {
          withCredentials: true,
          headers: { "Content-Type": "application/json" },
        },
      );
      return data;
    } catch (err) {
      return rejectWithValue(
        err?.response?.data?.message || "Failed to submit review",
      );
    }
  },
);

const reviewSlice = createSlice({
  name: "review",
  initialState: {
    loading: false,
    success: false,
    error: null,
    review: null,
  },
  reducers: {
    resetReviewState: (state) => {
      state.loading = false;
      state.success = false;
      state.error = null;
      state.review = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(submitUserReview.pending, (state) => {
        state.loading = true;
        state.success = false;
        state.error = null;
      })
      .addCase(submitUserReview.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.review = action.payload?.data || null;
        state.error = null;
      })
      .addCase(submitUserReview.rejected, (state, action) => {
        state.loading = false;
        state.success = false;
        state.error = action.payload;
      });
  },
});

export const { resetReviewState } = reviewSlice.actions;
export default reviewSlice.reducer;

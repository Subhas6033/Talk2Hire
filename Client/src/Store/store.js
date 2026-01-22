import { configureStore } from "@reduxjs/toolkit";
import authReducer from "../API/authApi";

export const store = configureStore({
  reducer: {
    auth: authReducer,
  },
});

export default store;

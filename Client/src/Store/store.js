import { configureStore } from "@reduxjs/toolkit";
import authReducer from "../API/authApi";
import passwordReducer from "../API/passwordApi";
import interviewReducer from "../API/processFileApi";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    password: passwordReducer,
    interview: interviewReducer,
  },
});

export default store;

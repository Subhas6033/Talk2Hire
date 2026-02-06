import { configureStore } from "@reduxjs/toolkit";
import authReducer from "../API/authApi";
import passwordReducer from "../API/passwordApi";
import { setupInterceptors } from "../API/Setupinterceptor";
import interviewReducer from "../API/interviewApi";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    password: passwordReducer,
    interview: interviewReducer,
  },
});

setupInterceptors(store);

export default store;

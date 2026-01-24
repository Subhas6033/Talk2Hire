import { configureStore } from "@reduxjs/toolkit";
import authReducer from "../API/authApi";
import passwordReducer from "../API/passwordApi";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    password: passwordReducer,
  },
});

export default store;

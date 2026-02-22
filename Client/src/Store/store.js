import { configureStore } from "@reduxjs/toolkit";
import authReducer from "../API/authApi";
import passwordReducer from "../API/passwordApi";
import { setupInterceptors } from "../API/Setupinterceptor";
import interviewReducer from "../API/interviewApi";
import hiringReducer from "../API/hiringApi";
import companyReducer from "../API/companyAuthApi";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    password: passwordReducer,
    interview: interviewReducer,
    hiring: hiringReducer,
    company: companyReducer,
  },
});

setupInterceptors(store);

export default store;

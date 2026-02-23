import { configureStore } from "@reduxjs/toolkit";
import authReducer from "../API/authApi";
import passwordReducer from "../API/passwordApi";
import { setupInterceptors } from "../API/Setupinterceptor";
import interviewReducer from "../API/interviewApi";
import hiringReducer from "../API/hiringApi";
import companyReducer from "../API/companyAuthApi";
import jobReducer from "../API/jobApi";
import dashboardReducer from "../API/companyDashboardApi";
import companyInterviewReducer from "../API/companyInterviewApi";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    password: passwordReducer,
    interview: interviewReducer,
    hiring: hiringReducer,
    company: companyReducer,
    jobs: jobReducer,
    dashboard: dashboardReducer,
    companyInterviews: companyInterviewReducer,
  },
});

setupInterceptors(store);

export default store;

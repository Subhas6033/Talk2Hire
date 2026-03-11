import { configureStore } from "@reduxjs/toolkit";
import authReducer from "../API/authApi";
import { setupInterceptors } from "../API/Setupinterceptor";
import interviewReducer from "../API/interviewApi";
import hiringReducer from "../API/hiringApi";
import companyReducer from "../API/companyAuthApi";
import jobReducer from "../API/jobApi";
import dashboardReducer from "../API/companyDashboardApi";
import companyInterviewReducer from "../API/companyInterviewApi";
import applicationReducer from "../API/ApplicationApi";
import userReviewReducer from "../API/userReviewApi";
import microsoftAuthReducer from "../API/microsoftAuthApi";
import microsoftUserAuthReducer from "../API/microsoftUserApi";
import adminAuthReducer from "../API/adminAuthApi";
import blogReducer from "../API/blogApi";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    interview: interviewReducer,
    hiring: hiringReducer,
    company: companyReducer,
    jobs: jobReducer,
    dashboard: dashboardReducer,
    companyInterviews: companyInterviewReducer,
    applications: applicationReducer,
    review: userReviewReducer,
    microsoftAuth: microsoftAuthReducer,
    microsoftUserAuth: microsoftUserAuthReducer,
    adminAuth: adminAuthReducer,
    blog: blogReducer,
  },
});

setupInterceptors(store);

export default store;

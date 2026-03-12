import { configureStore } from "@reduxjs/toolkit";
import authReducer from "../API/authApi";
import { setupInterceptors } from "../API/Setupinterceptor";
import interviewReducer from "../API/interviewApi";
import hiringReducer from "../API/hiringApi";
import companyReducer from "../API/companyAuthApi";
import { jobReducer, savedJobReducer, saveJob } from "../API/jobApi";
import dashboardReducer from "../API/companyDashboardApi";
import companyInterviewReducer from "../API/companyInterviewApi";
import applicationReducer from "../API/ApplicationApi";
import userReviewReducer from "../API/userReviewApi";
import microsoftAuthReducer from "../API/microsoftAuthApi";
import microsoftUserAuthReducer from "../API/microsoftUserApi";
import adminAuthReducer from "../API/adminAuthApi";
import blogReducer from "../API/blogApi";
import userProfileReducer from "../API/userProfileApi";
import adminStatsReducer from "../API/adminDashboardApi";
import adminUserManagementReducer from "../API/adminUserManageApi";
import adminCompanyManagementReducer from "../API/adminCompanyManageApi";
import adminJobManagementReducer from "../API/AdminJobManageApi";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    interview: interviewReducer,
    hiring: hiringReducer,
    company: companyReducer,
    jobs: jobReducer,
    savedJobs: savedJobReducer,
    dashboard: dashboardReducer,
    companyInterviews: companyInterviewReducer,
    applications: applicationReducer,
    review: userReviewReducer,
    microsoftAuth: microsoftAuthReducer,
    microsoftUserAuth: microsoftUserAuthReducer,
    adminAuth: adminAuthReducer,
    blog: blogReducer,
    profile: userProfileReducer,
    adminDashboard: adminStatsReducer,
    adminUsers: adminUserManagementReducer,
    adminCompanies: adminCompanyManagementReducer,
    adminJobs: adminJobManagementReducer,
  },
});

setupInterceptors(store);

export default store;

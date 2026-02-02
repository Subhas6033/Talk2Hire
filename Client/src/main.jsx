import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import {
  Home,
  About,
  Interview,
  Login,
  Signup,
  NotFound,
  Privacy,
  Terms,
  Contact,
  InterviewDashboard,
  Profile,
  VerifyPassword,
  Hire,
} from "./Pages/index.pages.js";
import { Guidlines, MobileSecurityCamera } from "./Components/index.js";
import { Provider } from "react-redux";
import { store } from "./Store/store.js";
import ProtectedRoutes from "./Security/ProtectedRoutes.jsx";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        path: "/",
        element: <Home />,
      },
      {
        path: "/about",
        element: <About />,
      },
      {
        path: "/interview",
        element: (
          <ProtectedRoutes>
            <Interview />
          </ProtectedRoutes>
        ),
      },
      {
        path: "/login",
        element: <Login />,
      },
      {
        path: "/verify-password",
        element: <VerifyPassword />,
      },
      {
        path: "/signup",
        element: <Signup />,
      },
      {
        path: "/privacy",
        element: <Privacy />,
      },
      {
        path: "/terms",
        element: <Terms />,
      },
      {
        path: "/contact",
        element: <Contact />,
      },
      {
        path: "/guidlines",
        element: <Guidlines />,
      },
      {
        path: "/dashboard",
        element: (
          <ProtectedRoutes>
            <InterviewDashboard />
          </ProtectedRoutes>
        ),
      },
      {
        path: "/profile/:id",
        element: (
          <ProtectedRoutes>
            <Profile />
          </ProtectedRoutes>
        ),
      },
      {
        path: "/hire",
        element: <Hire />,
      },
      {
        path: "/mobile-security",
        element: <MobileSecurityCamera />,
      },
      // {
      //   path: "*",
      //   element: <NotFound />,
      // },
    ],
  },
]);

createRoot(document.getElementById("root")).render(
  // <StrictMode>
  <Provider store={store}>
    <RouterProvider router={router}>
      <App />
    </RouterProvider>
  </Provider>
  // </StrictMode>
);

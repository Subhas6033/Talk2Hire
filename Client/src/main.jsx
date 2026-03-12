import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import { Provider } from "react-redux";
import { store } from "./Store/store.js";
import { AuthProvider } from "./Components/index.js";
import { StreamProvider } from "./Hooks/streamContext.jsx";
import { GoogleOAuthProvider } from "@react-oauth/google";

createRoot(document.getElementById("root")).render(
  <Provider store={store}>
    <StreamProvider>
      <AuthProvider>
        <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </GoogleOAuthProvider>
      </AuthProvider>
    </StreamProvider>
  </Provider>,
);

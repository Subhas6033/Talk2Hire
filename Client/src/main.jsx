import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import { Provider } from "react-redux";
import { store } from "./Store/store.js";
import { AuthProvider } from "./Components/index.js";
import { StreamProvider } from "./Hooks/streamContext.jsx";

createRoot(document.getElementById("root")).render(
  //<StrictMode>
  <Provider store={store}>
    <StreamProvider>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </StreamProvider>
  </Provider>,
  // </StrictMode>
);

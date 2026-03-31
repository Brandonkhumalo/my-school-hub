import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { SchoolSettingsProvider } from "./context/SchoolSettingsContext.jsx";
import WhatsAppButton from "./components/WhatsAppButton.jsx";
import { registerSW } from "./registerSW.js";

registerSW();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SchoolSettingsProvider>
          <App />
          <WhatsAppButton />
        </SchoolSettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

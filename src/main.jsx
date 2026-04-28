import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { SchoolSettingsProvider } from "./context/SchoolSettingsContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import WhatsAppButton from "./components/WhatsAppButton.jsx";
import { registerSW } from "./registerSW.js";
import "./index.css";

registerSW();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <SchoolSettingsProvider>
              <App />
              <WhatsAppButton />
            </SchoolSettingsProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>
);

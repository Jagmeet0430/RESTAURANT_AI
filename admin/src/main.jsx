import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

try {
  const savedSettings = JSON.parse(localStorage.getItem("restaurantai_settings") || "{}");
  if (savedSettings.theme) {
    document.documentElement.dataset.adminTheme = savedSettings.theme;
  }
} catch {
  document.documentElement.dataset.adminTheme = "light";
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);

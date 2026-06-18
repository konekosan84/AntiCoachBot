// src/main.jsx

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// register global axios interceptors (JWT + 401 handling) before any API call
import "./api/api";

// theme vars — первым, чтобы CSS-переменные были доступны всем файлам ниже
import "./ui/styles/neo/theme-vars.css";
import "./ui/styles/neo/ui.css";
import "./ui/styles/neo/ui-kit.css";
import "./ui/styles/neo/NeoUI.css";
import "./index.css";


ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);







import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App.jsx";
import "./index.css";

/*
 * IMPORTANT:
 * StudentTheme.css must be imported AFTER the normal
 * application CSS so the active theme overrides old
 * hard-coded colors.
 */
import "./StudentTheme.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
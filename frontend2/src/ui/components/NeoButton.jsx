import React from "react";
import "../styles/neo/neo-button.css";

export default function NeoButton({ children, type = "primary", onClick }) {
  return (
    <button className={`neo-btn neo-btn-${type}`} onClick={onClick}>
      {children}
    </button>
  );
}




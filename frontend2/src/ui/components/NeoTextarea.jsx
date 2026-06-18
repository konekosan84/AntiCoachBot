import React from "react";
import "../styles/neo/neo-textarea.css";

export default function NeoTextarea({ label, value, onChange }) {
  return (
    <div className="neo-field">
      {label && <label>{label}</label>}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}



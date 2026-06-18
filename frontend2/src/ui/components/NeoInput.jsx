import React from "react";
import "../styles/neo/neo-input.css";

export default function NeoInput({ label, value, onChange, placeholder }) {
  return (
    <div className="neo-input-wrapper">
      {label && <label className="neo-label">{label}</label>}
      <input
        className="neo-input"
        value={value}
        placeholder={placeholder || ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}


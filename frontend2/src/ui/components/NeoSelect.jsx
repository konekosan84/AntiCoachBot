import React, { useState } from "react";
import "../styles/neo/neo-select.css";

export default function NeoSelect({
  label,
  value,
  onChange,
  options = [],
  placeholder = "Выбрать...",
}) {
  const [open, setOpen] = useState(false);

  const current = options.find((o) => o.value === value);

  return (
    <div className="neo-select-block">
      {label && <label className="neo-label">{label}</label>}

      <div
        className={`neo-select ${open ? "open" : ""}`}
        onClick={() => setOpen((s) => !s)}
      >
        <span className={`neo-select-value ${!current ? "placeholder" : ""}`}>
          {current ? current.label : placeholder}
        </span>

        <span className={`neo-select-arrow ${open ? "up" : ""}`}>⌄</span>
      </div>

      {open && (
        <div className="neo-select-dropdown">
          {options.length === 0 && (
            <div className="neo-select-empty">Нет вариантов</div>
          )}

          {options.map((opt) => (
            <div
              key={opt.value}
              className={`neo-select-option ${
                opt.value === value ? "active" : ""
              }`}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

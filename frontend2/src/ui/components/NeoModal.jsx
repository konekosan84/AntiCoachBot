import React from "react";
import "../styles/neo/neo-modal.css";

export default function NeoModal({ isOpen, title, onClose, children }) {
  if (!isOpen) return null;

  return (
    <div className="neo-modal-overlay" onClick={onClose}>
      <div className="neo-modal-window" onClick={(e) => e.stopPropagation()}>
        <div className="neo-modal-header">
          <h2>{title}</h2>
          <button className="neo-close" onClick={onClose}>×</button>
        </div>

        <div className="neo-modal-body">{children}</div>
      </div>
    </div>
  );
}


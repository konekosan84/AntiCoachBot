import React from "react";
import { FiEdit2, FiTrash2 } from "react-icons/fi";
import "../styles/neo/neo-actions.css";

export default function NeoActionButtons({ onEdit, onDelete }) {
  return (
    <div className="neo-actions">
      <button className="neo-action-btn edit" onClick={onEdit}>
        <FiEdit2 size={16} />
      </button>

      <button className="neo-action-btn delete" onClick={onDelete}>
        <FiTrash2 size={16} />
      </button>
    </div>
  );
}

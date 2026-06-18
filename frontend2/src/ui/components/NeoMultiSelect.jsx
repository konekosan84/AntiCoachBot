import React, { useState, useRef, useEffect } from "react";
import "../styles/neo/neo-multiselect.css";

export default function NeoMultiSelect({
  label,
  options = [],
  selected = [],
  onChange,
  placeholder = "Выберите...",
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);

  const toggle = () => setOpen((o) => !o);

  const handleSelect = (item) => {
    if (selected.some((s) => s.id === item.id)) {
      onChange(selected.filter((s) => s.id !== item.id));
    } else {
      onChange([...selected, item]);
    }
  };

  const filtered = options.filter((opt) =>
    opt.name.toLowerCase().includes(search.toLowerCase())
  );

  // Закрыть по клику вне
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="neo-ms-wrapper" ref={ref}>
      {label && <label className="neo-ms-label">{label}</label>}

      <div className="neo-ms-control" onClick={toggle}>
        {selected.length === 0 ? (
          <span className="neo-ms-placeholder">{placeholder}</span>
        ) : (
          <div className="neo-ms-tags">
            {selected.slice(0, 3).map((item) => (
              <span className="neo-ms-tag" key={item.id}>
                {item.name}
              </span>
            ))}
            {selected.length > 3 && (
              <span className="neo-ms-tag-more">
                + ещё {selected.length - 3}
              </span>
            )}
          </div>
        )}

        <span className="neo-ms-arrow">{open ? "▲" : "▼"}</span>
      </div>

      {open && (
        <div className="neo-ms-dropdown">
          <input
            className="neo-ms-search"
            placeholder="Поиск…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="neo-ms-options">
            {filtered.length === 0 && (
              <div className="neo-ms-empty">Ничего не найдено</div>
            )}

            {filtered.map((opt) => (
              <div
                key={opt.id}
                className={`neo-ms-option ${
                  selected.some((s) => s.id === opt.id)
                    ? "neo-ms-option-selected"
                    : ""
                }`}
                onClick={() => handleSelect(opt)}
              >
                {opt.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

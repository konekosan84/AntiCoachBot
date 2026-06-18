import { X } from "lucide-react";
import { useEffect, useState } from "react";
import PhoneInput from "../PhoneInput.jsx";
import PhotoUpload from "../PhotoUpload.jsx";
import "./BranchSidePanel.css";

const defaultSchedule = {
  monday:    { enabled: true,  from: "09:00", to: "18:00" },
  tuesday:   { enabled: true,  from: "09:00", to: "18:00" },
  wednesday: { enabled: true,  from: "09:00", to: "18:00" },
  thursday:  { enabled: true,  from: "09:00", to: "18:00" },
  friday:    { enabled: true,  from: "09:00", to: "18:00" },
  saturday:  { enabled: false, from: "", to: "" },
  sunday:    { enabled: false, from: "", to: "" },
};

export default function BranchSidePanel({
  branch,
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState({
    name: "",
    address: "",
    phone: "",
    status: "active",
    description_client: "",
    internal_comment: "",
    schedule: defaultSchedule,
    photo_url: null,
  });

  useEffect(() => {
    if (branch) {
      setForm({
        name: branch.name || "",
        address: branch.address || "",
        phone: branch.phone || "",
        status: branch.status || "active",
        description_client: branch.description_client || "",
        internal_comment: branch.internal_comment || "",
        schedule: branch.schedule || defaultSchedule,
        photo_url: branch.photo_url || null,
      });
    }
  }, [branch]);

  const updateSchedule = (day, changes) => {
    setForm(prev => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [day]: {
          ...prev.schedule[day],
          ...changes,
        },
      },
    }));
  };

  return (
    <div className="employee-panel">
      {/* HEADER */}
      <div className="panel-header">
        <h2>{branch?.id ? "Филиал" : "Новый филиал"}</h2>
        <button className="close-btn" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <div className="panel-form">
        <div>
          <label>Изображение филиала</label>
          <PhotoUpload
            value={form.photo_url}
            onChange={(url) => setForm({ ...form, photo_url: url })}
            shape="rect"
            size={120}
          />
        </div>

        <div>
          <label>Название</label>
          <input
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="Название филиала"
          />
        </div>

        <div>
          <label>Адрес</label>
          <input
            value={form.address}
            onChange={e => setForm({ ...form, address: e.target.value })}
            placeholder="Адрес"
          />
        </div>

        <div>
          <label>Телефон</label>
          <PhoneInput
            mode="masked"
            value={form.phone}
            onChange={(val) => setForm({ ...form, phone: val })}
          />
        </div>

        <div>
          <label>Статус</label>
          <select
            value={form.status}
            onChange={e => setForm({ ...form, status: e.target.value })}
          >
            <option value="active">Активен</option>
            <option value="inactive">Неактивен</option>
          </select>
        </div>

        {/* ===== SCHEDULE ===== */}
        <div>
          <label>График работы</label>

          {Object.entries(form.schedule).map(([day, cfg]) => (
            <div
              key={day}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 6,
              }}
            >
              <input
                type="checkbox"
                checked={cfg.enabled}
                onChange={e =>
                  updateSchedule(day, { enabled: e.target.checked })
                }
              />

              <span style={{ width: 90 }}>
                {day}
              </span>

              <input
                type="time"
                disabled={!cfg.enabled}
                value={cfg.from}
                onChange={e =>
                  updateSchedule(day, { from: e.target.value })
                }
              />

              <input
                type="time"
                disabled={!cfg.enabled}
                value={cfg.to}
                onChange={e =>
                  updateSchedule(day, { to: e.target.value })
                }
              />
            </div>
          ))}
        </div>

        <div>
          <label>Описание для клиентов</label>
          <textarea
            value={form.description_client}
            onChange={e =>
              setForm({ ...form, description_client: e.target.value })
            }
          />
        </div>

        <div>
          <label>Внутренний комментарий</label>
          <textarea
            value={form.internal_comment}
            onChange={e =>
              setForm({ ...form, internal_comment: e.target.value })
            }
          />
        </div>

      </div>

      <div className="panel-footer">
        <button
          className="primary-save"
          onClick={() => onSaved(form)}
        >
          Сохранить
        </button>
      </div>
    </div>
  );
}

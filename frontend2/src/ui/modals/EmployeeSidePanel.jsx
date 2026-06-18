import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import PhoneInput from "../PhoneInput.jsx";
import PhotoUpload from "../PhotoUpload.jsx";
import "./EmployeeSidePanel.css";

export default function EmployeeSidePanel({
  employee,
  branches = [],
  services = [],
  allPositions = [],
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    position: "",
    role: "employee",
    status: "active",
    branches: [],
    services: [],
    description_client: "",
    internal_comment: "",
    photo_url: null,
  });

  useEffect(() => {
    if (employee) {
      setForm({
        name: employee.name || "",
        phone: employee.phone || "",
        email: employee.email || "",
        position: employee.position || "",
        role: employee.role || "employee",
        status: employee.status || "active",
        branches: employee.branches?.map(b => b.id) || [],
        services: employee.services?.map(s => s.id) || [],
        description_client: employee.description_client || "",
        internal_comment: employee.internal_comment || "",
        photo_url: employee.photo_url || null,
      });
    }
  }, [employee]);

  const toggleMulti = (key, id) => {
    setForm(prev => ({
      ...prev,
      [key]: prev[key].includes(id)
        ? prev[key].filter(x => x !== id)
        : [...prev[key], id],
    }));
  };

  /* ---------- POSITION AUTOCOMPLETE ---------- */
  const positionSuggestions = useMemo(() => {
    if (!form.position) return [];
    const value = form.position.toLowerCase();

    return allPositions
      .filter(
        p =>
          p.toLowerCase().includes(value) &&
          p.toLowerCase() !== value
      )
      .slice(0, 5);
  }, [form.position, allPositions]);

  return (
    <div className="employee-panel">
      {/* HEADER */}
      <div className="panel-header">
        <h2>{employee?.id ? "Сотрудник" : "Новый сотрудник"}</h2>
        <button className="close-btn" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <div className="panel-form">
        <div>
          <label>Фото</label>
          <PhotoUpload
            value={form.photo_url}
            onChange={(url) => setForm({ ...form, photo_url: url })}
            shape="circle"
            size={96}
          />
        </div>

        <div>
          <label>ФИО</label>
          <input
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="Имя сотрудника"
          />
        </div>

        <div>
          <label>Телефон</label>
          <PhoneInput
            value={form.phone}
            onChange={(raw) => setForm({ ...form, phone: raw })}
          />
        </div>

        <div>
          <label>Email</label>
          <input
            type="email"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            placeholder="name@example.com"
          />
        </div>

        <div className="position-field">
          <label>Должность</label>
          <input
            value={form.position}
            onChange={e =>
              setForm({ ...form, position: e.target.value })
            }
            placeholder="Менеджер / Преподаватель"
          />

          {positionSuggestions.length > 0 && (
            <div className="position-hints">
              {positionSuggestions.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() =>
                    setForm({ ...form, position: p })
                  }
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label>Роль</label>
          <select
            value={form.role}
            onChange={e => setForm({ ...form, role: e.target.value })}
          >
            <option value="employee">Сотрудник</option>
            <option value="admin">Администратор</option>
            <option value="owner">Владелец</option>
          </select>
        </div>

        <div>
          <label>Статус</label>
          <select
            value={form.status}
            onChange={e =>
              setForm({ ...form, status: e.target.value })
            }
          >
            <option value="active">Активен</option>
            <option value="vacation">Отпуск</option>
            <option value="sick">Болеет</option>
            <option value="fired">Уволен</option>
          </select>
        </div>

        <div>
          <label>Филиалы</label>
          <div className="chips">
            {branches.map(b => (
              <button
                key={b.id}
                type="button"
                onClick={() => toggleMulti("branches", b.id)}
                className={
                  form.branches.includes(b.id)
                    ? "chip active"
                    : "chip"
                }
              >
                {b.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label>Описание для клиентов</label>
          <textarea
            value={form.description_client}
            onChange={e =>
              setForm({
                ...form,
                description_client: e.target.value,
              })
            }
          />
        </div>

        <div>
          <label>Внутренний комментарий</label>
          <textarea
            value={form.internal_comment}
            onChange={e =>
              setForm({
                ...form,
                internal_comment: e.target.value,
              })
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

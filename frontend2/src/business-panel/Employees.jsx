import { useEffect, useMemo, useState } from "react";

/* API */
import {
  getEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  updateEmployeeBranches,
} from "../api/employees.js";

import { getBranches } from "../api/branches";

/* UI */
import NeoEmployeeCard from "../ui/components/NeoEmployeeCard.jsx";
import NeoEmployeeTable from "../ui/components/NeoEmployeeTable.jsx";
import EmployeeSidePanel from "../ui/modals/EmployeeSidePanel.jsx";
import NeoSegmented from "../ui/components/NeoSegmented.jsx";
import { useToast } from "../helpers/ToastContext.jsx";
import { SkeletonCardGrid } from "../ui/Skeleton.jsx";
import EmptyState from "../ui/EmptyState.jsx";
import { Users as UsersIcon } from "lucide-react";

export default function Employees() {
  const toast = useToast();
  /* ---------- STATE ---------- */
  const [employees, setEmployees] = useState([]);
  const [view, setView] = useState("cards");
  const [loading, setLoading] = useState(true);

  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const [branches, setBranches] = useState([]);
  const [services, setServices] = useState([]);

  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("");

  /* ---------- LOAD ---------- */
  const loadEmployees = async () => {
    try {
      const data = await getEmployees();
      setEmployees(data);
    } catch (e) {
      console.error("Ошибка загрузки сотрудников", e);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Источник истины для выбора филиалов — /branches
  const loadBranches = async () => {
    try {
      const data = await getBranches();
      setBranches(data);
    } catch (e) {
      console.error("Ошибка загрузки филиалов", e);
    }
  };

  useEffect(() => {
    loadEmployees();
    loadBranches();
  }, []);

  /* ---------- POSITIONS (CRM-логика) ---------- */
  const allPositions = useMemo(() => {
    const set = new Set();
    employees.forEach((e) => {
      if (e.position) set.add(e.position.trim());
    });
    return Array.from(set);
  }, [employees]);

  /* ---------- FILTER + SORT ---------- */
  const filteredEmployees = useMemo(() => {
    return employees
      .filter((emp) => {
        const matchName = (emp.name || "")
          .toLowerCase()
          .includes(search.toLowerCase());

        const matchBranch =
          !branchFilter ||
          emp.branches?.some((b) => String(b.id) === String(branchFilter));

        return matchName && matchBranch;
      })
      .sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", "ru", {
          sensitivity: "base",
        })
      );
  }, [employees, search, branchFilter]);

  /* ---------- ACTIONS ---------- */
  const openCreate = () => {
    setSelectedEmployee(null);
    setIsPanelOpen(true);
  };

  const openEdit = (employee) => {
    setSelectedEmployee(employee);
    setIsPanelOpen(true);
  };

  const closePanel = () => {
    setIsPanelOpen(false);
    setSelectedEmployee(null);
  };

  const handleDelete = async (employee) => {
    if (!window.confirm("Удалить сотрудника?")) return;

    try {
      await deleteEmployee(employee.id);
      loadEmployees();
    } catch (e) {
      console.error("Ошибка удаления", e);
    }
  };

  /* ---------- DARK FILTER STYLES (как у филиалов) ---------- */
  const darkControlBase = {
    padding: "9px 12px",
    borderRadius: 10,
    border: "1px solid var(--border-input)",
    background: "var(--bg-input)",
    color: "var(--text-primary)",
    outline: "none",
    fontSize: 13,
  };

  /* ---------- RENDER ---------- */
  return (
    <div style={{ padding: 24 }}>
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 16,
          gap: 12,
        }}
      >
        <NeoSegmented
          value={view}
          onChange={setView}
          options={[
            { value: "cards", label: "Карточки" },
            { value: "table", label: "Таблица" },
          ]}
        />

        <button
          onClick={openCreate}
          style={{
            padding: "10px 16px",
            borderRadius: 12,
            border: "none",
            background: "#6C5CE7",
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          + Добавить сотрудника
        </button>
      </div>

      {/* FILTERS (ТОЛЬКО ВИД, ЛОГИКУ НЕ ТРОГАЕМ) */}
      <div
        className="employees-filters"
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 20,
          alignItems: "center",
        }}
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по фамилии"
          style={{
            ...darkControlBase,
            flex: 1,
            minWidth: 280,
          }}
        />

        <select
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          style={{
            ...darkControlBase,
            minWidth: 180, // чтобы не был “квадратиком”
          }}
        >
          <option value="">Все филиалы</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {/* CONTENT */}
      {loading ? (
        <SkeletonCardGrid count={6} minW={260} gap={16} />
      ) : filteredEmployees.length === 0 ? (
        employees.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            title="Пока нет сотрудников"
            subtitle="Добавьте первого сотрудника — потом можно ставить ему смены и назначать на записи клиентов."
            action={{ label: "+ Добавить сотрудника", onClick: openCreate }}
          />
        ) : (
          <EmptyState
            icon={UsersIcon}
            title="Никого не нашлось"
            subtitle="Попробуйте изменить поиск или фильтр по филиалу."
          />
        )
      ) : view === "cards" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          {filteredEmployees.map((emp) => (
            <NeoEmployeeCard
              key={emp.id}
              employee={emp}
              onClick={() => openEdit(emp)}
              onEdit={() => openEdit(emp)}
              onDelete={() => handleDelete(emp)}
            />
          ))}
        </div>
      )}

      {view === "table" && (
        <NeoEmployeeTable
          employees={filteredEmployees}
          onEdit={openEdit}
          onDelete={handleDelete}
        />
      )}

      {/* SIDE PANEL */}
      {isPanelOpen && (
        <EmployeeSidePanel
          employee={selectedEmployee}
          branches={branches} // ✅ ВСЕ филиалы из /branches
          services={services}
          allPositions={allPositions}
          onClose={closePanel}
          onSaved={async (form) => {
            try {
              let saved;

              // ✅ 1) сохраняем самого сотрудника
              if (selectedEmployee?.id) {
                saved = await updateEmployee(selectedEmployee.id, form);
              } else {
                saved = await createEmployee(form);
              }

              const employeeId = saved?.id || selectedEmployee?.id;

              // ✅ 2) сохраняем связи сотрудник–филиалы
              await updateEmployeeBranches(employeeId, form.branches || []);

              closePanel();
              loadEmployees();
            } catch (e) {
              console.error("Ошибка сохранения сотрудника", e);
              toast.error("Не удалось сохранить сотрудника");
            }
          }}
        />
      )}
    </div>
  );
}
// frontend2/src/business-panel/Schedule/FilterPanel.jsx
import React from "react";

export default function FilterPanel({
  viewMode,
  onChangeViewMode,
  branchId,
  onChangeBranchId,
  employeeId,
  onChangeEmployeeId,
  branches = [],
  employees = [],
}) {
  const safeOnChangeViewMode = typeof onChangeViewMode === "function" ? onChangeViewMode : () => {};
  const safeOnChangeBranchId = typeof onChangeBranchId === "function" ? onChangeBranchId : () => {};
  const safeOnChangeEmployeeId = typeof onChangeEmployeeId === "function" ? onChangeEmployeeId : () => {};

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* View mode */}
      <div className="flex rounded-xl overflow-hidden border border-white/10 bg-white/5">
        {["day", "week", "month"].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => safeOnChangeViewMode(m)}
            className={[
              "px-3 py-2 text-sm",
              viewMode === m ? "bg-white/15" : "hover:bg-white/10",
            ].join(" ")}
          >
            {m === "day" ? "День" : m === "week" ? "Неделя" : "Месяц"}
          </button>
        ))}
      </div>

      {/* Branch */}
      <select
        className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-sm"
        value={branchId ?? ""}
        onChange={(e) => safeOnChangeBranchId(e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">Все филиалы</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>

      {/* Employee */}
      <select
        className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-sm"
        value={employeeId ?? ""}
        onChange={(e) => safeOnChangeEmployeeId(e.target.value ? Number(e.target.value) : null)}
        disabled={!employees.length}
      >
        <option value="">Все сотрудники</option>
        {employees.map((emp) => (
          <option key={emp.id} value={emp.id}>
            {emp.last_name ? `${emp.last_name} ${emp.first_name || ""}`.trim() : emp.name}
          </option>
        ))}
      </select>
    </div>
  );
}

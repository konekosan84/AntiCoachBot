import React, { useEffect, useMemo, useState, useCallback } from "react";

import { getShifts } from "../api/schedule.js";
import { apiFetch } from "../api/apiFetch.js";
import { todayYmd, weekDatesFromAnchor, toYmd, addDaysYmd } from "./Schedule/scheduleDate.js";

import ScheduleDayGrid from "./Schedule/ScheduleDayGrid.jsx";
import ScheduleWeekGrid from "./Schedule/ScheduleWeekGrid.jsx";
import ScheduleMonthGrid from "./Schedule/ScheduleMonthGrid.jsx";
import ShiftSidePanel from "./Schedule/ShiftSidePanel.jsx";

const BRANCH_ENDPOINTS = ["/api/v1/branches"];
const EMPLOYEE_ENDPOINTS = ["/api/v1/employees"];

const fetchJson = apiFetch;

async function tryEndpoints(endpoints) {
  for (const url of endpoints) {
    try {
      const out = await fetchJson(url);
      if (Array.isArray(out)) return out;
      if (out && Array.isArray(out.items)) return out.items;
      if (out && Array.isArray(out.data)) return out.data;
    } catch (_) {}
  }
  return [];
}

function normalizeBranch(b) {
  if (!b) return null;
  const id = Number(b.id ?? b.branch_id ?? b.value);
  if (!Number.isFinite(id)) return null;
  const name = (typeof b.name === "string" && b.name.trim()) ||
    (typeof b.title === "string" && b.title.trim()) ||
    (typeof b.label === "string" && b.label.trim()) || `Филиал #${id}`;
  return { id, name };
}

function normalizeEmployee(e) {
  if (!e) return null;
  const id = Number(e.id ?? e.employee_id ?? e.value);
  if (!Number.isFinite(id)) return null;
  let name = "";
  if (typeof e.name === "string" && e.name.trim()) name = e.name.trim();
  else if (typeof e.full_name === "string" && e.full_name.trim()) name = e.full_name.trim();
  else {
    const first = (typeof e.first_name === "string" ? e.first_name : "") || "";
    const last  = (typeof e.last_name === "string" ? e.last_name : "") || "";
    const combo = `${first} ${last}`.trim();
    name = combo || `Сотрудник #${id}`;
  }
  const branches = Array.isArray(e.branches)
    ? e.branches
        .map(b => ({ id: Number(b?.id ?? b?.branch_id ?? b), name: b?.name }))
        .filter(b => Number.isFinite(b.id))
    : [];
  return { id, name, branches };
}

function uniqById(list) {
  const map = new Map();
  for (const x of list) {
    if (!x) continue;
    if (!Number.isFinite(Number(x.id))) continue;
    map.set(Number(x.id), { ...x, id: Number(x.id) });
  }
  return Array.from(map.values()).sort((a, b) => a.id - b.id);
}

function addPeriod(ymd, view, dir) {
  if (view === "day") return addDaysYmd(ymd, dir);
  if (view === "week") return addDaysYmd(ymd, dir * 7);
  const [y, m, d] = String(ymd).slice(0, 10).split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setMonth(dt.getMonth() + dir);
  return toYmd(dt);
}

async function getBranchEmployees(branchId) {
  return fetchJson(`/api/v1/schedule/branch-employees?branch_id=${encodeURIComponent(branchId)}`);
}

/* ─── shared inline style helpers ─── */
const ctrlStyle = {
  padding: "7px 10px", borderRadius: 10, border: "1px solid var(--border-input)",
  background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13, outline: "none",
};
const btnStyle = {
  padding: "7px 12px", borderRadius: 10, border: "1px solid var(--border)",
  background: "var(--bg-card)", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer",
};
const btnPrimaryStyle = {
  padding: "7px 14px", borderRadius: 10, border: "none",
  background: "linear-gradient(90deg, #3acfd5, #6558f5)",
  color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
};

export default function Schedule() {
  const [view, setView] = useState("week");
  const [anchorDate, setAnchorDate] = useState(todayYmd());
  const [selectedDate, setSelectedDate] = useState(todayYmd());

  const [branches, setBranches] = useState([]);
  const [employeesAll, setEmployeesAll] = useState([]);
  const [employees, setEmployees] = useState([]);

  const [branchId, setBranchId] = useState("all");
  const [employeeId, setEmployeeId] = useState("all");

  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [warn, setWarn] = useState("");

  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState("create");
  const [panelInitial, setPanelInitial] = useState(null);

  const branchNameById = useMemo(() => {
    const m = new Map();
    for (const b of branches) m.set(Number(b.id), b.name);
    return m;
  }, [branches]);

  const loadRefs = useCallback(async () => {
    setErr("");
    try {
      const [bRaw, eRaw] = await Promise.all([
        tryEndpoints(BRANCH_ENDPOINTS),
        tryEndpoints(EMPLOYEE_ENDPOINTS),
      ]);
      const b   = uniqById((bRaw || []).map(normalizeBranch));
      const all = uniqById((eRaw || []).map(normalizeEmployee));
      setBranches(b);
      setEmployeesAll(all);
      setEmployees(all);
    } catch (e) {
      console.error(e);
      setErr(e.message || "Не удалось загрузить справочники");
    }
  }, []);

  useEffect(() => { loadRefs(); }, [loadRefs]);

  useEffect(() => {
    (async () => {
      setWarn("");
      if (!employeesAll || employeesAll.length === 0) { setEmployees([]); return; }
      if (!branchId || branchId === "all") { setEmployees(employeesAll); return; }
      try {
        const raw = await getBranchEmployees(branchId);
        const branchEmps = uniqById((raw || []).map(normalizeEmployee));
        if (!branchEmps || branchEmps.length === 0) {
          setEmployees(employeesAll);
          setWarn("Для этого филиала пока не настроены сотрудники. Показываю всех.");
        } else {
          setEmployees(branchEmps);
          if (employeeId !== "all") {
            const id = Number(employeeId);
            const exists = branchEmps.some(x => Number(x.id) === id);
            if (!exists) setEmployeeId("all");
          }
        }
      } catch (e) {
        console.error(e);
        setEmployees(employeesAll);
        setWarn("Не удалось загрузить сотрудников филиала. Показываю всех.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, employeesAll]);

  const range = useMemo(() => {
    if (view === "day") return { from: selectedDate, to: selectedDate };
    if (view === "week") {
      const dates = weekDatesFromAnchor(anchorDate);
      return { from: dates[0], to: dates[6] };
    }
    const a = toYmd(anchorDate);
    return { from: addDaysYmd(a, -20), to: addDaysYmd(a, 21) };
  }, [view, anchorDate, selectedDate]);

  const reloadShifts = useCallback(async () => {
    setErr("");
    setLoading(true);
    try {
      const data = await getShifts({ date_from: range.from, date_to: range.to, branch_id: branchId, employee_id: employeeId });
      setShifts(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setErr(e.message || "Ошибка загрузки смен");
      setShifts([]);
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, branchId, employeeId]);

  useEffect(() => { reloadShifts(); }, [reloadShifts]);

  const setToday = () => { const t = todayYmd(); setAnchorDate(t); setSelectedDate(t); };

  const onNav = dir => {
    if (view === "day") { setSelectedDate(d => addPeriod(d, "day", dir)); return; }
    setAnchorDate(d => addPeriod(d, view, dir));
  };

  const onChangeView = v => {
    setView(v);
    if (v === "day") setSelectedDate(anchorDate);
    if (v === "week") setAnchorDate(selectedDate);
    if (v === "month") setAnchorDate(selectedDate);
  };

  const openCreate = useCallback(({ date, employee_id, branch_id }) => {
    setPanelMode("create");
    setPanelInitial({
      date: String(date).slice(0, 10),
      employee_id: employee_id ?? (employeeId !== "all" ? Number(employeeId) : ""),
      branch_id: branch_id ?? (branchId !== "all" ? Number(branchId) : ""),
      start_time: "10:00", end_time: "18:00", notes: "",
    });
    setPanelOpen(true);
  }, [branchId, employeeId]);

  const openEdit = useCallback(shift => {
    setPanelMode("edit");
    setPanelInitial({ ...shift, date: String(shift.date).slice(0, 10), notes: shift.notes ?? "" });
    setPanelOpen(true);
  }, []);

  const weekDates = useMemo(() => weekDatesFromAnchor(anchorDate), [anchorDate]);

  const visibleEmployees = useMemo(() => {
    if (employeeId && employeeId !== "all") {
      const id = Number(employeeId);
      return employees.filter(x => Number(x.id) === id);
    }
    return employees;
  }, [employees, employeeId]);

  const onAddGlobal = () => {
    const date = view === "day" ? selectedDate : anchorDate;
    openCreate({ date, employee_id: null, branch_id: null });
  };

  return (
    <div style={{ position: "relative" }}>
      {/* ── TOOLBAR ── */}
      <div style={{
        padding: "12px 16px", display: "flex", flexWrap: "wrap", gap: 10,
        alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid var(--border)",
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
            Расписание
            {loading && <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 400 }}>загрузка…</span>}
          </div>
          {err  && <div style={{ fontSize: 12, color: "#fca5a5", marginTop: 2 }}>{err}</div>}
          {warn && <div style={{ fontSize: 12, color: "#fde68a", marginTop: 2 }}>{warn}</div>}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <select style={ctrlStyle} value={view} onChange={e => onChangeView(e.target.value)}>
            <option value="day">День</option>
            <option value="week">Неделя</option>
            <option value="month">Месяц</option>
          </select>

          <button style={btnStyle} onClick={() => onNav(-1)} title="Назад">‹</button>

          <input
            type="date"
            style={ctrlStyle}
            value={view === "day" ? selectedDate : anchorDate}
            onChange={e => {
              const v = e.target.value;
              if (view === "day") setSelectedDate(v); else setAnchorDate(v);
            }}
          />

          <button style={btnStyle} onClick={() => onNav(1)} title="Вперёд">›</button>

          <button style={btnStyle} onClick={setToday}>Сегодня</button>

          <select style={ctrlStyle} value={branchId} onChange={e => setBranchId(e.target.value)}>
            <option value="all">Все филиалы</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>

          <select style={ctrlStyle} value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
            <option value="all">Все сотрудники</option>
            {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
          </select>

          <button style={btnStyle} onClick={reloadShifts}>Обновить</button>

          <button style={btnPrimaryStyle} onClick={onAddGlobal}>+ Добавить смену</button>
        </div>
      </div>

      {/* ── GRIDS ── */}
      {view === "day" && (
        <ScheduleDayGrid
          date={selectedDate}
          employees={visibleEmployees}
          shifts={shifts}
          branchNameById={branchNameById}
          onAddShift={openCreate}
          onShiftClick={openEdit}
        />
      )}
      {view === "week" && (
        <ScheduleWeekGrid
          dates={weekDates}
          employees={visibleEmployees}
          shifts={shifts}
          branchNameById={branchNameById}
          onAddShift={openCreate}
          onShiftClick={openEdit}
        />
      )}
      {view === "month" && (
        <ScheduleMonthGrid
          anchorDate={anchorDate}
          shifts={shifts}
          branchId={branchId}
          branchNameById={branchNameById}
          onPickDate={d => { setSelectedDate(d); setAnchorDate(d); setView("day"); }}
        />
      )}

      <ShiftSidePanel
        open={panelOpen}
        mode={panelMode}
        initial={panelInitial}
        branches={branches}
        employees={employees}
        onClose={() => setPanelOpen(false)}
        onSaved={reloadShifts}
      />

    </div>
  );
}

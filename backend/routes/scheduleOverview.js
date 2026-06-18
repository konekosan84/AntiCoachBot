// backend/routes/scheduleOverview.js
import express from "express";
import { pool } from "../db.js";

const router = express.Router();

function isYmd(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function safeInt(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}
function toMinutes(t) {
  if (t === null || t === undefined) return null;
  const s = String(t).trim();
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}
function overlapMinutes(aStart, aEnd, bStart, bEnd) {
  const s = Math.max(aStart, bStart);
  const e = Math.min(aEnd, bEnd);
  return Math.max(0, e - s);
}
function minutesToHours(min) {
  return Math.round((min / 60) * 100) / 100;
}
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}
function diffDaysInclusive(dateFromYmd, dateToYmd) {
  const a = new Date(`${dateFromYmd}T00:00:00`);
  const b = new Date(`${dateToYmd}T00:00:00`);
  const ms = b.getTime() - a.getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
  return Number.isFinite(days) && days > 0 ? days : 1;
}

async function buildOverview({ branchId, dateFrom, dateTo, employeeId, allBranches }) {
  const daysCount = diffDaysInclusive(dateFrom, dateTo);
  const periodFactor = daysCount / 7;

  // branches map (для подписей в ALL)
  const branches = (
    await pool.query(
      `
      SELECT id, name, status, weekly_hours_default
      FROM branches
      WHERE status = 'active' OR status IS NULL
      ORDER BY id ASC
      `
    )
  ).rows;

  // EMPLOYEES: либо по branchId, либо по всем филиалам
  const employeesSql = allBranches
    ? `
      SELECT DISTINCT
        e.id,
        e.name,
        e.phone,
        e.email,
        e.position,
        e.role,
        e.status,
        e.weekly_hours_norm,
        COALESCE(e.weekly_hours_norm, 40) AS weekly_norm_hours
      FROM branch_employees be
      JOIN employees e ON e.id = be.employee_id
      WHERE e.status = 'active'
        ${employeeId ? "AND e.id = $1" : ""}
      ORDER BY e.name ASC, e.id ASC
    `
    : `
      SELECT
        e.id,
        e.name,
        e.phone,
        e.email,
        e.position,
        e.role,
        e.status,
        e.weekly_hours_norm,
        b.weekly_hours_default AS branch_weekly_hours_default,
        COALESCE(e.weekly_hours_norm, b.weekly_hours_default, 40) AS weekly_norm_hours
      FROM branch_employees be
      JOIN employees e ON e.id = be.employee_id
      JOIN branches b ON b.id = be.branch_id
      WHERE be.branch_id = $1
        AND e.status = 'active'
        ${employeeId ? "AND e.id = $2" : ""}
      ORDER BY e.name ASC, e.id ASC
    `;

  const employeesParams = allBranches
    ? employeeId
      ? [employeeId]
      : []
    : employeeId
      ? [branchId, employeeId]
      : [branchId];

  const employees = (await pool.query(employeesSql, employeesParams)).rows;
  const employeeIds = employees.map((e) => e.id);

  // SHIFTS
  const shiftsSql = allBranches
    ? `
      SELECT
        id,
        branch_id,
        employee_id,
        to_char(shift_date, 'YYYY-MM-DD') AS shift_date,
        to_char(start_time, 'HH24:MI') AS start_time,
        to_char(end_time, 'HH24:MI') AS end_time,
        status,
        note,
        comment
      FROM shifts
      WHERE shift_date BETWEEN $1::date AND $2::date
        AND employee_id = ANY($3::int[])
      ORDER BY shift_date ASC, employee_id ASC, branch_id ASC, start_time ASC
    `
    : `
      SELECT
        id,
        branch_id,
        employee_id,
        to_char(shift_date, 'YYYY-MM-DD') AS shift_date,
        to_char(start_time, 'HH24:MI') AS start_time,
        to_char(end_time, 'HH24:MI') AS end_time,
        status,
        note,
        comment
      FROM shifts
      WHERE branch_id = $1
        AND shift_date BETWEEN $2::date AND $3::date
        AND employee_id = ANY($4::int[])
      ORDER BY shift_date ASC, employee_id ASC, start_time ASC
    `;

  const shiftsParams = allBranches
    ? [dateFrom, dateTo, employeeIds]
    : [branchId, dateFrom, dateTo, employeeIds];

  const shifts = employeeIds.length ? (await pool.query(shiftsSql, shiftsParams)).rows : [];

  // BOOKINGS (пока чисто для свободно/конфликтов записи вне смены)
  // В ALL-режиме тоже суммируем по всем филиалам
  const bookingsSql = allBranches
    ? `
      SELECT
        id,
        client_id,
        employee_id,
        service_id,
        branch_id,
        to_char(date, 'YYYY-MM-DD') AS date,
        start_time,
        end_time,
        price,
        status
      FROM bookings
      WHERE date BETWEEN $1::date AND $2::date
        AND (employee_id = ANY($3::int[]) OR employee_id IS NULL)
        AND (status IS NULL OR status <> 'cancelled')
      ORDER BY date ASC, employee_id NULLS LAST, start_time ASC
    `
    : `
      SELECT
        id,
        client_id,
        employee_id,
        service_id,
        branch_id,
        to_char(date, 'YYYY-MM-DD') AS date,
        start_time,
        end_time,
        price,
        status
      FROM bookings
      WHERE branch_id = $1
        AND date BETWEEN $2::date AND $3::date
        AND (employee_id = ANY($4::int[]) OR employee_id IS NULL)
        AND (status IS NULL OR status <> 'cancelled')
      ORDER BY date ASC, employee_id NULLS LAST, start_time ASC
    `;

  const bookingsParams = allBranches
    ? [dateFrom, dateTo, employeeIds]
    : [branchId, dateFrom, dateTo, employeeIds];

  const bookings = employeeIds.length ? (await pool.query(bookingsSql, bookingsParams)).rows : [];

  // ---- stats ----
  const shiftsByEmpDay = new Map();
  const perEmployee = new Map();

  for (const e of employees) {
    const weekly = Number(e.weekly_norm_hours) || 40;
    perEmployee.set(e.id, {
      employee_id: e.id,
      weekly_norm_hours: weekly,
      weekly_norm_hours_for_period: Math.round((weekly * periodFactor) * 100) / 100,

      bookings_count: 0,
      shifts_count: 0,

      minutes_shift_total: 0,
      minutes_busy_total: 0,
      minutes_busy_inside_shift: 0,

      conflicts_outside_shift: 0,
      conflicts_shift_overlaps: 0,
    });
  }

  let shiftsCount = 0;
  let bookingsCount = 0;

  let minutesShiftTotal = 0;
  let minutesBusyTotal = 0;
  let minutesBusyInsideShift = 0;

  let shiftOverlapConflicts = 0;
  let bookingOutsideShiftConflicts = 0;

  for (const s of shifts) {
    const empId = s.employee_id;
    const ymd = s.shift_date;
    const st = toMinutes(s.start_time);
    const en = toMinutes(s.end_time);
    if (st === null || en === null || en <= st) continue;

    shiftsCount += 1;
    minutesShiftTotal += (en - st);

    const key = `${empId}|${ymd}`;
    if (!shiftsByEmpDay.has(key)) shiftsByEmpDay.set(key, []);
    shiftsByEmpDay.get(key).push([st, en, s.id]);

    const emp = perEmployee.get(empId);
    if (emp) {
      emp.shifts_count += 1;
      emp.minutes_shift_total += (en - st);
    }
  }

  // overlaps (в ALL учитывает межфилиальные пересечения тоже, что нам и надо)
  for (const [key, arr] of shiftsByEmpDay.entries()) {
    arr.sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < arr.length; i++) {
      const prev = arr[i - 1];
      const cur = arr[i];
      if (cur[0] < prev[1]) {
        shiftOverlapConflicts += 1;
        const empId = Number(key.split("|")[0]);
        const emp = perEmployee.get(empId);
        if (emp) emp.conflicts_shift_overlaps += 1;
      }
    }
  }

  // bookings inside/outside shift
  for (const b of bookings) {
    if (!b.employee_id) continue;

    const empId = b.employee_id;
    const ymd = b.date;
    const st = toMinutes(b.start_time);
    const en = toMinutes(b.end_time);
    if (st === null || en === null || en <= st) continue;

    bookingsCount += 1;
    minutesBusyTotal += (en - st);

    const emp = perEmployee.get(empId);
    if (emp) {
      emp.bookings_count += 1;
      emp.minutes_busy_total += (en - st);
    }

    const key = `${empId}|${ymd}`;
    const shiftIntervals = shiftsByEmpDay.get(key) || [];

    let inside = 0;
    for (const [ss, ee] of shiftIntervals) {
      inside += overlapMinutes(st, en, ss, ee);
    }

    minutesBusyInsideShift += inside;
    if (emp) emp.minutes_busy_inside_shift += inside;

    const outside = (en - st) - inside;
    if (outside > 0) {
      bookingOutsideShiftConflicts += 1;
      if (emp) emp.conflicts_outside_shift += 1;
    }
  }

  const minutesBlocked = 0; // “блоки” пока не внедряли
  const minutesFree = clamp(minutesShiftTotal - minutesBusyInsideShift - minutesBlocked, 0, Number.MAX_SAFE_INTEGER);

  // target hours for period
  let hoursTargetTotal = 0;
  for (const e of employees) {
    const weekly = Number(e.weekly_norm_hours) || 40;
    hoursTargetTotal += weekly * periodFactor;
  }
  hoursTargetTotal = Math.round(hoursTargetTotal * 100) / 100;

  const hoursShiftTotal = minutesToHours(minutesShiftTotal);
  const hoursDeltaTotal = Math.round((hoursShiftTotal - hoursTargetTotal) * 100) / 100;

  const stats = {
    mode: allBranches ? "all" : "branch",
    branch_id: allBranches ? null : branchId,
    date_from: dateFrom,
    date_to: dateTo,
    days_count: daysCount,

    employees_active: employees.length,
    shifts_count: shiftsCount,
    bookings_count: bookingsCount,

    conflicts_shift_overlaps: shiftOverlapConflicts,
    conflicts_bookings_outside_shift: bookingOutsideShiftConflicts,
    conflicts_count: shiftOverlapConflicts + bookingOutsideShiftConflicts,

    hours_total: hoursShiftTotal,
    hours_busy_total: minutesToHours(minutesBusyTotal),
    hours_busy_inside_shift: minutesToHours(minutesBusyInsideShift),
    hours_blocked: minutesToHours(minutesBlocked),
    hours_free: minutesToHours(minutesFree),

    hours_target_total: hoursTargetTotal,
    hours_delta_total: hoursDeltaTotal,
  };

  const per_employee = Array.from(perEmployee.values()).map((x) => {
    const hours_shift_total = minutesToHours(x.minutes_shift_total);
    const delta_hours = Math.round((hours_shift_total - (x.weekly_norm_hours_for_period || 0)) * 100) / 100;
    return {
      ...x,
      hours_shift_total,
      hours_busy_total: minutesToHours(x.minutes_busy_total),
      hours_busy_inside_shift: minutesToHours(x.minutes_busy_inside_shift),
      delta_hours,
    };
  });

  return { branches, employees, shifts, bookings, stats, per_employee };
}

/**
 * GET /api/v1/schedule/overview?branch_id=1&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD&employee_id=...
 */
router.get("/overview", async (req, res) => {
  try {
    const branchId = safeInt(req.query.branch_id);
    const dateFrom = req.query.date_from;
    const dateTo = req.query.date_to;
    const employeeId = safeInt(req.query.employee_id);

    if (!branchId) return res.status(400).json({ error: "branch_id is required (number)" });
    if (!isYmd(dateFrom) || !isYmd(dateTo)) return res.status(400).json({ error: "date_from/date_to must be YYYY-MM-DD" });

    const data = await buildOverview({ branchId, dateFrom, dateTo, employeeId, allBranches: false });
    res.json(data);
  } catch (e) {
    console.error("schedule/overview error:", e);
    res.status(500).json({ error: "Failed to build schedule overview" });
  }
});

/**
 * GET /api/v1/schedule/overview-all?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD&employee_id=...
 */
router.get("/overview-all", async (req, res) => {
  try {
    const dateFrom = req.query.date_from;
    const dateTo = req.query.date_to;
    const employeeId = safeInt(req.query.employee_id);

    if (!isYmd(dateFrom) || !isYmd(dateTo)) return res.status(400).json({ error: "date_from/date_to must be YYYY-MM-DD" });

    const data = await buildOverview({ branchId: null, dateFrom, dateTo, employeeId, allBranches: true });
    res.json(data);
  } catch (e) {
    console.error("schedule/overview-all error:", e);
    res.status(500).json({ error: "Failed to build schedule overview (all)" });
  }
});

export default router;

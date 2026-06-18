/**
 * CSV-выгрузка сущностей в формате Excel-совместимом.
 *
 * GET /clients
 * GET /bookings
 * GET /services
 * GET /branches
 * GET /employees
 *
 * Query: ?from=YYYY-MM-DD&to=YYYY-MM-DD (для bookings).
 */
import express from "express";
import pool from "../db.js";

const router = express.Router();

function csvEscape(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[";\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function rowsToCsv(rows, columns) {
  const header = columns.map(c => csvEscape(c.label)).join(";");
  const body = rows.map(r => columns.map(c => csvEscape(typeof c.get === "function" ? c.get(r) : r[c.key])).join(";")).join("\r\n");
  return "﻿" + header + "\r\n" + body; // BOM for Excel
}

function send(res, filename, csv) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
}

function fmtDate(v) { return v ? String(v).slice(0, 10) : ""; }
function fmtTime(v) { return v ? String(v).slice(0, 5) : ""; }
function fmtPhone(p) {
  const d = String(p || "").replace(/\D/g, "");
  if (d.length !== 11) return p || "";
  return `+${d[0]} (${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7,9)}-${d.slice(9)}`;
}

/* ─── Clients ─── */
router.get("/clients", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.id, c.full_name, c.phone, c.email,
             TO_CHAR(c.birthday, 'YYYY-MM-DD') AS birthday,
             c.status, c.source, c.notes,
             br.name AS created_branch_name,
             TO_CHAR(c.created_at, 'YYYY-MM-DD HH24:MI') AS created_at
        FROM clients c
   LEFT JOIN branches br ON br.id = c.created_branch_id
    ORDER BY c.id DESC
    `);

    const csv = rowsToCsv(rows, [
      { key: "id",                  label: "ID" },
      { key: "full_name",           label: "ФИО" },
      { key: "phone",               label: "Телефон", get: r => fmtPhone(r.phone) },
      { key: "email",               label: "Email" },
      { key: "birthday",            label: "Дата рождения" },
      { key: "status",              label: "Статус" },
      { key: "source",              label: "Источник" },
      { key: "created_branch_name", label: "Филиал создания" },
      { key: "notes",               label: "Заметки" },
      { key: "created_at",          label: "Создан" },
    ]);
    send(res, `clients_${new Date().toISOString().slice(0,10)}.csv`, csv);
  } catch (e) {
    console.error("export /clients:", e);
    res.status(500).send("ERROR");
  }
});

/* ─── Bookings ─── */
router.get("/bookings", async (req, res) => {
  try {
    const { from, to } = req.query;
    const where = [];
    const params = [];
    if (from) { params.push(from); where.push(`b.date >= $${params.length}`); }
    if (to)   { params.push(to);   where.push(`b.date <= $${params.length}`); }
    const sql = `
      SELECT b.id,
             TO_CHAR(b.date, 'YYYY-MM-DD') AS date,
             b.start_time, b.end_time,
             COALESCE(NULLIF(b.status,''),'booked') AS status,
             b.price, b.notes,
             c.full_name AS client_name, c.phone AS client_phone,
             s.name AS service_name,
             e.name AS employee_name,
             br.name AS branch_name
        FROM bookings b
   LEFT JOIN clients   c  ON c.id  = b.client_id
   LEFT JOIN services  s  ON s.id  = b.service_id
   LEFT JOIN employees e  ON e.id  = b.employee_id
   LEFT JOIN branches  br ON br.id = b.branch_id
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY b.date DESC, b.start_time DESC
    `;
    const { rows } = await pool.query(sql, params);

    const csv = rowsToCsv(rows, [
      { key: "id",            label: "ID" },
      { key: "date",          label: "Дата" },
      { key: "start_time",    label: "Начало", get: r => fmtTime(r.start_time) },
      { key: "end_time",      label: "Конец",  get: r => fmtTime(r.end_time)   },
      { key: "client_name",   label: "Клиент" },
      { key: "client_phone",  label: "Телефон", get: r => fmtPhone(r.client_phone) },
      { key: "service_name",  label: "Услуга" },
      { key: "employee_name", label: "Мастер" },
      { key: "branch_name",   label: "Филиал" },
      { key: "status",        label: "Статус" },
      { key: "price",         label: "Цена" },
      { key: "notes",         label: "Комментарий" },
    ]);
    send(res, `bookings_${new Date().toISOString().slice(0,10)}.csv`, csv);
  } catch (e) {
    console.error("export /bookings:", e);
    res.status(500).send("ERROR");
  }
});

/* ─── Services ─── */
router.get("/services", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.id, s.name, s.price, s.duration, s.description, s.is_active,
             COALESCE(
               (SELECT string_agg(b.name, ', ')
                  FROM service_branches sb
                  JOIN branches b ON b.id = sb.branch_id
                 WHERE sb.service_id = s.id),
               'Все филиалы'
             ) AS branches
        FROM services s
    ORDER BY s.id
    `);
    const csv = rowsToCsv(rows, [
      { key: "id",          label: "ID" },
      { key: "name",        label: "Название" },
      { key: "price",       label: "Цена" },
      { key: "duration",    label: "Длительность (мин)" },
      { key: "branches",    label: "Доступна в филиалах" },
      { key: "is_active",   label: "Активна", get: r => r.is_active ? "Да" : "Нет" },
      { key: "description", label: "Описание" },
    ]);
    send(res, `services_${new Date().toISOString().slice(0,10)}.csv`, csv);
  } catch (e) {
    console.error("export /services:", e);
    res.status(500).send("ERROR");
  }
});

/* ─── Branches ─── */
router.get("/branches", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, name, address, phone, status, description_client
        FROM branches
    ORDER BY id
    `);
    const csv = rowsToCsv(rows, [
      { key: "id",                 label: "ID" },
      { key: "name",               label: "Название" },
      { key: "address",            label: "Адрес" },
      { key: "phone",              label: "Телефон" },
      { key: "status",             label: "Статус" },
      { key: "description_client", label: "Описание" },
    ]);
    send(res, `branches_${new Date().toISOString().slice(0,10)}.csv`, csv);
  } catch (e) {
    console.error("export /branches:", e);
    res.status(500).send("ERROR");
  }
});

/* ─── Employees ─── */
router.get("/employees", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT e.id, e.name, e.phone, e.email, e.position, e.role, e.status,
             COALESCE(
               (SELECT string_agg(b.name, ', ')
                  FROM branch_employees be
                  JOIN branches b ON b.id = be.branch_id
                 WHERE be.employee_id = e.id),
               ''
             ) AS branches
        FROM employees e
    ORDER BY e.id
    `);
    const csv = rowsToCsv(rows, [
      { key: "id",         label: "ID" },
      { key: "name",       label: "ФИО" },
      { key: "phone",      label: "Телефон", get: r => fmtPhone(r.phone) },
      { key: "email",      label: "Email" },
      { key: "position",   label: "Должность" },
      { key: "role",       label: "Роль" },
      { key: "status",     label: "Статус" },
      { key: "branches",   label: "Филиалы" },
    ]);
    send(res, `employees_${new Date().toISOString().slice(0,10)}.csv`, csv);
  } catch (e) {
    console.error("export /employees:", e);
    res.status(500).send("ERROR");
  }
});

export default router;

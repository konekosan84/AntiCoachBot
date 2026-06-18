import express from "express";
import { pool } from "../db.js";

const router = express.Router();

function isYmd(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function isTime(s) {
  return typeof s === "string" && /^\d{2}:\d{2}$/.test(s);
}

async function resolveBranchId(raw) {
  // raw может быть "3", 3, "all", или "Серый" если фронт внезапно так шлёт
  if (raw == null) return null;
  const str = String(raw).trim();
  if (!str || str === "all") return null;

  const asNum = Number(str);
  if (Number.isInteger(asNum)) return asNum;

  // пробуем как имя филиала
  const { rows } = await pool.query(
    `SELECT id FROM branches WHERE lower(name) = lower($1::text) LIMIT 1`,
    [str]
  );
  return rows[0]?.id ?? null;
}

/**
 * Пересечение смен для одного сотрудника на одну дату запрещено.
 */
async function findOverlap({ employee_id, date, start_time, end_time, exclude_id = null }) {
  const params = [Number(employee_id), date, start_time, end_time];
  let sql = `
    SELECT
      s.id,
      s.branch_id,
      s.employee_id,
      to_char(s.date,'YYYY-MM-DD') as date,
      s.start_time,
      s.end_time,
      COALESCE(s.notes,'') as notes
    FROM schedule_shifts s
    WHERE s.employee_id = $1::int
      AND s.date = $2::date
      AND NOT (s.end_time <= $3::text OR s.start_time >= $4::text)
  `;

  if (exclude_id != null) {
    sql += ` AND s.id <> $5::int`;
    params.push(Number(exclude_id));
  }

  sql += ` ORDER BY s.start_time ASC LIMIT 1`;

  const { rows } = await pool.query(sql, params);
  return rows[0] || null;
}

/**
 * Сотрудники филиала через employee_branches (который мы синхронизировали из employees_branches)
 * GET /api/v1/schedule/branch-employees?branch_id=1
 * GET /api/v1/schedule/branch-employees?branch_id=Серый   (тоже поймём)
 */
router.get("/branch-employees", async (req, res) => {
  try {
    const bid = await resolveBranchId(req.query.branch_id);

    if (!Number.isInteger(bid)) {
      return res.status(400).json({
        error: "BAD_BRANCH_ID",
        message:
          "branch_id должен быть числом (id филиала). Если прислали имя филиала и оно не найдено, вернём эту ошибку.",
        got: req.query.branch_id,
      });
    }

    const sql = `
      SELECT
        e.id,
        COALESCE(NULLIF(TRIM(COALESCE(e.name,'')), ''), ('Сотрудник #' || e.id)) AS name
      FROM employee_branches eb
      JOIN employees e ON e.id = eb.employee_id
      WHERE eb.branch_id = $1::int
        AND eb.is_active = TRUE
      ORDER BY e.id ASC
    `;
    const { rows } = await pool.query(sql, [bid]);

    res.json(rows);
  } catch (e) {
    console.error("GET /schedule/branch-employees error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/shifts", async (req, res) => {
  try {
    const { date_from, date_to, employee_id } = req.query;
    const bid = await resolveBranchId(req.query.branch_id);

    if (!isYmd(date_from) || !isYmd(date_to)) {
      return res.status(400).json({
        error: "date_from and date_to are required and must be YYYY-MM-DD",
      });
    }

    const where = [`s.date >= $1::date`, `s.date <= $2::date`];
    const params = [date_from, date_to];
    let idx = 3;

    if (Number.isInteger(bid)) {
      where.push(`s.branch_id = $${idx}::int`);
      params.push(bid);
      idx += 1;
    }

    if (employee_id && String(employee_id) !== "all") {
      where.push(`s.employee_id = $${idx}::int`);
      params.push(Number(employee_id));
      idx += 1;
    }

    const sql = `
      SELECT
        s.id,
        s.branch_id,
        s.employee_id,
        to_char(s.date,'YYYY-MM-DD') as date,
        s.start_time,
        s.end_time,
        s.series_id,
        COALESCE(s.notes,'') as notes
      FROM schedule_shifts s
      WHERE ${where.join(" AND ")}
      ORDER BY s.date ASC, s.start_time ASC, s.employee_id ASC
    `;

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error("GET /schedule/shifts error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /schedule/shifts/:id/series — meta for the shift's series (used when editing).
 * Returns: { series_id, total, first_date, last_date, weekdays:[0..6] }
 */
router.get("/shifts/:id/series", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
    const { rows } = await pool.query(
      `SELECT series_id FROM schedule_shifts WHERE id=$1::int LIMIT 1`,
      [id]
    );
    if (!rows.length || rows[0].series_id == null) return res.json({ series_id: null });
    const sid = rows[0].series_id;
    const r2 = await pool.query(
      `SELECT COUNT(*)::int AS total,
              to_char(MIN(date),'YYYY-MM-DD') AS first_date,
              to_char(MAX(date),'YYYY-MM-DD') AS last_date,
              array_agg(DISTINCT (EXTRACT(ISODOW FROM date)::int - 1)) AS weekdays
         FROM schedule_shifts WHERE series_id=$1`,
      [sid]
    );
    res.json({ series_id: sid, ...r2.rows[0] });
  } catch (e) {
    console.error("GET series error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /schedule/shifts — create one shift OR a series.
 *
 * Body (single):
 *   { branch_id, employee_id, date, start_time, end_time, notes? }
 *
 * Body (series):
 *   { branch_id, employee_id, start_time, end_time, notes?,
 *     repeat: { weekdays: [0..6], date_from: 'YYYY-MM-DD', date_to: 'YYYY-MM-DD' } }
 *
 * Returns for single: created shift.
 * Returns for series: { series_id, created, skipped, conflicts: [{date, reason}] }
 */
router.post("/shifts", async (req, res) => {
  const db = await pool.connect();
  try {
    const { branch_id, employee_id, date, start_time, end_time, notes, repeat } = req.body;

    if (!Number.isInteger(Number(branch_id)) || !Number.isInteger(Number(employee_id))) {
      return res.status(400).json({ error: "branch_id and employee_id must be integers" });
    }
    if (!isTime(start_time) || !isTime(end_time)) {
      return res.status(400).json({ error: "start_time and end_time must be HH:MM" });
    }
    if (end_time <= start_time) {
      return res.status(400).json({ error: "end_time must be later than start_time" });
    }

    // ── SINGLE SHIFT ────────────────────────────────────────────────
    if (!repeat) {
      if (!isYmd(date)) return res.status(400).json({ error: "date must be YYYY-MM-DD" });

      const overlap = await findOverlap({ employee_id, date, start_time, end_time });
      if (overlap) {
        return res.status(409).json({
          error: "SHIFT_OVERLAP",
          message: `Пересечение со сменой #${overlap.id} ${overlap.start_time}-${overlap.end_time}`,
          overlap,
        });
      }

      const { rows } = await db.query(`
        INSERT INTO schedule_shifts (branch_id, employee_id, date, start_time, end_time, notes)
        VALUES ($1::int, $2::int, $3::date, $4::text, $5::text, $6::text)
        RETURNING id, branch_id, employee_id, to_char(date,'YYYY-MM-DD') as date,
                  start_time, end_time, series_id, COALESCE(notes,'') as notes
      `, [Number(branch_id), Number(employee_id), date, start_time, end_time, notes == null ? "" : String(notes)]);

      return res.status(201).json(rows[0]);
    }

    // ── SERIES ──────────────────────────────────────────────────────
    const { weekdays, date_from, date_to } = repeat || {};
    if (!Array.isArray(weekdays) || weekdays.length === 0) {
      return res.status(400).json({ error: "repeat.weekdays must be non-empty array" });
    }
    if (!isYmd(date_from) || !isYmd(date_to)) {
      return res.status(400).json({ error: "repeat.date_from / date_to must be YYYY-MM-DD" });
    }
    if (date_from > date_to) {
      return res.status(400).json({ error: "date_from must be <= date_to" });
    }
    const wdSet = new Set(weekdays.map(Number));
    // 0=Mon..6=Sun (ISO). JS getDay(): 0=Sun..6=Sat
    const jsToIso = (d) => (d + 6) % 7;

    await db.query("BEGIN");

    // Allocate a new series_id from sequence
    const sidR = await db.query(`SELECT nextval('shift_series_seq') AS sid`);
    const series_id = String(sidR.rows[0].sid);

    let created = 0;
    const conflicts = [];

    const start = new Date(date_from + "T00:00:00");
    const end   = new Date(date_to + "T00:00:00");

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const wd = jsToIso(d.getDay());
      if (!wdSet.has(wd)) continue;
      const ymd = d.toISOString().slice(0, 10);

      await db.query("SAVEPOINT sp_row");
      try {
        // Check overlap on same employee any branch
        const overlap = await db.query(
          `SELECT id, branch_id, start_time, end_time FROM schedule_shifts
            WHERE employee_id=$1 AND date=$2::date
              AND NOT (end_time::text <= $3::text OR start_time::text >= $4::text)
            LIMIT 1`,
          [Number(employee_id), ymd, start_time, end_time]
        );
        if (overlap.rows.length > 0) {
          await db.query("RELEASE SAVEPOINT sp_row");
          conflicts.push({ date: ymd, reason: "overlap" });
          continue;
        }

        await db.query(
          `INSERT INTO schedule_shifts (branch_id, employee_id, date, start_time, end_time, notes, series_id)
           VALUES ($1::int, $2::int, $3::date, $4::text, $5::text, $6::text, $7::bigint)`,
          [Number(branch_id), Number(employee_id), ymd, start_time, end_time,
           notes == null ? "" : String(notes), series_id]
        );
        await db.query("RELEASE SAVEPOINT sp_row");
        created += 1;
      } catch (e) {
        await db.query("ROLLBACK TO SAVEPOINT sp_row");
        conflicts.push({ date: ymd, reason: e.message });
      }
    }

    await db.query("COMMIT");
    return res.status(201).json({
      series_id,
      created,
      skipped: conflicts.length,
      conflicts,
    });
  } catch (e) {
    await db.query("ROLLBACK").catch(() => {});
    console.error("POST /schedule/shifts error:", e);
    res.status(500).json({ error: "Internal server error", detail: e.message });
  } finally {
    db.release();
  }
});

router.put("/shifts/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });

    const { branch_id, employee_id, date, start_time, end_time, notes } = req.body;

    if (!Number.isInteger(Number(branch_id)) || !Number.isInteger(Number(employee_id))) {
      return res.status(400).json({ error: "branch_id and employee_id must be integers" });
    }
    if (!isYmd(date)) return res.status(400).json({ error: "date must be YYYY-MM-DD" });
    if (!isTime(start_time) || !isTime(end_time)) {
      return res.status(400).json({ error: "start_time and end_time must be HH:MM" });
    }
    if (end_time <= start_time) {
      return res.status(400).json({ error: "end_time must be later than start_time" });
    }

    const overlap = await findOverlap({ employee_id, date, start_time, end_time, exclude_id: id });
    if (overlap) {
      return res.status(409).json({
        error: "SHIFT_OVERLAP",
        message: `Пересечение со сменой #${overlap.id} (филиал ${overlap.branch_id}) ${overlap.start_time}-${overlap.end_time}`,
        overlap,
      });
    }

    const sql = `
      UPDATE schedule_shifts
      SET branch_id = $1::int,
          employee_id = $2::int,
          date = $3::date,
          start_time = $4::text,
          end_time = $5::text,
          notes = $6::text
      WHERE id = $7::int
      RETURNING
        id,
        branch_id,
        employee_id,
        to_char(date,'YYYY-MM-DD') as date,
        start_time,
        end_time,
        COALESCE(notes,'') as notes
    `;

    const { rows } = await pool.query(sql, [
      Number(branch_id),
      Number(employee_id),
      date,
      String(start_time),
      String(end_time),
      notes == null ? "" : String(notes),
      id,
    ]);

    if (!rows.length) return res.status(404).json({ error: "Shift not found" });
    res.json(rows[0]);
  } catch (e) {
    console.error("PUT /schedule/shifts/:id error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * DELETE /schedule/shifts/:id?scope=one|future|all
 *   one   — только эту (по умолчанию)
 *   future — эту и все будущие из той же серии (date >= этой)
 *   all   — всю серию
 */
router.delete("/shifts/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
    const scope = String(req.query.scope || "one");

    if (scope === "one") {
      const { rowCount } = await pool.query(`DELETE FROM schedule_shifts WHERE id=$1::int`, [id]);
      if (!rowCount) return res.status(404).json({ error: "Shift not found" });
      return res.json({ ok: true, deleted: rowCount });
    }

    const { rows } = await pool.query(
      `SELECT series_id, date FROM schedule_shifts WHERE id=$1::int LIMIT 1`, [id]
    );
    if (!rows.length) return res.status(404).json({ error: "Shift not found" });
    const { series_id, date } = rows[0];
    if (series_id == null) {
      // Not part of a series — fall back to single delete
      const { rowCount } = await pool.query(`DELETE FROM schedule_shifts WHERE id=$1::int`, [id]);
      return res.json({ ok: true, deleted: rowCount });
    }

    let sql, params;
    if (scope === "future") {
      sql = `DELETE FROM schedule_shifts WHERE series_id=$1 AND date >= $2::date`;
      params = [series_id, date];
    } else if (scope === "all") {
      sql = `DELETE FROM schedule_shifts WHERE series_id=$1`;
      params = [series_id];
    } else {
      return res.status(400).json({ error: "Invalid scope" });
    }
    const { rowCount } = await pool.query(sql, params);
    res.json({ ok: true, deleted: rowCount });
  } catch (e) {
    console.error("DELETE /schedule/shifts/:id error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PATCH /schedule/shifts/:id/scope?scope=future|all — change time across series.
 * Body: { start_time, end_time, notes? }
 * "one" scope не обрабатываем тут — для одной смены работает обычный PUT.
 */
router.patch("/shifts/:id/scope", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
    const scope = String(req.query.scope || "future");
    const { start_time, end_time, notes } = req.body || {};
    if (!isTime(start_time) || !isTime(end_time)) {
      return res.status(400).json({ error: "start_time/end_time must be HH:MM" });
    }
    if (end_time <= start_time) return res.status(400).json({ error: "end_time must be > start_time" });

    const { rows } = await pool.query(
      `SELECT series_id, date FROM schedule_shifts WHERE id=$1::int LIMIT 1`, [id]
    );
    if (!rows.length) return res.status(404).json({ error: "Shift not found" });
    const { series_id, date } = rows[0];
    if (series_id == null) return res.status(400).json({ error: "Shift is not part of a series" });

    let sql, params;
    if (scope === "future") {
      sql = `UPDATE schedule_shifts SET start_time=$1::text, end_time=$2::text${notes !== undefined ? ", notes=$3::text" : ""}
              WHERE series_id=$${notes !== undefined ? 4 : 3} AND date >= $${notes !== undefined ? 5 : 4}::date`;
      params = notes !== undefined
        ? [start_time, end_time, String(notes ?? ""), series_id, date]
        : [start_time, end_time, series_id, date];
    } else if (scope === "all") {
      sql = `UPDATE schedule_shifts SET start_time=$1::text, end_time=$2::text${notes !== undefined ? ", notes=$3::text" : ""}
              WHERE series_id=$${notes !== undefined ? 4 : 3}`;
      params = notes !== undefined
        ? [start_time, end_time, String(notes ?? ""), series_id]
        : [start_time, end_time, series_id];
    } else {
      return res.status(400).json({ error: "Invalid scope" });
    }

    const { rowCount } = await pool.query(sql, params);
    res.json({ ok: true, updated: rowCount });
  } catch (e) {
    console.error("PATCH /shifts/:id/scope error:", e);
    res.status(500).json({ error: "Internal server error", detail: e.message });
  }
});

export default router;
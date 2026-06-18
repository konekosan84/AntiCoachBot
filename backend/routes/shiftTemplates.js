/**
 * Шаблоны смен + автогенерация расписания.
 *
 * GET    /templates                 — список всех
 * POST   /templates                 — создать (employee_id, branch_id, weekday, start_time, end_time, notes)
 * PUT    /templates/:id             — обновить
 * DELETE /templates/:id             — удалить
 * POST   /templates/generate        — сгенерировать смены {date_from, date_to, employee_ids?}
 *
 * weekday: 0=Mon..6=Sun (ISO).
 */
import express from "express";
import pool from "../db.js";
import { requireRole } from "../middleware/auth.js";

const router = express.Router();
const adminPlus = requireRole("owner", "admin");

function isYmd(v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || "")); }
function normTime(v) {
  const s = String(v || "").trim();
  return /^\d{2}:\d{2}$/.test(s) ? s + ":00" : (/^\d{2}:\d{2}:\d{2}$/.test(s) ? s : null);
}
function isoWeekdayJs(jsDay) { return (jsDay + 6) % 7; } // 0=Mon..6=Sun

/* ─── GET all templates ─── */
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT t.*, e.name AS employee_name, b.name AS branch_name
        FROM shift_templates t
   LEFT JOIN employees e ON e.id = t.employee_id
   LEFT JOIN branches  b ON b.id = t.branch_id
    ORDER BY t.employee_id, t.weekday, t.start_time
    `);
    res.json(rows);
  } catch (e) {
    console.error("GET templates:", e);
    res.status(500).json({ error: "FAILED" });
  }
});

/* Check whether another template overlaps the same (employee, weekday) time range.
   Returns the conflicting template row (with branch_name) or null. */
async function findTemplateConflict(db, { employee_id, weekday, start_time, end_time, excludeId = null }) {
  const params = [employee_id, weekday, start_time, end_time];
  let sql = `
    SELECT t.id, t.start_time, t.end_time, t.branch_id, b.name AS branch_name
      FROM shift_templates t
 LEFT JOIN branches b ON b.id = t.branch_id
     WHERE t.employee_id = $1 AND t.weekday = $2 AND t.is_active = TRUE
       AND ($3::time < t.end_time AND $4::time > t.start_time)`;
  if (excludeId) { sql += ` AND t.id <> $5`; params.push(excludeId); }
  sql += ` LIMIT 1`;
  const { rows } = await db.query(sql, params);
  return rows[0] || null;
}

/* ─── CREATE ─── */
router.post("/", adminPlus, async (req, res) => {
  try {
    const { employee_id, branch_id, weekday, start_time, end_time, notes, is_active } = req.body || {};
    if (!employee_id || !branch_id || weekday === undefined) {
      return res.status(400).json({ error: "MISSING_FIELDS" });
    }
    const st = normTime(start_time), et = normTime(end_time);
    if (!st || !et) return res.status(400).json({ error: "INVALID_TIME" });
    if (et <= st)   return res.status(400).json({ error: "END_BEFORE_START" });

    const conflict = await findTemplateConflict(pool, {
      employee_id, weekday: Number(weekday), start_time: st, end_time: et,
    });
    if (conflict) {
      return res.status(409).json({
        error: "TEMPLATE_CONFLICT",
        conflict: {
          branch_name: conflict.branch_name,
          start_time: String(conflict.start_time).slice(0, 5),
          end_time:   String(conflict.end_time).slice(0, 5),
        },
      });
    }

    const { rows } = await pool.query(`
      INSERT INTO shift_templates (employee_id, branch_id, weekday, start_time, end_time, notes, is_active)
      VALUES ($1, $2, $3, $4::time, $5::time, $6, $7)
      RETURNING *
    `, [employee_id, branch_id, Number(weekday), st, et, notes || null, is_active ?? true]);
    res.json(rows[0]);
  } catch (e) {
    console.error("CREATE template:", e);
    res.status(500).json({ error: "FAILED" });
  }
});

/* ─── UPDATE ─── */
router.put("/:id", adminPlus, async (req, res) => {
  try {
    const { id } = req.params;
    const { employee_id, branch_id, weekday, start_time, end_time, notes, is_active } = req.body || {};
    const st = normTime(start_time), et = normTime(end_time);
    if (!st || !et) return res.status(400).json({ error: "INVALID_TIME" });
    if (et <= st)   return res.status(400).json({ error: "END_BEFORE_START" });

    const conflict = await findTemplateConflict(pool, {
      employee_id, weekday: Number(weekday), start_time: st, end_time: et,
      excludeId: Number(id),
    });
    if (conflict) {
      return res.status(409).json({
        error: "TEMPLATE_CONFLICT",
        conflict: {
          branch_name: conflict.branch_name,
          start_time: String(conflict.start_time).slice(0, 5),
          end_time:   String(conflict.end_time).slice(0, 5),
        },
      });
    }

    const { rows } = await pool.query(`
      UPDATE shift_templates
         SET employee_id=$1, branch_id=$2, weekday=$3,
             start_time=$4::time, end_time=$5::time,
             notes=$6, is_active=$7, updated_at=NOW()
       WHERE id=$8
   RETURNING *
    `, [employee_id, branch_id, Number(weekday), st, et, notes || null, is_active ?? true, id]);
    res.json(rows[0]);
  } catch (e) {
    console.error("UPDATE template:", e);
    res.status(500).json({ error: "FAILED" });
  }
});

/* ─── DELETE ─── */
router.delete("/:id", adminPlus, async (req, res) => {
  try {
    await pool.query(`DELETE FROM shift_templates WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE template:", e);
    res.status(500).json({ error: "FAILED" });
  }
});

/* ─── GENERATE shifts from templates ─── */
router.post("/generate", adminPlus, async (req, res) => {
  const db = await pool.connect();
  try {
    const { date_from, date_to, employee_ids, replace = false } = req.body || {};
    if (!isYmd(date_from) || !isYmd(date_to)) return res.status(400).json({ error: "INVALID_DATES" });
    if (date_from > date_to) return res.status(400).json({ error: "DATES_REVERSED" });

    // Load active templates (optionally for specific employees)
    let templatesSql = `SELECT * FROM shift_templates WHERE is_active = TRUE`;
    const tParams = [];
    if (Array.isArray(employee_ids) && employee_ids.length > 0) {
      const placeholders = employee_ids.map((_, i) => `$${i + 1}`).join(",");
      templatesSql += ` AND employee_id IN (${placeholders})`;
      tParams.push(...employee_ids.map(Number));
    }
    const { rows: templates } = await db.query(templatesSql, tParams);

    if (templates.length === 0) {
      return res.json({ created: 0, skipped: 0, replaced: 0, message: "Нет активных шаблонов" });
    }

    await db.query("BEGIN");

    // Optionally clear existing shifts in range (only for employees in templates)
    let replaced = 0;
    if (replace) {
      const empIds = [...new Set(templates.map(t => Number(t.employee_id)))];
      const ph = empIds.map((_, i) => `$${i + 3}`).join(",");
      const del = await db.query(
        `DELETE FROM schedule_shifts WHERE date BETWEEN $1::date AND $2::date AND employee_id IN (${ph})`,
        [date_from, date_to, ...empIds]
      );
      replaced = del.rowCount || 0;
    }

    // Iterate each date in range
    const start = new Date(date_from);
    const end   = new Date(date_to);
    let created = 0, skipped = 0;
    let firstError = null;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const ymd = d.toISOString().slice(0, 10);
      const wd  = isoWeekdayJs(d.getDay()); // 0=Mon..6=Sun

      for (const t of templates) {
        if (Number(t.weekday) !== wd) continue;

        // Use SAVEPOINT so a single failed insert doesn't abort the whole transaction
        await db.query("SAVEPOINT sp_row");
        try {
          // Skip if employee already has ANY overlapping shift on that date (any branch).
          // A person cannot be in two places at once.
          const dup = await db.query(
            `SELECT 1 FROM schedule_shifts
              WHERE employee_id=$1 AND date=$2::date
                AND ($3::time < end_time::time AND $4::time > start_time::time)
              LIMIT 1`,
            [t.employee_id, ymd, t.start_time, t.end_time]
          );
          if (dup.rows.length > 0) {
            await db.query("RELEASE SAVEPOINT sp_row");
            skipped += 1;
            continue;
          }

          await db.query(
            `INSERT INTO schedule_shifts (branch_id, employee_id, date, start_time, end_time, notes)
             VALUES ($1, $2, $3::date, $4::time::text, $5::time::text, $6)`,
            [t.branch_id, t.employee_id, ymd, t.start_time, t.end_time, t.notes || null]
          );
          await db.query("RELEASE SAVEPOINT sp_row");
          created += 1;
        } catch (e) {
          await db.query("ROLLBACK TO SAVEPOINT sp_row");
          if (!firstError) {
            firstError = e.message;
            console.error("[generate] first insert error:", e.message, "| row:", {
              employee_id: t.employee_id, branch_id: t.branch_id, ymd,
              start_time: t.start_time, end_time: t.end_time,
            });
          }
          skipped += 1;
        }
      }
    }

    await db.query("COMMIT");
    res.json({ created, skipped, replaced, ...(firstError ? { first_error: firstError } : {}) });
  } catch (e) {
    await db.query("ROLLBACK").catch(() => {});
    console.error("GENERATE templates:", e);
    res.status(500).json({ error: "FAILED", detail: e.message });
  } finally {
    db.release();
  }
});

export default router;

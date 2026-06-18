/**
 * Public widget API — no auth required.
 * Used by /booking client-facing page.
 */
import express from "express";
import pool from "../db.js";

const router = express.Router();

const TENANT_ID = 1;

function normalizePhone(phone) {
  if (!phone) return null;
  let digits = String(phone).replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 11 && digits.startsWith("8")) digits = "7" + digits.slice(1);
  else if (digits.length === 10) digits = "7" + digits;
  if (digits.length !== 11 || !digits.startsWith("7")) return null;
  return digits;
}

function normalizeDate(v) {
  const s = String(v || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function normalizeTime(v) {
  const s = String(v || "").trim();
  return /^\d{2}:\d{2}$/.test(s) ? s : null;
}

/* ─── GET /api/v1/widget/branches ─── */
router.get("/branches", async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM branches ORDER BY id");
    res.json(rows);
  } catch (e) {
    console.error("widget /branches:", e);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/* ─── GET /api/v1/widget/services ─── */
router.get("/services", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.*,
             COALESCE(
               (SELECT json_agg(sb.branch_id ORDER BY sb.branch_id)
                  FROM service_branches sb WHERE sb.service_id = s.id),
               '[]'
             ) AS branch_ids
        FROM services s
       WHERE s.is_active IS NOT FALSE
    ORDER BY s.id
    `);
    res.json(rows);
  } catch (e) {
    console.error("widget /services:", e);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/* ─── GET /api/v1/widget/employees ─── */
router.get("/employees", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        e.id, e.name, e.position, e.description_client, e.photo_url, e.status,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object('id', b.id, 'name', b.name)
          ) FILTER (WHERE b.id IS NOT NULL),
          '[]'
        ) AS branches
      FROM employees e
      LEFT JOIN branch_employees be ON be.employee_id = e.id
      LEFT JOIN branches b ON b.id = be.branch_id
      WHERE e.status = 'active' OR e.status IS NULL
      GROUP BY e.id
      ORDER BY e.id
    `);
    res.json(rows);
  } catch (e) {
    console.error("widget /employees:", e);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/* ─── GET /api/v1/widget/shifts?date_from=&date_to= ─── */
router.get("/shifts", async (req, res) => {
  try {
    const dateFrom = normalizeDate(req.query.date_from);
    const dateTo   = normalizeDate(req.query.date_to);

    if (!dateFrom || !dateTo) {
      return res.status(400).json({ error: "date_from and date_to required (YYYY-MM-DD)" });
    }

    const { rows } = await pool.query(`
      SELECT
        s.id, s.branch_id, s.employee_id,
        to_char(s.date, 'YYYY-MM-DD') AS date,
        s.start_time, s.end_time
      FROM schedule_shifts s
      WHERE s.date >= $1::date AND s.date <= $2::date
      ORDER BY s.date ASC, s.start_time ASC, s.employee_id ASC
    `, [dateFrom, dateTo]);

    res.json(rows);
  } catch (e) {
    console.error("widget /shifts:", e);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/* ─── GET /api/v1/widget/bookings?date_from=&date_to= (for overlap check) ─── */
router.get("/bookings", async (req, res) => {
  try {
    const dateFrom = normalizeDate(req.query.date_from);
    const dateTo   = normalizeDate(req.query.date_to);

    if (!dateFrom || !dateTo) {
      return res.status(400).json({ error: "date_from and date_to required" });
    }

    const { rows } = await pool.query(`
      SELECT b.id, b.employee_id, b.branch_id, b.service_id,
             to_char(b.date, 'YYYY-MM-DD') AS date,
             b.start_time, b.end_time,
             COALESCE(NULLIF(b.status,''), 'booked') AS status
        FROM bookings b
        JOIN clients c ON c.id = b.client_id
       WHERE c.tenant_id = $1
         AND b.date >= $2::date
         AND b.date <= $3::date
    `, [TENANT_ID, dateFrom, dateTo]);

    res.json({ ok: true, data: rows });
  } catch (e) {
    console.error("widget /bookings:", e);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/* ─── POST /api/v1/widget/bookings (guest booking — no admin auth) ─── */
router.post("/bookings", async (req, res) => {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");

    const {
      full_name, phone,
      branch_id, service_id, employee_id,
      date, start_time, end_time,
      price, status = "booked",
    } = req.body || {};

    const finalDate      = normalizeDate(date);
    const finalStartTime = normalizeTime(start_time);
    const finalEndTime   = normalizeTime(end_time);

    if (!finalDate)      { await db.query("ROLLBACK"); return res.status(400).json({ ok: false, error: "DATE_REQUIRED" }); }
    if (!finalStartTime) { await db.query("ROLLBACK"); return res.status(400).json({ ok: false, error: "START_TIME_REQUIRED" }); }
    if (!finalEndTime)   { await db.query("ROLLBACK"); return res.status(400).json({ ok: false, error: "END_TIME_REQUIRED" }); }

    const cleanName      = String(full_name || "").trim().replace(/\s+/g, " ");
    const normalizedPhone = normalizePhone(phone);

    if (!cleanName)       { await db.query("ROLLBACK"); return res.status(400).json({ ok: false, error: "FULL_NAME_REQUIRED" }); }
    if (!normalizedPhone) { await db.query("ROLLBACK"); return res.status(400).json({ ok: false, error: "PHONE_REQUIRED" }); }

    // Upsert client
    const existing = await db.query(
      `SELECT id FROM clients WHERE tenant_id = $1 AND phone = $2 LIMIT 1`,
      [TENANT_ID, normalizedPhone]
    );

    let clientId;
    if (existing.rows[0]) {
      clientId = existing.rows[0].id;
      await db.query(
        `UPDATE clients SET full_name = $1, updated_at = NOW() WHERE id = $2`,
        [cleanName, clientId]
      );
    } else {
      const created = await db.query(
        `INSERT INTO clients (tenant_id, business_id, full_name, phone, status, source, created_branch_id)
         VALUES ($1, $2, $3, $4, 'new', 'widget', $5) RETURNING id`,
        [TENANT_ID, branch_id ? Number(branch_id) : null, cleanName, normalizedPhone, branch_id ? Number(branch_id) : null]
      );
      clientId = created.rows[0].id;
    }

    // Check overlap
    if (employee_id) {
      const overlap = await db.query(
        `SELECT id FROM bookings
          WHERE employee_id = $1 AND date = $2::date
            AND COALESCE(NULLIF(status,''),'booked') <> 'cancelled'
            AND start_time < $4 AND COALESCE(end_time, start_time) > $3
          LIMIT 1`,
        [Number(employee_id), finalDate, finalStartTime, finalEndTime]
      );
      if (overlap.rows[0]) {
        await db.query("ROLLBACK");
        return res.status(409).json({ ok: false, error: "BOOKING_OVERLAP" });
      }
    }

    const result = await db.query(
      `INSERT INTO bookings (client_id, branch_id, service_id, employee_id, date, start_time, end_time, price, status)
       VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8, $9)
       RETURNING id, client_id, branch_id, service_id, employee_id,
                 to_char(date,'YYYY-MM-DD') AS date,
                 start_time, end_time, price, status`,
      [
        clientId,
        branch_id ? Number(branch_id) : null,
        service_id ? Number(service_id) : null,
        employee_id ? Number(employee_id) : null,
        finalDate, finalStartTime, finalEndTime,
        price != null ? Number(price) : null,
        status,
      ]
    );

    await db.query(
      `UPDATE clients SET last_visit_at = CASE WHEN $3::date <= CURRENT_DATE THEN NOW() ELSE last_visit_at END,
                          updated_at = NOW()
       WHERE tenant_id = $1 AND id = $2`,
      [TENANT_ID, clientId, finalDate]
    );

    await db.query("COMMIT");
    res.status(201).json({ ok: true, data: result.rows[0], client_id: clientId });
  } catch (e) {
    await db.query("ROLLBACK");
    console.error("widget POST /bookings:", e);
    res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  } finally {
    db.release();
  }
});

export default router;

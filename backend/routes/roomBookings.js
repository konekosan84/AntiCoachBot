/**
 * Room-mode bookings — simplified API for businesses that book ROOMS
 * (photo studios, coworking, tire shops, etc.) instead of services+masters.
 *
 * Uses the same `bookings` table but only fills: branch_id, room_id, client_id, date, times.
 * service_id and employee_id stay NULL.
 */
import express from "express";
import pool from "../db.js";

const router = express.Router();

function normalizeDate(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || "").trim()) ? v : null;
}
function normalizeTime(v) {
  return /^\d{2}:\d{2}$/.test(String(v || "").trim()) ? v : null;
}
function normalizePhone(p) {
  const d = String(p || "").replace(/\D/g, "");
  if (!d) return null;
  if (d.length === 11 && d[0] === "8") return "7" + d.slice(1);
  if (d.length === 10) return "7" + d;
  return d.length === 11 && d[0] === "7" ? d : null;
}

function getBusinessId(req) { return Number(req.user?.business_id || 1); }

/**
 * GET /api/v1/room-bookings?from&to&branch_id&room_id
 */
router.get("/", async (req, res) => {
  try {
    const businessId = getBusinessId(req);
    const from      = normalizeDate(req.query.from);
    const to        = normalizeDate(req.query.to);
    const branchId  = req.query.branch_id ? Number(req.query.branch_id) : null;
    const roomId    = req.query.room_id   ? Number(req.query.room_id)   : null;

    const where = [`b.room_id IS NOT NULL`];
    const params = [];
    let p = 0;

    if (from) { params.push(from); p++; where.push(`b.date >= $${p}`); }
    if (to)   { params.push(to);   p++; where.push(`b.date <= $${p}`); }
    if (branchId) { params.push(branchId); p++; where.push(`b.branch_id = $${p}`); }
    if (roomId)   { params.push(roomId);   p++; where.push(`b.room_id = $${p}`); }

    const { rows } = await pool.query(
      `
      SELECT
        b.id,
        TO_CHAR(b.date, 'YYYY-MM-DD') AS date,
        b.start_time, b.end_time,
        COALESCE(NULLIF(b.status,''), 'booked') AS status,
        COALESCE(b.kind, 'booking') AS kind,
        b.price, b.notes,
        b.branch_id, br.name AS branch_name,
        b.room_id,   r.name  AS room_name,
        b.client_id, c.full_name AS client_name, c.phone AS client_phone
      FROM bookings b
      LEFT JOIN branches br ON br.id = b.branch_id
      LEFT JOIN rooms     r ON r.id  = b.room_id
      LEFT JOIN clients   c ON c.id  = b.client_id
      WHERE ${where.join(" AND ")}
      ORDER BY b.date DESC, b.start_time DESC NULLS LAST
      LIMIT 500
      `,
      params
    );
    return res.json(rows);
  } catch (err) {
    console.error("GET /room-bookings error:", err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/**
 * POST /api/v1/room-bookings
 * body: { branch_id, room_id, date, start_time, end_time, client_name, client_phone, notes?, price? }
 */
router.post("/", async (req, res) => {
  try {
    const businessId = getBusinessId(req);
    const {
      branch_id, room_id, date, start_time, end_time,
      client_name, client_phone, notes, price,
    } = req.body || {};

    if (!branch_id)             return res.status(400).json({ error: "BRANCH_REQUIRED" });
    if (!room_id)               return res.status(400).json({ error: "ROOM_REQUIRED" });
    if (!normalizeDate(date))   return res.status(400).json({ error: "DATE_INVALID" });
    if (!normalizeTime(start_time) || !normalizeTime(end_time))
                                return res.status(400).json({ error: "TIME_INVALID" });
    if (String(end_time) <= String(start_time))
                                return res.status(400).json({ error: "END_BEFORE_START" });

    const phone = normalizePhone(client_phone);
    if (!phone)                 return res.status(400).json({ error: "PHONE_INVALID" });

    // Find or create client
    let clientId;
    const found = await pool.query(
      `SELECT id FROM clients WHERE phone = $1 AND tenant_id = $2 LIMIT 1`,
      [phone, businessId]
    );
    if (found.rows[0]) {
      clientId = found.rows[0].id;
    } else {
      const created = await pool.query(
        `INSERT INTO clients (full_name, phone, tenant_id, created_branch_id, source, status, created_at)
         VALUES ($1, $2, $3, $4, 'manual', 'active', NOW()) RETURNING id`,
        [client_name || "Без имени", phone, businessId, branch_id]
      );
      clientId = created.rows[0].id;
    }

    // Check overlap on the same room
    const overlap = await pool.query(
      `
      SELECT id, start_time, end_time FROM bookings
      WHERE room_id = $1 AND date = $2
        AND COALESCE(NULLIF(status,''), 'booked') <> 'cancelled'
        AND ($3::time < end_time::time AND $4::time > start_time::time)
      LIMIT 1
      `,
      [room_id, date, start_time, end_time]
    );
    if (overlap.rows[0]) {
      return res.status(409).json({ error: "ROOM_OVERLAP", overlap: overlap.rows[0] });
    }

    const { rows } = await pool.query(
      `
      INSERT INTO bookings
        (branch_id, room_id, client_id, date, start_time, end_time, status, notes, price)
      VALUES ($1, $2, $3, $4::date, $5, $6, 'booked', $7, $8)
      RETURNING id
      `,
      [branch_id, room_id, clientId, date, start_time, end_time, notes || null, price || null]
    );

    return res.json({ ok: true, id: rows[0].id, client_id: clientId });
  } catch (err) {
    console.error("POST /room-bookings error:", err);
    return res.status(500).json({ error: "SERVER_ERROR", detail: err.message });
  }
});

/**
 * POST /api/v1/room-bookings/block
 * body: { branch_id, room_id, date, start_time, end_time, reason? }
 * Creates an internal "blocked" time — no client required.
 */
router.post("/block", async (req, res) => {
  try {
    const businessId = getBusinessId(req);
    const { branch_id, room_id, date, start_time, end_time, reason } = req.body || {};

    if (!branch_id)             return res.status(400).json({ error: "BRANCH_REQUIRED" });
    if (!room_id)               return res.status(400).json({ error: "ROOM_REQUIRED" });
    if (!normalizeDate(date))   return res.status(400).json({ error: "DATE_INVALID" });
    if (!normalizeTime(start_time) || !normalizeTime(end_time))
                                return res.status(400).json({ error: "TIME_INVALID" });
    if (String(end_time) <= String(start_time))
                                return res.status(400).json({ error: "END_BEFORE_START" });

    const overlap = await pool.query(
      `
      SELECT id, start_time, end_time, kind FROM bookings
      WHERE room_id = $1 AND date = $2
        AND COALESCE(NULLIF(status,''), 'booked') <> 'cancelled'
        AND ($3::time < end_time::time AND $4::time > start_time::time)
      LIMIT 1
      `,
      [room_id, date, start_time, end_time]
    );
    if (overlap.rows[0]) {
      return res.status(409).json({ error: "ROOM_OVERLAP", overlap: overlap.rows[0] });
    }

    const { rows } = await pool.query(
      `
      INSERT INTO bookings
        (branch_id, room_id, date, start_time, end_time, status, kind, notes)
      VALUES ($1, $2, $3::date, $4, $5, 'booked', 'block', $6)
      RETURNING id
      `,
      [branch_id, room_id, date, start_time, end_time, reason || null]
    );

    return res.json({ ok: true, id: rows[0].id });
  } catch (err) {
    console.error("POST /room-bookings/block error:", err);
    return res.status(500).json({ error: "SERVER_ERROR", detail: err.message });
  }
});

/**
 * DELETE /api/v1/room-bookings/:id
 */
router.delete("/:id", async (req, res) => {
  try {
    await pool.query(`DELETE FROM bookings WHERE id = $1 AND room_id IS NOT NULL`, [req.params.id]);
    return res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /room-bookings error:", err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
});

export default router;

/**
 * Client-side auth for the public booking widget.
 *
 * Flow:
 *   1) POST /lookup          — does this phone exist? (no auth side effects)
 *   2) POST /send-code       — generate 4-digit OTP, log to console (later: SMS)
 *   3) POST /verify          — submit OTP, get token
 *   4) GET  /me              — profile of current client (Bearer token)
 *   5) GET  /bookings        — my bookings
 *   6) POST /bookings/:id/cancel
 *   7) PATCH /me             — update name/email/birthday
 *
 * All endpoints are PUBLIC (no admin auth required). Identity is established
 * via `Authorization: Bearer <token>` (client-auth tokens, NOT admin JWT).
 */
import express from "express";
import crypto from "crypto";
import pool from "../db.js";

const router = express.Router();

const CODE_TTL_MIN = 5;
const TOKEN_TTL_DAYS = 30;
const MAX_ATTEMPTS = 5;

function normalizePhone(p) {
  const d = String(p || "").replace(/\D/g, "");
  if (!d) return null;
  if (d.length === 11 && d[0] === "8") return "7" + d.slice(1);
  if (d.length === 10) return "7" + d;
  return d.length === 11 && d[0] === "7" ? d : null;
}

function maskPhone(p) {
  if (!p || p.length !== 11) return p || "";
  return `+${p[0]} (${p.slice(1,4)}) ***-**-${p.slice(9)}`;
}

function genCode() {
  // 4-digit numeric OTP
  return String(Math.floor(1000 + Math.random() * 9000));
}

function genToken() {
  return crypto.randomBytes(32).toString("hex");
}

/* ─── Middleware: load client from Bearer token ─── */
async function requireClient(req, res, next) {
  const header = req.headers.authorization || "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "NO_TOKEN" });

  try {
    const { rows } = await pool.query(
      `SELECT t.client_id, t.tenant_id, t.expires_at,
              c.full_name, c.phone, c.email, c.birthday
         FROM client_auth_tokens t
         JOIN clients c ON c.id = t.client_id
        WHERE t.token = $1 AND t.expires_at > NOW()
        LIMIT 1`,
      [token]
    );
    const row = rows[0];
    if (!row) return res.status(401).json({ error: "INVALID_TOKEN" });

    // Refresh last_seen
    pool.query(`UPDATE client_auth_tokens SET last_seen = NOW() WHERE token = $1`, [token])
        .catch(() => {});

    req.client = row;
    req.clientToken = token;
    next();
  } catch (err) {
    console.error("requireClient:", err);
    return res.status(500).json({ error: "AUTH_ERROR" });
  }
}

/* ──────────────────────────────────────────────────
   1) Lookup — does this phone exist? Returns masked profile.
   ────────────────────────────────────────────────── */
router.post("/lookup", async (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  if (!phone) return res.status(400).json({ error: "PHONE_INVALID" });

  try {
    const { rows } = await pool.query(
      `SELECT id, full_name FROM clients WHERE phone = $1 LIMIT 1`,
      [phone]
    );
    const c = rows[0];
    return res.json({
      exists: !!c,
      full_name: c ? c.full_name : null,
      phone_masked: maskPhone(phone),
    });
  } catch (err) {
    console.error("client-auth /lookup:", err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/* ──────────────────────────────────────────────────
   2) Send OTP code
   ────────────────────────────────────────────────── */
router.post("/send-code", async (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  if (!phone) return res.status(400).json({ error: "PHONE_INVALID" });

  const code = genCode();
  const expires = new Date(Date.now() + CODE_TTL_MIN * 60_000);

  try {
    await pool.query(
      `INSERT INTO client_auth_codes (phone, code, attempts, expires_at, created_at)
       VALUES ($1, $2, 0, $3, NOW())
       ON CONFLICT (phone) DO UPDATE
         SET code = EXCLUDED.code,
             attempts = 0,
             expires_at = EXCLUDED.expires_at,
             created_at = NOW()`,
      [phone, code, expires]
    );

    // In production, integrate SMS provider here.
    // For dev — print to backend log so user can grab the code.
    console.log(`\n📲  SMS CODE for +${phone}: ${code}  (valid ${CODE_TTL_MIN} min)\n`);

    return res.json({
      ok: true,
      phone_masked: maskPhone(phone),
      ttl_seconds: CODE_TTL_MIN * 60,
      // DEV ONLY: expose code in response so frontend can show it (remove in prod)
      _dev_code: code,
    });
  } catch (err) {
    console.error("client-auth /send-code:", err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/* ──────────────────────────────────────────────────
   3) Verify code → token
   ────────────────────────────────────────────────── */
router.post("/verify", async (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  const code  = String(req.body?.code || "").replace(/\D/g, "");
  const fullName = String(req.body?.full_name || "").trim() || null;

  if (!phone)            return res.status(400).json({ error: "PHONE_INVALID" });
  if (code.length !== 4) return res.status(400).json({ error: "CODE_INVALID" });

  try {
    const { rows } = await pool.query(
      `SELECT code, attempts, expires_at FROM client_auth_codes WHERE phone = $1 LIMIT 1`,
      [phone]
    );
    const row = rows[0];
    if (!row)                              return res.status(400).json({ error: "CODE_NOT_FOUND" });
    if (new Date(row.expires_at) < new Date()) return res.status(400).json({ error: "CODE_EXPIRED" });
    if (row.attempts >= MAX_ATTEMPTS)       return res.status(400).json({ error: "TOO_MANY_ATTEMPTS" });

    if (String(row.code) !== code) {
      await pool.query(
        `UPDATE client_auth_codes SET attempts = attempts + 1 WHERE phone = $1`,
        [phone]
      );
      return res.status(400).json({ error: "CODE_WRONG", attempts_left: MAX_ATTEMPTS - row.attempts - 1 });
    }

    // Find or create client
    let clientResult = await pool.query(
      `SELECT id, full_name FROM clients WHERE phone = $1 LIMIT 1`,
      [phone]
    );
    let clientId;
    let isNew = false;
    if (clientResult.rows[0]) {
      clientId = clientResult.rows[0].id;
      // Update full_name if supplied and different
      if (fullName && fullName.toLowerCase() !== String(clientResult.rows[0].full_name||"").toLowerCase()) {
        await pool.query(
          `UPDATE clients SET full_name = $1, updated_at = NOW() WHERE id = $2`,
          [fullName, clientId]
        );
      }
    } else {
      const inserted = await pool.query(
        `INSERT INTO clients (tenant_id, full_name, phone, status, source, created_at)
         VALUES (1, $1, $2, 'new', 'self_registration', NOW())
         RETURNING id`,
        [fullName || "Без имени", phone]
      );
      clientId = inserted.rows[0].id;
      isNew = true;
    }

    // Issue token
    const token = genToken();
    const expires = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 3600_000);
    await pool.query(
      `INSERT INTO client_auth_tokens (token, client_id, tenant_id, expires_at)
       VALUES ($1, $2, 1, $3)`,
      [token, clientId, expires]
    );

    // Burn the code
    await pool.query(`DELETE FROM client_auth_codes WHERE phone = $1`, [phone]);

    return res.json({
      token,
      expires_at: expires.toISOString(),
      client: { id: clientId, full_name: fullName || null, phone, is_new: isNew },
    });
  } catch (err) {
    console.error("client-auth /verify:", err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/* ──────────────────────────────────────────────────
   4) /me
   ────────────────────────────────────────────────── */
router.get("/me", requireClient, async (req, res) => {
  return res.json({
    client: {
      id: req.client.client_id,
      full_name: req.client.full_name,
      phone: req.client.phone,
      email: req.client.email,
      birthday: req.client.birthday,
    },
  });
});

/* ──────────────────────────────────────────────────
   5) /me — update profile
   ────────────────────────────────────────────────── */
router.patch("/me", requireClient, async (req, res) => {
  const { full_name, email, birthday } = req.body || {};
  try {
    const updates = [];
    const params = [];
    if (full_name !== undefined) { params.push(String(full_name).trim()); updates.push(`full_name = $${params.length}`); }
    if (email !== undefined)     { params.push(email ? String(email).trim() : null); updates.push(`email = $${params.length}`); }
    if (birthday !== undefined)  { params.push(birthday || null); updates.push(`birthday = $${params.length}`); }
    if (updates.length === 0) return res.json({ ok: true });

    params.push(req.client.client_id);
    await pool.query(
      `UPDATE clients SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $${params.length}`,
      params
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error("client-auth PATCH /me:", err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/* ──────────────────────────────────────────────────
   6) My bookings
   ────────────────────────────────────────────────── */
router.get("/bookings", requireClient, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT b.id,
             TO_CHAR(b.date, 'YYYY-MM-DD') AS date,
             b.start_time, b.end_time,
             COALESCE(NULLIF(b.status,''), 'booked') AS status,
             b.price, b.notes,
             b.branch_id, br.name AS branch_name, br.address AS branch_address,
             b.service_id, s.name AS service_name,
             b.employee_id, e.name AS employee_name
        FROM bookings b
        LEFT JOIN branches  br ON br.id = b.branch_id
        LEFT JOIN services  s  ON s.id  = b.service_id
        LEFT JOIN employees e  ON e.id  = b.employee_id
       WHERE b.client_id = $1
    ORDER BY b.date DESC, b.start_time DESC
       LIMIT 100
      `,
      [req.client.client_id]
    );
    return res.json(rows);
  } catch (err) {
    console.error("client-auth /bookings:", err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/* ──────────────────────────────────────────────────
   7) Cancel my booking
   ────────────────────────────────────────────────── */
router.post("/bookings/:id/cancel", requireClient, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { rows } = await pool.query(
      `SELECT id, client_id, date, start_time FROM bookings WHERE id = $1`,
      [id]
    );
    const b = rows[0];
    if (!b)                                   return res.status(404).json({ error: "NOT_FOUND" });
    if (Number(b.client_id) !== Number(req.client.client_id)) return res.status(403).json({ error: "NOT_YOURS" });

    await pool.query(`UPDATE bookings SET status = 'cancelled' WHERE id = $1`, [id]);
    return res.json({ ok: true });
  } catch (err) {
    console.error("client-auth cancel:", err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/* ──────────────────────────────────────────────────
   7.5) Reschedule my booking (change date/time)
   ────────────────────────────────────────────────── */
router.patch("/bookings/:id", requireClient, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { date, start_time, end_time } = req.body || {};
    if (!date || !start_time || !end_time) {
      return res.status(400).json({ error: "MISSING_FIELDS" });
    }

    const { rows } = await pool.query(
      `SELECT id, client_id, status, branch_id, employee_id FROM bookings WHERE id = $1`,
      [id]
    );
    const b = rows[0];
    if (!b) return res.status(404).json({ error: "NOT_FOUND" });
    if (Number(b.client_id) !== Number(req.client.client_id)) return res.status(403).json({ error: "NOT_YOURS" });
    if (b.status === "cancelled" || b.status === "completed") {
      return res.status(400).json({ error: "CANNOT_RESCHEDULE", message: "Эту запись уже нельзя перенести" });
    }

    // Check overlap with another booking for same employee on new slot
    if (b.employee_id) {
      const overlap = await pool.query(
        `SELECT id FROM bookings
          WHERE id <> $1 AND employee_id = $2 AND date = $3::date
            AND COALESCE(NULLIF(status,''),'booked') <> 'cancelled'
            AND ($4::time < end_time::time AND $5::time > start_time::time)
          LIMIT 1`,
        [id, b.employee_id, date, start_time, end_time]
      );
      if (overlap.rows[0]) return res.status(409).json({ error: "SLOT_TAKEN" });
    }

    await pool.query(
      `UPDATE bookings SET date = $1::date, start_time = $2::time, end_time = $3::time
        WHERE id = $4`,
      [date, start_time, end_time, id]
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error("client-auth reschedule:", err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/* ──────────────────────────────────────────────────
   8) Create booking (as authenticated client)
   ────────────────────────────────────────────────── */
router.post("/book", requireClient, async (req, res) => {
  const {
    branch_id, service_id, employee_id,
    date, start_time, end_time, price, notes,
  } = req.body || {};

  if (!branch_id || !service_id || !date || !start_time || !end_time) {
    return res.status(400).json({ error: "MISSING_FIELDS" });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO bookings (client_id, branch_id, service_id, employee_id, date, start_time, end_time, status, price, notes)
       VALUES ($1, $2, $3, $4, $5::date, $6, $7, 'booked', $8, $9)
       RETURNING id`,
      [
        req.client.client_id,
        Number(branch_id),
        Number(service_id),
        employee_id ? Number(employee_id) : null,
        date, start_time, end_time,
        price ?? null, notes || null,
      ]
    );
    return res.json({ ok: true, id: rows[0].id });
  } catch (err) {
    console.error("client-auth /book:", err);
    return res.status(500).json({ error: "SERVER_ERROR", detail: err.message });
  }
});

/* ──────────────────────────────────────────────────
   9) Logout
   ────────────────────────────────────────────────── */
router.post("/logout", requireClient, async (req, res) => {
  try {
    await pool.query(`DELETE FROM client_auth_tokens WHERE token = $1`, [req.clientToken]);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
});

export default router;

import express from "express";
import { pool } from "../db.js";
import { requireRole } from "../middleware/auth.js";

const router = express.Router();
const adminPlus = requireRole("owner", "admin");

function normalizePhone(input) {
  if (!input) return "";

  let digits = String(input).replace(/\D+/g, "");

  if (digits.length === 11 && digits.startsWith("8")) {
    digits = "7" + digits.slice(1);
  }

  if (digits.length === 10) {
    digits = "7" + digits;
  }

  return digits;
}

function safeLike(q) {
  return String(q || "").replace(/[%_\\]/g, (m) => "\\" + m);
}

/**
 * GET /api/v1/clients
 * query:
 * - search
 * - status
 * - branch_mode = all | created | visited
 * - branch_id
 * - limit
 * - offset
 */
router.get("/", async (req, res) => {
  try {
    const tenantId = Number(req.headers["x-tenant-id"] || 1);

    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "").trim();
    const branchMode = String(req.query.branch_mode || "all").trim();
    const branchId = req.query.branch_id ? Number(req.query.branch_id) : null;

    const limit = Math.min(Number(req.query.limit || 100), 300);
    const offset = Math.max(Number(req.query.offset || 0), 0);

    const where = ["c.tenant_id = $1"];
    const params = [tenantId];
    let p = params.length;

    if (status) {
      params.push(status);
      p++;
      where.push(`c.status = $${p}`);
    }

    if (search) {
      const q = `%${safeLike(search)}%`;
      params.push(q);
      p++;
      where.push(`(
        c.full_name ILIKE $${p} ESCAPE '\\'
        OR COALESCE(c.phone, '') ILIKE $${p} ESCAPE '\\'
        OR COALESCE(c.email, '') ILIKE $${p} ESCAPE '\\'
        OR COALESCE(c.source, '') ILIKE $${p} ESCAPE '\\'
      )`);
    }

    if (branchId && branchMode === "created") {
      params.push(branchId);
      p++;
      where.push(`c.created_branch_id = $${p}`);
    }

    if (branchId && branchMode === "visited") {
      params.push(branchId);
      p++;
      where.push(`EXISTS (
        SELECT 1
        FROM bookings b
        WHERE b.client_id = c.id
          AND b.branch_id = $${p}
      )`);
    }

    if (branchId && branchMode === "all") {
      params.push(branchId);
      p++;
      where.push(`(
        c.created_branch_id = $${p}
        OR EXISTS (
          SELECT 1
          FROM bookings b
          WHERE b.client_id = c.id
            AND b.branch_id = $${p}
        )
      )`);
    }

    params.push(limit);
    params.push(offset);

    const sql = `
      SELECT
        c.id,
        c.tenant_id,
        c.business_id,
        c.full_name,
        c.phone,
        c.email,
        c.birthday,
        c.notes,
        c.status,
        c.source,
        c.created_branch_id,
        c.owner_branch_id,
        c.last_visit_at,
        c.created_at,
        c.updated_at
      FROM clients c
      WHERE ${where.join(" AND ")}
      ORDER BY c.full_name ASC, c.id ASC
      LIMIT $${params.length - 1}
      OFFSET $${params.length}
    `;

    const { rows } = await pool.query(sql, params);
    return res.json({ ok: true, data: rows });
  } catch (e) {
    console.error("GET /clients error:", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

/**
 * GET /api/v1/clients/:id
 */
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const clientResult = await pool.query(
      `
      SELECT
        c.*
      FROM clients c
      WHERE c.id = $1
      LIMIT 1
      `,
      [id]
    );

    if (!clientResult.rows.length) {
      return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }

    const bookingsResult = await pool.query(
      `
      SELECT
        b.id,
        b.branch_id,
        b.employee_id,
        b.service_id,
        b.date,
        b.start_time,
        b.end_time,
        b.price,
        b.status
      FROM bookings b
      WHERE b.client_id = $1
      ORDER BY b.date DESC, b.start_time DESC NULLS LAST
      LIMIT 100
      `,
      [id]
    );

    return res.json({
      ok: true,
      data: clientResult.rows[0],
      bookings: bookingsResult.rows,
    });
  } catch (e) {
    console.error("GET /clients/:id error:", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

/**
 * POST /api/v1/clients
 */
router.post("/", adminPlus, async (req, res) => {
  try {
    const tenantId = Number(req.headers["x-tenant-id"] || 1);

    const fullName = String(req.body.full_name || "").trim().replace(/\s+/g, " ");
    const normalizedPhone = normalizePhone(req.body.phone);
    const cleanEmail = req.body.email ? String(req.body.email).trim() : null;
    const birthday = req.body.birthday || null;
    const notes = req.body.notes ? String(req.body.notes).trim() : "";
    const status = req.body.status || "new";
    const source = req.body.source || "manual";

    const business_id = req.body.business_id ?? null;
    const created_branch_id = req.body.created_branch_id ?? req.body.business_id ?? null;

    if (!fullName) {
      return res.status(400).json({ ok: false, error: "full_name required" });
    }

    if (!normalizedPhone) {
      return res.status(400).json({ ok: false, error: "phone required" });
    }

    const existing = await pool.query(
      `
      SELECT
        id,
        tenant_id,
        business_id,
        full_name,
        phone,
        email,
        birthday,
        notes,
        status,
        source,
        created_branch_id,
        owner_branch_id,
        last_visit_at,
        created_at,
        updated_at
      FROM clients
      WHERE tenant_id = $1
        AND phone = $2
      LIMIT 1
      `,
      [tenantId, normalizedPhone]
    );

    if (existing.rows.length) {
      return res.status(409).json({
        ok: false,
        error: "PHONE_DUPLICATE",
        message: "Клиент с таким телефоном уже существует",
        data: existing.rows[0],
      });
    }

    const insertResult = await pool.query(
      `
      INSERT INTO clients (
        tenant_id,
        business_id,
        full_name,
        phone,
        email,
        birthday,
        notes,
        status,
        source,
        created_branch_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING
        id,
        tenant_id,
        business_id,
        full_name,
        phone,
        email,
        birthday,
        notes,
        status,
        source,
        created_branch_id,
        owner_branch_id,
        last_visit_at,
        created_at,
        updated_at
      `,
      [
        tenantId,
        business_id,
        fullName,
        normalizedPhone,
        cleanEmail,
        birthday,
        notes,
        status,
        source,
        created_branch_id,
      ]
    );

    return res.status(201).json({
      ok: true,
      data: insertResult.rows[0],
    });
  } catch (e) {
    console.error("POST /clients error:", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

/**
 * PATCH /api/v1/clients/:id
 */
router.patch("/:id", adminPlus, async (req, res) => {
  try {
    const id = Number(req.params.id);

    const currentResult = await pool.query(
      `SELECT * FROM clients WHERE id = $1 LIMIT 1`,
      [id]
    );

    if (!currentResult.rows.length) {
      return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }

    const current = currentResult.rows[0];

    const fullName =
      req.body.full_name !== undefined
        ? String(req.body.full_name || "").trim().replace(/\s+/g, " ")
        : current.full_name;

    const normalizedPhone =
      req.body.phone !== undefined
        ? normalizePhone(req.body.phone)
        : current.phone;

    const cleanEmail =
      req.body.email !== undefined
        ? (req.body.email ? String(req.body.email).trim() : null)
        : current.email;

    const birthday =
      req.body.birthday !== undefined ? req.body.birthday : current.birthday;

    const notes =
      req.body.notes !== undefined
        ? String(req.body.notes || "").trim()
        : current.notes;

    const status =
      req.body.status !== undefined ? req.body.status : current.status;

    const source =
      req.body.source !== undefined ? req.body.source : current.source;

    const owner_branch_id =
      req.body.owner_branch_id !== undefined
        ? req.body.owner_branch_id
        : current.owner_branch_id;

    if (!fullName) {
      return res.status(400).json({ ok: false, error: "full_name required" });
    }

    if (!normalizedPhone) {
      return res.status(400).json({ ok: false, error: "phone required" });
    }

    const duplicateResult = await pool.query(
      `
      SELECT id
      FROM clients
      WHERE tenant_id = $1
        AND phone = $2
        AND id <> $3
      LIMIT 1
      `,
      [current.tenant_id, normalizedPhone, id]
    );

    if (duplicateResult.rows.length) {
      return res.status(409).json({
        ok: false,
        error: "Клиент уже существует",
      });
    }

    const updateResult = await pool.query(
      `
      UPDATE clients
      SET
        full_name = $1,
        phone = $2,
        email = $3,
        birthday = $4,
        notes = $5,
        status = $6,
        source = $7,
        owner_branch_id = $8,
        updated_at = NOW()
      WHERE id = $9
      RETURNING
        id,
        tenant_id,
        business_id,
        full_name,
        phone,
        email,
        birthday,
        notes,
        status,
        source,
        created_branch_id,
        owner_branch_id,
        last_visit_at,
        created_at,
        updated_at
      `,
      [
        fullName,
        normalizedPhone,
        cleanEmail,
        birthday,
        notes,
        status,
        source,
        owner_branch_id,
        id,
      ]
    );

    return res.json({
      ok: true,
      data: updateResult.rows[0],
    });
  } catch (e) {
    console.error("PATCH /clients/:id error:", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

/**
 * DELETE /api/v1/clients/:id
 */
router.delete("/:id", adminPlus, async (req, res) => {
  try {
    const id = Number(req.params.id);

    const result = await pool.query(
      `DELETE FROM clients WHERE id = $1 RETURNING id`,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /clients/:id error:", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

export default router;
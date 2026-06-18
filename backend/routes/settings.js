import express from "express";
import pool from "../db.js";
import { requireRole } from "../middleware/auth.js";

const router = express.Router();

const ALLOWED_BOOKING_TYPES = ["service", "room"];

/**
 * Returns business_id from JWT (or fallback 1)
 */
function getBusinessId(req) {
  return Number(req.user?.business_id || 1);
}

/**
 * GET /api/v1/settings
 * Available to any authenticated user — settings drive UI for everyone.
 */
router.get("/", async (req, res) => {
  try {
    const businessId = getBusinessId(req);
    const { rows } = await pool.query(
      `SELECT business_id, booking_type, updated_at
         FROM public.business_settings
        WHERE business_id = $1
        LIMIT 1`,
      [businessId]
    );

    // If no row exists yet, create one with defaults
    if (rows.length === 0) {
      const { rows: created } = await pool.query(
        `INSERT INTO public.business_settings (business_id, booking_type)
         VALUES ($1, 'service')
         ON CONFLICT (business_id) DO NOTHING
         RETURNING business_id, booking_type, updated_at`,
        [businessId]
      );
      return res.json(created[0] || { business_id: businessId, booking_type: "service" });
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error("GET /settings error:", err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/**
 * PUT /api/v1/settings
 * Owner only.
 * body: { booking_type: 'service' | 'room' }
 */
router.put("/", requireRole("owner"), async (req, res) => {
  try {
    const businessId = getBusinessId(req);
    const { booking_type } = req.body || {};

    if (!ALLOWED_BOOKING_TYPES.includes(booking_type)) {
      return res.status(400).json({
        error: "INVALID_BOOKING_TYPE",
        allowed: ALLOWED_BOOKING_TYPES,
      });
    }

    const { rows } = await pool.query(
      `INSERT INTO public.business_settings (business_id, booking_type, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (business_id) DO UPDATE
           SET booking_type = EXCLUDED.booking_type,
               updated_at   = NOW()
         RETURNING business_id, booking_type, updated_at`,
      [businessId, booking_type]
    );

    return res.json(rows[0]);
  } catch (err) {
    console.error("PUT /settings error:", err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
});

export default router;

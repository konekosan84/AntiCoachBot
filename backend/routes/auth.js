// ┌───────────────────────────────────────────┐
// │      SLOTIQ PRO — Auth Routes              │
// └───────────────────────────────────────────┘
import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../db.js";
import { requireAuth, JWT_SECRET } from "../middleware/auth.js";

const router = express.Router();

/**
 * POST /api/v1/auth/login
 * body: { email, password }
 * → { token, user: { id, email, name, role, business_id } }
 */
router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: "EMAIL_AND_PASSWORD_REQUIRED" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.name, u.password_hash, u.business_id, u.status,
              r.name AS role
         FROM public.users u
    LEFT JOIN public.roles r ON r.id = u.role_id
        WHERE LOWER(u.email) = LOWER($1)
        LIMIT 1`,
      [email]
    );

    const user = rows[0];
    if (!user)               return res.status(401).json({ error: "INVALID_CREDENTIALS" });
    if (user.status !== "active") return res.status(403).json({ error: "USER_INACTIVE" });

    // Support both bcrypt hashes and legacy plaintext (one-time migration safety net)
    let ok = false;
    if (user.password_hash?.startsWith("$2")) {
      ok = await bcrypt.compare(password, user.password_hash);
    } else {
      ok = password === user.password_hash;
      if (ok) {
        const newHash = await bcrypt.hash(password, 10);
        await pool.query("UPDATE public.users SET password_hash=$1 WHERE id=$2", [newHash, user.id]);
      }
    }

    if (!ok) return res.status(401).json({ error: "INVALID_CREDENTIALS" });

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role || "employee",
        business_id: user.business_id,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role || "employee",
        business_id: user.business_id,
      },
    });
  } catch (err) {
    console.error("POST /auth/login error:", err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/**
 * GET /api/v1/auth/me — current user (validates token, returns fresh data)
 */
router.get("/me", requireAuth, (req, res) => {
  const { id, email, name, role, business_id } = req.user;
  return res.json({ user: { id, email, name, role, business_id } });
});

/**
 * POST /api/v1/auth/logout — client-side just drops the token; this is a no-op stub
 */
router.post("/logout", (req, res) => res.json({ ok: true }));

export default router;

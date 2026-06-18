// ┌───────────────────────────────────────────┐
// │      SLOTIQ PRO — Auth Middleware         │
// │  Single source of truth. Don't duplicate. │
// └───────────────────────────────────────────┘
import jwt from "jsonwebtoken";
import pool from "../db.js";

const JWT_SECRET = process.env.JWT_SECRET || "supersecret_jwt_key_123";

/**
 * requireAuth — verifies JWT and loads fresh user data (role + business)
 * Populates req.user = { id, email, name, role, role_id, business_id, status }
 */
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: "NO_TOKEN" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: "INVALID_TOKEN" });
    }

    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.name, u.role_id, u.business_id, u.status,
              r.name AS role
         FROM public.users u
    LEFT JOIN public.roles r ON r.id = u.role_id
        WHERE u.id = $1`,
      [decoded.id]
    );

    const user = rows[0];
    if (!user)              return res.status(401).json({ error: "USER_NOT_FOUND" });
    if (user.status !== "active") return res.status(403).json({ error: "USER_INACTIVE" });

    req.user = user;
    next();
  } catch (err) {
    console.error("requireAuth error:", err);
    return res.status(500).json({ error: "AUTH_SERVER_ERROR" });
  }
}

/**
 * requireRole("owner", "admin") — allows only listed roles.
 * Must be used AFTER requireAuth.
 */
export function requireRole(...allowed) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "NOT_AUTHENTICATED" });
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ error: "FORBIDDEN", required: allowed });
    }
    next();
  };
}

// Shortcuts
export const requireOwner    = requireRole("owner");
export const requireAdmin    = requireRole("owner", "admin");
export const requireEmployee = requireRole("owner", "admin", "employee");

export { JWT_SECRET };

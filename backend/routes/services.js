import express from "express";
import pool from "../db.js";
import { requireRole } from "../middleware/auth.js";

const router = express.Router();
const adminPlus = requireRole("owner", "admin");

const num = (v) => (v === "" || v === undefined || v === null ? null : Number(v));

/* ─── Helper: replace branch links ─── */
async function setServiceBranches(db, serviceId, branchIds) {
  await db.query(`DELETE FROM service_branches WHERE service_id = $1`, [serviceId]);
  const list = Array.isArray(branchIds) ? branchIds.map(Number).filter(Boolean) : [];
  for (const bId of list) {
    await db.query(
      `INSERT INTO service_branches (service_id, branch_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [serviceId, bId]
    );
  }
}

/* ─── GET all (with branch_ids array) ─── */
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.*,
             COALESCE(
               (SELECT json_agg(sb.branch_id ORDER BY sb.branch_id)
                  FROM service_branches sb WHERE sb.service_id = s.id),
               '[]'
             ) AS branch_ids
        FROM services s
    ORDER BY s.id DESC
    `);
    res.json(rows);
  } catch (e) {
    console.error("GET SERVICES ERROR:", e);
    res.status(500).json({ error: "Failed to load services" });
  }
});

/* ─── CREATE ─── */
router.post("/", adminPlus, async (req, res) => {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const { name, price, duration, description, is_active, branch_ids } = req.body;

    const { rows } = await db.query(
      `INSERT INTO services (name, price, duration, description, is_active)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [name, num(price), num(duration), description ?? "", is_active ?? true]
    );
    const created = rows[0];

    await setServiceBranches(db, created.id, branch_ids);
    await db.query("COMMIT");

    // Re-fetch with branch_ids
    const reread = await pool.query(`
      SELECT s.*,
             COALESCE(
               (SELECT json_agg(sb.branch_id ORDER BY sb.branch_id)
                  FROM service_branches sb WHERE sb.service_id = s.id),
               '[]'
             ) AS branch_ids
        FROM services s WHERE s.id = $1`, [created.id]);
    res.json(reread.rows[0]);
  } catch (e) {
    await db.query("ROLLBACK").catch(() => {});
    console.error("CREATE service error:", e);
    res.status(500).json({ error: "Failed to create service" });
  } finally {
    db.release();
  }
});

/* ─── UPDATE ─── */
router.put("/:id", adminPlus, async (req, res) => {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const { id } = req.params;
    const { name, price, duration, description, is_active, branch_ids } = req.body;

    const { rows } = await db.query(
      `UPDATE services
          SET name=$1, price=$2, duration=$3, description=$4, is_active=$5
        WHERE id=$6
      RETURNING *`,
      [name, num(price), num(duration), description ?? "", is_active ?? true, id]
    );

    // Only update branch links if branch_ids was passed (so we don't wipe them accidentally)
    if (branch_ids !== undefined) {
      await setServiceBranches(db, id, branch_ids);
    }

    await db.query("COMMIT");

    const reread = await pool.query(`
      SELECT s.*,
             COALESCE(
               (SELECT json_agg(sb.branch_id ORDER BY sb.branch_id)
                  FROM service_branches sb WHERE sb.service_id = s.id),
               '[]'
             ) AS branch_ids
        FROM services s WHERE s.id = $1`, [id]);
    res.json(reread.rows[0]);
  } catch (e) {
    await db.query("ROLLBACK").catch(() => {});
    console.error("UPDATE service error:", e);
    res.status(500).json({ error: "Failed to update service" });
  } finally {
    db.release();
  }
});

/* ─── DELETE ─── */
router.delete("/:id", adminPlus, async (req, res) => {
  try {
    const { id } = req.params;
    // service_branches will cascade if we set ON DELETE CASCADE later;
    // for now delete explicitly to be safe.
    await pool.query("DELETE FROM service_branches WHERE service_id = $1", [id]);
    await pool.query("DELETE FROM services WHERE id=$1", [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE service error:", e);
    res.status(500).json({ error: "Failed to delete service" });
  }
});

export default router;

import express from "express";
import pool from "../db.js";
import { requireRole } from "../middleware/auth.js";

const router = express.Router();
const adminPlus = requireRole("owner", "admin");

/**
 * ROOMS
 * - rooms: базовые поля комнаты + primary branch_id
 * - branch_rooms: связь many-to-many (реальная доступность комнаты в филиалах)
 *
 * Паттерн как employees:
 * - CRUD комнаты отдельными запросами
 * - связь комнат ↔ филиалы отдельным endpoint: PUT /:id/branches
 */

/* ---------- GET ALL (с branch_ids) ---------- */
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        r.*,
        COALESCE(
          array_agg(br.branch_id) FILTER (WHERE br.branch_id IS NOT NULL),
          '{}'
        ) AS branch_ids
      FROM rooms r
      LEFT JOIN branch_rooms br ON br.room_id = r.id
      GROUP BY r.id
      ORDER BY r.id DESC
    `);

    res.json(rows);
  } catch (err) {
    console.error("❌ GET ROOMS ERROR:", err);
    res.status(500).json({ error: "Failed to load rooms", details: err.message });
  }
});

/* ---------- CREATE ---------- */
router.post("/", adminPlus, async (req, res) => {
  try {
    const { name, branch_id, capacity, description, is_active } = req.body;

    const { rows } = await pool.query(
      `INSERT INTO rooms (name, branch_id, capacity, description, is_active)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [
        name,
        branch_id ?? null,
        capacity ?? 1,
        description ?? "",
        is_active ?? true,
      ]
    );

    // Вернём созданную комнату. Связи филиалов сохраняются отдельным запросом.
    res.json({ ...rows[0], branch_ids: [] });
  } catch (err) {
    console.error("❌ CREATE ROOM ERROR:", err);
    res.status(500).json({ error: "Failed to create room", details: err.message });
  }
});

/* ---------- UPDATE ---------- */
router.put("/:id", adminPlus, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, branch_id, capacity, description, is_active } = req.body;

    const { rows } = await pool.query(
      `UPDATE rooms
       SET name=$1, branch_id=$2, capacity=$3, description=$4, is_active=$5
       WHERE id=$6
       RETURNING *`,
      [
        name,
        branch_id ?? null,
        capacity ?? 1,
        description ?? "",
        is_active ?? true,
        id,
      ]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error("❌ UPDATE ROOM ERROR:", err);
    res.status(500).json({ error: "Failed to update room", details: err.message });
  }
});

/* ---------- DELETE ---------- */
router.delete("/:id", adminPlus, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM rooms WHERE id=$1", [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error("❌ DELETE ROOM ERROR:", err);
    res.status(500).json({ error: "Failed to delete room", details: err.message });
  }
});

/* ---------- UPDATE ROOM ↔ BRANCHES (many-to-many) ---------- */
/**
 * body: { branch_ids: number[] }
 * логика:
 * 1) delete old relations
 * 2) insert new relations
 * 3) update rooms.branch_id = first branch_id (primary)
 */
router.put("/:id/branches", adminPlus, async (req, res) => {
  const client = await pool.connect();
  try {
    const roomId = Number(req.params.id);
    const branchIdsRaw = req.body?.branch_ids;

    const branchIds = Array.isArray(branchIdsRaw)
      ? branchIdsRaw.map(Number).filter(Boolean)
      : [];

    if (!roomId) {
      return res.status(400).json({ error: "Invalid room id" });
    }
    if (branchIds.length === 0) {
      return res.status(400).json({ error: "branch_ids is required" });
    }

    await client.query("BEGIN");

    await client.query(`DELETE FROM branch_rooms WHERE room_id = $1`, [roomId]);

    for (const bid of branchIds) {
      await client.query(
        `INSERT INTO branch_rooms (branch_id, room_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [bid, roomId]
      );
    }

    // Primary branch_id в rooms = первый из списка
    await client.query(`UPDATE rooms SET branch_id = $1 WHERE id = $2`, [
      branchIds[0],
      roomId,
    ]);

    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ UPDATE ROOM BRANCHES ERROR:", err);
    res
      .status(500)
      .json({ error: "Failed to update room branches", details: err.message });
  } finally {
    client.release();
  }
});

export default router;

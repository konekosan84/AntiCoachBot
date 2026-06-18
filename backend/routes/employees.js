import express from "express";
import pool from "../db.js";
import { requireRole } from "../middleware/auth.js";

const router = express.Router();
const adminPlus = requireRole("owner", "admin");

/**
 * GET /api/v1/employees
 * optional: ?branch_id=1  -> only employees attached to branch via branch_employees
 */
router.get("/", async (req, res) => {
  try {
    const { branch_id } = req.query;

    // Если branch_id задан — фильтруем сотрудников по связи branch_employees
    const params = [];
    let where = "";
    if (branch_id) {
      params.push(branch_id);
      where = `
        WHERE EXISTS (
          SELECT 1 FROM branch_employees be2
          WHERE be2.employee_id = e.id AND be2.branch_id = $1
        )
      `;
    }

    const { rows } = await pool.query(
      `
      SELECT 
        e.id,
        e.name,
        e.phone,
        e.email,
        e.position,
        e.role,
        e.status,
        e.description_client,
        e.internal_comment,
        e.photo_url,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', b.id,
              'name', b.name
            )
          ) FILTER (WHERE b.id IS NOT NULL),
          '[]'
        ) AS branches
      FROM employees e
      LEFT JOIN branch_employees be ON be.employee_id = e.id
      LEFT JOIN branches b ON b.id = be.branch_id
      ${where}
      GROUP BY e.id
      ORDER BY e.id;
      `,
      params
    );

    res.json(rows);
  } catch (err) {
    console.error("GET employees error:", err);
    res.status(500).json({ error: "Failed to load employees" });
  }
});

/**
 * POST /api/v1/employees
 */
router.post("/", adminPlus, async (req, res) => {
  const {
    name, phone, email, position, role, status,
    description_client, internal_comment, photo_url,
  } = req.body;

  try {
    const { rows } = await pool.query(
      `
      INSERT INTO employees
      (name, phone, email, position, role, status, description_client, internal_comment, photo_url)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *;
      `,
      [name, phone, email, position, role, status, description_client, internal_comment, photo_url || null]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error("CREATE employee error:", err);
    res.status(500).json({ error: "Failed to create employee" });
  }
});

/**
 * PUT /api/v1/employees/:id
 */
router.put("/:id", adminPlus, async (req, res) => {
  const { id } = req.params;
  const {
    name, phone, email, position, role, status,
    description_client, internal_comment, photo_url,
  } = req.body;

  try {
    const { rows } = await pool.query(
      `
      UPDATE employees SET
        name=$1, phone=$2, email=$3, position=$4, role=$5, status=$6,
        description_client=$7, internal_comment=$8, photo_url=$9
      WHERE id=$10
      RETURNING *;
      `,
      [name, phone, email, position, role, status, description_client, internal_comment, photo_url || null, id]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error("UPDATE employee error:", err);
    res.status(500).json({ error: "Failed to update employee" });
  }
});

/**
 * PUT /api/v1/employees/:id/branches
 */
router.put("/:id/branches", adminPlus, async (req, res) => {
  const { id } = req.params;
  const { branchIds } = req.body;

  try {
    await pool.query("BEGIN");

    await pool.query(`DELETE FROM branch_employees WHERE employee_id = $1`, [id]);

    for (const branchId of branchIds || []) {
      await pool.query(
        `
        INSERT INTO branch_employees (employee_id, branch_id)
        VALUES ($1, $2)
        `,
        [id, branchId]
      );
    }

    await pool.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("UPDATE employee branches error:", err);
    res.status(500).json({ error: "Failed to update employee branches" });
  }
});

export default router;

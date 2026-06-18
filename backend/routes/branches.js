import express from "express";
import pool from "../db.js";
import { requireRole } from "../middleware/auth.js";

const router = express.Router();

// write operations restricted to owners
const ownerOnly = requireRole("owner");

/* ---------------------------------------------------
   GET ALL BRANCHES (FIXATION VERSION)
--------------------------------------------------- */
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM public.branches ORDER BY id"
    );

    res.status(200).json(result.rows);
  } catch (err) {
    console.error("❌ GET BRANCHES ERROR:", err);
    res.status(500).json({
      error: "Failed to load branches",
      details: err.message
    });
  }
});

/* ---------------------------------------------------
   CREATE BRANCH
--------------------------------------------------- */
router.post("/", ownerOnly, async (req, res) => {
  const {
    name, address = "", phone = "", status = "active",
    schedule = {}, description_client = "", internal_comment = "",
    photo_url = null,
  } = req.body;

  if (!name) return res.status(400).json({ error: "Name is required" });

  try {
    const result = await pool.query(
      `
      INSERT INTO public.branches
        (name, address, phone, status, schedule, description_client, internal_comment, photo_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
      `,
      [name, address, phone, status, schedule, description_client, internal_comment, photo_url]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("❌ CREATE BRANCH ERROR:", err);
    res.status(500).json({
      error: "Failed to create branch",
      details: err.message
    });
  }
});

/* ---------------------------------------------------
   UPDATE BRANCH
--------------------------------------------------- */
router.put("/:id", ownerOnly, async (req, res) => {
  const { id } = req.params;
  const {
    name, address = "", phone = "", status = "active",
    schedule = {}, description_client = "", internal_comment = "",
    photo_url = null,
  } = req.body;

  if (!name) return res.status(400).json({ error: "Name is required" });

  try {
    const result = await pool.query(
      `
      UPDATE public.branches
      SET name = $1, address = $2, phone = $3, status = $4,
          schedule = $5, description_client = $6, internal_comment = $7, photo_url = $8
      WHERE id = $9
      RETURNING *
      `,
      [
        name,
        address,
        phone,
        status,
        schedule,
        description_client,
        internal_comment,
        photo_url,
        id
      ]
    );

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("❌ UPDATE BRANCH ERROR:", err);
    res.status(500).json({
      error: "Failed to update branch",
      details: err.message
    });
  }
});

/* ---------------------------------------------------
   DELETE BRANCH
--------------------------------------------------- */
router.delete("/:id", ownerOnly, async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query(
      "DELETE FROM public.branches WHERE id = $1",
      [id]
    );

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ DELETE BRANCH ERROR:", err);
    res.status(500).json({
      error: "Failed to delete branch",
      details: err.message
    });
  }
});

export default router;

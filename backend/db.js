// backend/db.js
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  host:     process.env.PG_HOST     || process.env.PGHOST     || "localhost",
  port:     Number(process.env.PG_PORT || process.env.PGPORT || 5432),
  user:     process.env.PG_USER     || process.env.PGUSER     || "postgres",
  password: process.env.PG_PASSWORD || process.env.PGPASSWORD || "",
  database: process.env.PG_DATABASE || process.env.PGDATABASE || "postgres",
});

export async function query(text, params) {
  return pool.query(text, params);
}

// экспорт по умолчанию (чтобы import pool from "../db.js" работал)
export default pool;

// и именованный экспорт (чтобы import { pool } from "../db.js" тоже можно было)
export { pool };
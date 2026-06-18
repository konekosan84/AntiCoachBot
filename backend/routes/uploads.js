import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const router = express.Router();

const UPLOADS_DIR = path.resolve("uploads");
const PHOTOS_DIR  = path.join(UPLOADS_DIR, "photos");

if (!fs.existsSync(PHOTOS_DIR)) fs.mkdirSync(PHOTOS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, PHOTOS_DIR),
  filename: (_req, file, cb) => {
    const ext  = (path.extname(file.originalname || "") || ".jpg").toLowerCase();
    const safe = ext.replace(/[^a-z0-9.]/g, "");
    const name = crypto.randomBytes(12).toString("hex") + safe;
    cb(null, name);
  },
});

const ALLOWED_MIME = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/avif",
]);

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) cb(null, true);
    else cb(new Error("UNSUPPORTED_FILE_TYPE"), false);
  },
});

/**
 * POST /api/v1/uploads/photo
 * multipart/form-data with field "file"
 * → { url: "/uploads/photos/<hash>.jpg" }
 */
router.post("/photo", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "NO_FILE" });
  const url = `/uploads/photos/${req.file.filename}`;
  return res.json({ url, size: req.file.size, mime: req.file.mimetype });
});

// Error handler (multer throws synchronously for invalid types/too big files)
router.use((err, _req, res, _next) => {
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "FILE_TOO_LARGE", max_bytes: 5 * 1024 * 1024 });
  }
  if (err?.message === "UNSUPPORTED_FILE_TYPE") {
    return res.status(415).json({ error: "UNSUPPORTED_FILE_TYPE" });
  }
  console.error("uploads error:", err);
  return res.status(500).json({ error: "UPLOAD_FAILED" });
});

export default router;

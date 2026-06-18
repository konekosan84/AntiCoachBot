import { useRef, useState } from "react";

const API_ORIGIN = "http://localhost:4000";

/**
 * <PhotoUpload value={url} onChange={url => ...} shape="circle" />
 * - shape: "circle" | "rect"
 * - size:  thumbnail size in px (default 96)
 * Stores URL like "/uploads/photos/abc.jpg" returned by backend.
 */
export default function PhotoUpload({
  value,
  onChange,
  shape = "circle",
  size = 96,
  label = "Загрузить фото",
}) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");

  const previewUrl = value
    ? (value.startsWith("http") ? value : API_ORIGIN + value)
    : null;

  async function handleFile(file) {
    if (!file) return;
    setErr(""); setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const token = localStorage.getItem("slotiq-token");
      const res = await fetch(`${API_ORIGIN}/api/v1/uploads/photo`, {
        method: "POST",
        body: fd,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "UPLOAD_FAILED");
      onChange?.(data.url);
    } catch (e) {
      const msg = e?.message || "Ошибка";
      setErr(msg === "FILE_TOO_LARGE" ? "Файл больше 5 МБ"
           : msg === "UNSUPPORTED_FILE_TYPE" ? "Только JPG/PNG/WEBP/GIF"
           : "Не удалось загрузить");
    } finally {
      setUploading(false);
    }
  }

  const radius = shape === "circle" ? "50%" : 14;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div
        onClick={() => inputRef.current?.click()}
        style={{
          width: size, height: size, borderRadius: radius,
          background: previewUrl ? `url(${previewUrl}) center/cover no-repeat` : "var(--bg-section)",
          border: "2px dashed var(--border)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--text-muted)", cursor: "pointer",
          fontSize: size > 80 ? 26 : 16,
          flexShrink: 0,
          position: "relative", overflow: "hidden",
        }}
        title="Кликни чтобы выбрать фото"
      >
        {!previewUrl && (uploading ? "…" : "📷")}
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          style={{
            padding: "7px 14px", borderRadius: 9, cursor: uploading ? "wait" : "pointer",
            border: "1px solid var(--border)",
            background: "var(--bg-card)",
            color: "var(--text-primary)", fontSize: 12, fontWeight: 600,
            opacity: uploading ? 0.7 : 1,
          }}
        >
          {uploading ? "Загружаю…" : (value ? "Заменить" : label)}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange?.(null)}
            style={{
              padding: "4px 10px", borderRadius: 8, cursor: "pointer",
              border: "1px solid rgba(239,68,68,0.35)",
              background: "transparent",
              color: "#fca5a5", fontSize: 11,
            }}
          >
            Убрать
          </button>
        )}
        {err && <div style={{ fontSize: 11, color: "#fca5a5" }}>{err}</div>}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
        style={{ display: "none" }}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}

export function PhotoUrl(url) {
  if (!url) return null;
  return url.startsWith("http") ? url : API_ORIGIN + url;
}

import { Download } from "lucide-react";

/**
 * Универсальная кнопка для скачивания CSV из /api/v1/export/<entity>.
 *   <ExportBtn entity="clients" />
 *   <ExportBtn entity="bookings" params={{ from: "...", to: "..." }} />
 */
export default function ExportBtn({ entity, params = {}, label = "Экспорт CSV", style }) {
  async function download() {
    const token = localStorage.getItem("slotiq-token");
    const qs = new URLSearchParams(params).toString();
    const url = `http://localhost:4000/api/v1/export/${entity}${qs ? "?" + qs : ""}`;
    try {
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("EXPORT_FAILED");
      const blob = await res.blob();
      const cd = res.headers.get("content-disposition") || "";
      const m  = cd.match(/filename="([^"]+)"/);
      const filename = m ? m[1] : `${entity}.csv`;
      const dlUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = dlUrl; a.download = filename;
      document.body.appendChild(a); a.click();
      a.remove(); URL.revokeObjectURL(dlUrl);
    } catch (e) {
      alert("Не удалось скачать CSV");
    }
  }

  return (
    <button onClick={download} style={{
      padding: "7px 12px", borderRadius: 9, cursor: "pointer",
      border: "1px solid var(--border)", background: "var(--bg-card)",
      color: "var(--text-secondary)", fontSize: 12, fontWeight: 600,
      display: "inline-flex", alignItems: "center", gap: 6,
      ...style,
    }}>
      <Download size={13} />
      {label}
    </button>
  );
}

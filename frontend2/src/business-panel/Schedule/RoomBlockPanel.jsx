import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../api/apiFetch.js";

/**
 * Side panel to BLOCK a room's time (cleaning, repair, internal use).
 * Creates a row in bookings with kind='block', no client.
 */
export default function RoomBlockPanel({
  open, branches = [], rooms = [], initial = null, onClose, onSaved,
}) {
  const [form, setForm] = useState(() => makeInitial(initial));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (open) { setForm(makeInitial(initial)); setErr(""); }
  }, [open, initial]);

  const filteredRooms = useMemo(() => {
    if (!form.branch_id) return [];
    const bid = Number(form.branch_id);
    return rooms.filter(r => {
      if (Array.isArray(r.branch_ids)) return r.branch_ids.includes(bid);
      if (r.branch_id != null) return Number(r.branch_id) === bid;
      return false;
    });
  }, [rooms, form.branch_id]);

  if (!open) return null;

  function set(key, value) { setForm(p => ({ ...p, [key]: value })); }

  async function save() {
    setErr("");
    if (!form.branch_id) return setErr("Выбери филиал");
    if (!form.room_id)   return setErr("Выбери помещение");
    if (!form.date)      return setErr("Укажи дату");
    if (form.end_time <= form.start_time) return setErr("Конец должен быть позже начала");

    setSaving(true);
    try {
      await apiFetch("/api/v1/room-bookings/block", {
        method: "POST",
        body: JSON.stringify({
          branch_id:  Number(form.branch_id),
          room_id:    Number(form.room_id),
          date:       form.date,
          start_time: form.start_time,
          end_time:   form.end_time,
          reason:     form.reason || null,
        }),
      });
      onSaved?.();
    } catch (e) {
      if (e?.payload?.error === "ROOM_OVERLAP") {
        const o = e.payload.overlap;
        setErr(`Пересечение с записью #${o.id}: ${o.start_time}–${o.end_time}`);
      } else {
        setErr(e?.message || "Ошибка");
      }
    } finally { setSaving(false); }
  }

  const inp = {
    padding: "7px 10px", borderRadius: 10,
    border: "1px solid var(--border-input)",
    background: "var(--bg-input)", color: "var(--text-primary)",
    fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box",
  };

  return (
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:99 }} />
      <div style={{
        position:"fixed", top:0, right:0, width:420, maxWidth:"94vw", height:"100vh", zIndex:100,
        background:"var(--bg-panel)", borderLeft:"1px solid var(--border)",
        boxShadow:"-14px 0 32px rgba(0,0,0,0.3)",
        display:"flex", flexDirection:"column",
      }}>
        <div style={{
          padding:"16px 20px", borderBottom:"1px solid var(--border)",
          display:"flex", alignItems:"center", justifyContent:"space-between",
        }}>
          <div style={{ fontSize:17, fontWeight:700, color:"var(--text-primary)" }}>🚧 Блокировать время</div>
          <button onClick={onClose} style={{
            width:32, height:32, borderRadius:10, cursor:"pointer",
            border:"1px solid var(--border)", background:"var(--bg-card)",
            color:"var(--text-secondary)", fontSize:16,
          }}>✕</button>
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:20, display:"grid", gap:12 }}>
          <div style={{
            padding:"10px 12px", borderRadius:10, fontSize:12, color:"var(--text-secondary)",
            background:"rgba(245,158,11,0.10)", border:"1px solid rgba(245,158,11,0.30)",
          }}>
            В это время помещение будет недоступно для броней клиентов (уборка, ремонт и т.п.)
          </div>

          {err && (
            <div style={{ padding:"10px 12px", borderRadius:10,
              border:"1px solid rgba(239,68,68,0.35)", background:"rgba(239,68,68,0.10)",
              fontSize:13, color:"#fca5a5", whiteSpace:"pre-line",
            }}>{err}</div>
          )}

          <Field label="Филиал">
            <select style={inp} value={form.branch_id} onChange={e=>{set("branch_id", e.target.value); set("room_id","");}}>
              <option value="">Выбрать…</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>

          <Field label="Помещение">
            <select style={inp} value={form.room_id} onChange={e=>set("room_id", e.target.value)} disabled={!form.branch_id}>
              <option value="">{form.branch_id ? "Выбрать…" : "Сначала выберите филиал"}</option>
              {filteredRooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </Field>

          <Field label="Дата">
            <input type="date" style={inp} value={form.date} onChange={e=>set("date", e.target.value)} />
          </Field>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <Field label="Начало"><input type="time" style={inp} value={form.start_time} onChange={e=>set("start_time", e.target.value)} /></Field>
            <Field label="Конец"> <input type="time" style={inp} value={form.end_time}   onChange={e=>set("end_time", e.target.value)} /></Field>
          </div>

          <Field label="Причина (для своих заметок)">
            <input style={inp} value={form.reason} onChange={e=>set("reason", e.target.value)} placeholder="Уборка, ремонт, …" />
          </Field>
        </div>

        <div style={{
          padding:"14px 20px", borderTop:"1px solid var(--border)",
          display:"flex", gap:10, background:"var(--bg-panel)",
        }}>
          <button onClick={save} disabled={saving} style={{
            flex:1, padding:"10px 0", borderRadius:10, border:"none", cursor: saving?"wait":"pointer",
            background: saving ? "var(--bg-card)" : "linear-gradient(90deg, #f59e0b, #ef4444)",
            color:"#fff", fontWeight:700, fontSize:13, opacity: saving ? 0.7 : 1,
          }}>{saving ? "Сохраняю…" : "Заблокировать"}</button>
          <button onClick={onClose} style={{
            padding:"10px 18px", borderRadius:10, cursor:"pointer",
            border:"1px solid var(--border)", background:"var(--bg-card)",
            color:"var(--text-secondary)", fontSize:13,
          }}>Отмена</button>
        </div>
      </div>
    </>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display:"grid", gap:4 }}>
      <div style={{ fontSize:12, color:"var(--text-muted)" }}>{label}</div>
      {children}
    </div>
  );
}

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function makeInitial(src) {
  return {
    branch_id:  src?.branch_id  ?? "",
    room_id:    src?.room_id    ?? "",
    date:       src?.date       ?? todayYmd(),
    start_time: src?.start_time ?? "10:00",
    end_time:   src?.end_time   ?? "12:00",
    reason:     "",
  };
}

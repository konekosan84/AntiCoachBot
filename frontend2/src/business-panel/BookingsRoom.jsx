import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api/apiFetch.js";
import { formatRuPhone, toRawPhone } from "../helpers/phoneMask.js";
import { useToast } from "../helpers/ToastContext.jsx";

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function daysAgoYmd(n) {
  const d = new Date(); d.setDate(d.getDate()-n);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function daysAheadYmd(n) {
  const d = new Date(); d.setDate(d.getDate()+n);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function formatPhone(p) {
  const d = String(p||"").replace(/\D/g,"");
  if (d.length !== 11) return p || "—";
  return `+${d[0]} (${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7,9)}-${d.slice(9)}`;
}

const STATUS_STYLE = {
  booked:    { bg:"var(--badge-booked-bg)",   color:"var(--badge-booked-text)",   border:"var(--badge-booked-border)",  label:"Запись" },
  completed: { bg:"var(--badge-done-bg)",     color:"var(--badge-done-text)",     border:"var(--badge-done-border)",    label:"Выполнено" },
  cancelled: { bg:"var(--badge-cancel-bg)",   color:"var(--badge-cancel-text)",   border:"var(--badge-cancel-border)",  label:"Отменено" },
};

export default function BookingsRoom() {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [rooms, setRooms]       = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [from, setFrom] = useState(daysAgoYmd(7));
  const [to, setTo]     = useState(daysAheadYmd(30));
  const [branchFilter, setBranchFilter] = useState("");
  const [roomFilter, setRoomFilter]     = useState("");
  const [panelOpen, setPanelOpen]       = useState(false);

  async function loadAll() {
    setLoading(true);
    try {
      const [b, r] = await Promise.all([
        apiFetch("/api/v1/branches").catch(() => []),
        apiFetch("/api/v1/rooms").catch(() => []),
      ]);
      setBranches(Array.isArray(b) ? b : []);
      setRooms(Array.isArray(r) ? r : []);
      await loadBookings();
    } finally {
      setLoading(false);
    }
  }

  async function loadBookings() {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to)   params.set("to", to);
    if (branchFilter) params.set("branch_id", branchFilter);
    if (roomFilter)   params.set("room_id", roomFilter);
    const qs = params.toString();
    try {
      const data = await apiFetch(`/api/v1/room-bookings${qs ? "?"+qs : ""}`);
      setBookings(Array.isArray(data) ? data : []);
    } catch {
      setBookings([]);
    }
  }

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { loadBookings(); }, [from, to, branchFilter, roomFilter]);

  const filteredRooms = useMemo(() => {
    if (!branchFilter) return rooms;
    const bid = Number(branchFilter);
    return rooms.filter(r => {
      if (Array.isArray(r.branch_ids)) return r.branch_ids.includes(bid);
      if (r.branch_id != null) return Number(r.branch_id) === bid;
      return true;
    });
  }, [rooms, branchFilter]);

  async function handleDelete(id) {
    if (!confirm("Удалить эту бронь?")) return;
    try {
      await apiFetch(`/api/v1/room-bookings/${id}`, { method: "DELETE" });
      loadBookings();
    } catch (e) { toast.error("Ошибка удаления: " + (e?.message || "")); }
  }

  const inp = {
    padding: "8px 11px", borderRadius: 9,
    border: "1px solid var(--border-input)",
    background: "var(--bg-input)", color: "var(--text-primary)",
    fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box",
  };

  return (
    <div style={{ padding: "18px 20px", maxWidth: 1300, margin: "0 auto", display: "grid", gap: 16 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 21, fontWeight: 800, color: "var(--text-primary)" }}>Брони помещений</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Аренда залов / комнат / помещений</div>
        </div>
        <button
          onClick={() => setPanelOpen(true)}
          style={{
            padding: "9px 18px", borderRadius: 10, border: "none", cursor: "pointer",
            background: "linear-gradient(90deg, #3acfd5, #6558f5)",
            color: "#fff", fontWeight: 700, fontSize: 13,
          }}
        >
          + Новая бронь
        </button>
      </div>

      {/* Filters */}
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: 14, padding: "12px 14px",
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10,
      }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>С</div>
          <input type="date" style={inp} value={from} onChange={e=>setFrom(e.target.value)} />
        </div>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>По</div>
          <input type="date" style={inp} value={to} onChange={e=>setTo(e.target.value)} />
        </div>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Филиал</div>
          <select style={inp} value={branchFilter} onChange={e=>{setBranchFilter(e.target.value); setRoomFilter("");}}>
            <option value="">Все</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Помещение</div>
          <select style={inp} value={roomFilter} onChange={e=>setRoomFilter(e.target.value)}>
            <option value="">Все</option>
            {filteredRooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Загрузка…</div>
      ) : bookings.length === 0 ? (
        <div style={{
          padding: 40, textAlign: "center", color: "var(--text-muted)",
          background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14,
        }}>
          Нет броней за выбранный период
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {bookings.map(b => {
            const s = STATUS_STYLE[b.status] || STATUS_STYLE.booked;
            return (
              <div key={b.id} style={{
                background: "var(--bg-card)", border: "1px solid var(--border)",
                borderRadius: 12, padding: "12px 14px",
                display: "grid", gap: 8,
                gridTemplateColumns: "minmax(0,1fr) auto", alignItems: "center",
              }}>
                <div style={{ display: "grid", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                      {b.room_name || `Помещение #${b.room_id}`}
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6,
                      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
                    }}>
                      {s.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    📅 {b.date} · 🕐 {b.start_time?.slice(0,5)}–{b.end_time?.slice(0,5)} · 🏢 {b.branch_name}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    👤 {b.client_name || "—"} · {formatPhone(b.client_phone)}
                    {b.price ? ` · ${b.price} ₽` : ""}
                  </div>
                  {b.notes && (
                    <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
                      💬 {b.notes}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(b.id)}
                  style={{
                    padding: "6px 10px", borderRadius: 8, cursor: "pointer",
                    border: "1px solid rgba(239,68,68,0.4)",
                    background: "rgba(239,68,68,0.10)", color: "#fca5a5", fontSize: 12,
                  }}
                >
                  Удалить
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* New booking panel */}
      {panelOpen && (
        <NewBookingPanel
          branches={branches}
          rooms={rooms}
          onClose={() => setPanelOpen(false)}
          onSaved={() => { setPanelOpen(false); loadBookings(); }}
        />
      )}
    </div>
  );
}

/* ─── Side panel for creating a booking ─── */
function NewBookingPanel({ branches, rooms, onClose, onSaved }) {
  const [form, setForm] = useState({
    branch_id: "", room_id: "",
    date: todayYmd(), start_time: "10:00", end_time: "12:00",
    client_name: "", client_phone: "",
    price: "", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const filteredRooms = useMemo(() => {
    if (!form.branch_id) return [];
    const bid = Number(form.branch_id);
    return rooms.filter(r => {
      if (Array.isArray(r.branch_ids)) return r.branch_ids.includes(bid);
      if (r.branch_id != null) return Number(r.branch_id) === bid;
      return false;
    });
  }, [rooms, form.branch_id]);

  function set(key, value) { setForm(p => ({ ...p, [key]: value })); }

  async function save() {
    setErr("");
    if (!form.branch_id)   return setErr("Выбери филиал");
    if (!form.room_id)     return setErr("Выбери помещение");
    if (!form.date)        return setErr("Укажи дату");
    if (form.end_time <= form.start_time) return setErr("Конец должен быть позже начала");
    if (!form.client_phone) return setErr("Укажи телефон клиента");

    setSaving(true);
    try {
      const payload = {
        branch_id: Number(form.branch_id),
        room_id:   Number(form.room_id),
        date: form.date,
        start_time: form.start_time,
        end_time:   form.end_time,
        client_name: form.client_name,
        client_phone: toRawPhone(form.client_phone),
        notes: form.notes || null,
        price: form.price ? Number(form.price) : null,
      };
      await apiFetch("/api/v1/room-bookings", { method: "POST", body: JSON.stringify(payload) });
      onSaved?.();
    } catch (e) {
      if (e?.payload?.error === "ROOM_OVERLAP") {
        const o = e.payload.overlap;
        setErr(`Пересечение с бронью #${o.id}: ${o.start_time}–${o.end_time}`);
      } else if (e?.payload?.error === "PHONE_INVALID") {
        setErr("Телефон некорректный (нужно 10-11 цифр)");
      } else {
        setErr(e?.message || "Ошибка сохранения");
      }
    } finally {
      setSaving(false);
    }
  }

  const inp = {
    padding: "9px 12px", borderRadius: 10,
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
          <div style={{ fontSize:17, fontWeight:700, color:"var(--text-primary)" }}>Новая бронь</div>
          <button onClick={onClose} style={{
            width:32, height:32, borderRadius:10, cursor:"pointer",
            border:"1px solid var(--border)", background:"var(--bg-card)",
            color:"var(--text-secondary)", fontSize:16,
          }}>✕</button>
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:20, display:"grid", gap:12 }}>
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
            {form.branch_id && filteredRooms.length === 0 && (
              <div style={{ fontSize:11, color:"#fca5a5", marginTop:4 }}>
                Нет помещений в этом филиале
              </div>
            )}
          </Field>

          <Field label="Дата">
            <input type="date" style={inp} value={form.date} onChange={e=>set("date", e.target.value)} />
          </Field>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <Field label="Начало">
              <input type="time" style={inp} value={form.start_time} onChange={e=>set("start_time", e.target.value)} />
            </Field>
            <Field label="Конец">
              <input type="time" style={inp} value={form.end_time} onChange={e=>set("end_time", e.target.value)} />
            </Field>
          </div>

          <Field label="Имя клиента">
            <input style={inp} value={form.client_name} onChange={e=>set("client_name", e.target.value)} placeholder="Иванов Иван" />
          </Field>

          <Field label="Телефон">
            <input
              style={inp}
              value={form.client_phone}
              onChange={e => set("client_phone", formatRuPhone(e.target.value))}
              onFocus={e => { if (!form.client_phone) set("client_phone", "+7 ("); }}
              placeholder="+7 (___) ___-__-__"
              inputMode="tel"
            />
          </Field>

          <Field label="Цена (опционально)">
            <input type="number" style={inp} value={form.price} onChange={e=>set("price", e.target.value)} placeholder="0" />
          </Field>

          <Field label="Комментарий">
            <textarea style={{...inp, minHeight:70, resize:"vertical"}} value={form.notes} onChange={e=>set("notes", e.target.value)} />
          </Field>
        </div>

        <div style={{
          padding:"14px 20px", borderTop:"1px solid var(--border)",
          display:"flex", gap:10, background:"var(--bg-panel)",
        }}>
          <button onClick={save} disabled={saving} style={{
            flex:1, padding:"10px 0", borderRadius:10, border:"none", cursor: saving?"wait":"pointer",
            background: saving ? "var(--bg-card)" : "linear-gradient(90deg, #3acfd5, #6558f5)",
            color:"#fff", fontWeight:700, fontSize:13, opacity: saving ? 0.7 : 1,
          }}>
            {saving ? "Сохраняю…" : "Сохранить"}
          </button>
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

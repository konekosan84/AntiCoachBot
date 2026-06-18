import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api/apiFetch.js";
import RoomBookingPanel from "./Schedule/RoomBookingPanel.jsx";
import RoomBlockPanel   from "./Schedule/RoomBlockPanel.jsx";

function pad(n) { return String(n).padStart(2,"0"); }
function toYmd(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function todayYmd() { return toYmd(new Date()); }
function addDays(ymd, n) {
  const [y,m,d] = ymd.split("-").map(Number);
  const dt = new Date(y, m-1, d);
  dt.setDate(dt.getDate()+n);
  return toYmd(dt);
}
function startOfWeek(ymd) {
  const [y,m,d] = ymd.split("-").map(Number);
  const dt = new Date(y, m-1, d);
  const dow = (dt.getDay()+6)%7; // Mon=0..Sun=6
  dt.setDate(dt.getDate()-dow);
  return toYmd(dt);
}
function weekDates(anchor) {
  const start = startOfWeek(anchor);
  return Array.from({length:7}, (_,i) => addDays(start, i));
}
const DOW = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

export default function ScheduleRoom() {
  const [anchor, setAnchor] = useState(todayYmd());
  const [branches, setBranches] = useState([]);
  const [rooms, setRooms]       = useState([]);
  const [branchId, setBranchId] = useState("");
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelInitial, setPanelInitial] = useState(null);
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockInitial, setBlockInitial] = useState(null);

  const dates = useMemo(() => weekDates(anchor), [anchor]);
  const dateFrom = dates[0];
  const dateTo   = dates[6];

  useEffect(() => {
    Promise.all([
      apiFetch("/api/v1/branches").catch(()=>[]),
      apiFetch("/api/v1/rooms").catch(()=>[]),
    ]).then(([b, r]) => {
      setBranches(Array.isArray(b) ? b : []);
      setRooms(Array.isArray(r) ? r : []);
    });
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ from: dateFrom, to: dateTo });
        if (branchId) params.set("branch_id", branchId);
        const data = await apiFetch(`/api/v1/room-bookings?${params}`);
        setBookings(Array.isArray(data) ? data : []);
      } catch {
        setBookings([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [dateFrom, dateTo, branchId]);

  const filteredRooms = useMemo(() => {
    if (!branchId) return rooms;
    const bid = Number(branchId);
    return rooms.filter(r => {
      if (Array.isArray(r.branch_ids)) return r.branch_ids.includes(bid);
      if (r.branch_id != null) return Number(r.branch_id) === bid;
      return false;
    });
  }, [rooms, branchId]);

  // group bookings by room_id + date
  const bookingsMap = useMemo(() => {
    const map = new Map();
    for (const b of bookings) {
      const key = `${b.room_id}|${b.date?.slice(0,10)}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(b);
    }
    // sort each group by start_time
    for (const arr of map.values()) {
      arr.sort((a,b) => String(a.start_time).localeCompare(String(b.start_time)));
    }
    return map;
  }, [bookings]);

  const ctrl = {
    padding: "7px 11px", borderRadius: 9,
    border: "1px solid var(--border-input)",
    background: "var(--bg-input)", color: "var(--text-primary)",
    fontSize: 13, outline: "none", cursor: "pointer",
  };
  const btn = {
    padding: "7px 12px", borderRadius: 9, cursor: "pointer",
    border: "1px solid var(--border)", background: "var(--bg-card)",
    color: "var(--text-primary)", fontSize: 13,
  };

  return (
    <div style={{ padding: "18px 20px", maxWidth: 1500, margin: "0 auto", display: "grid", gap: 14 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 21, fontWeight: 800, color: "var(--text-primary)" }}>Расписание помещений</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            Неделя {dateFrom} — {dateTo}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => { setBlockInitial(null); setBlockOpen(true); }}
            style={{
              padding: "9px 14px", borderRadius: 10, cursor: "pointer",
              border: "1px solid rgba(245,158,11,0.4)",
              background: "rgba(245,158,11,0.10)",
              color: "#fbbf24", fontWeight: 600, fontSize: 13,
            }}
          >
            🚧 Заблокировать время
          </button>
          <button
            onClick={() => { setPanelInitial(null); setPanelOpen(true); }}
            style={{
              padding: "9px 16px", borderRadius: 10, border: "none", cursor: "pointer",
              background: "linear-gradient(90deg, #3acfd5, #6558f5)",
              color: "#fff", fontWeight: 700, fontSize: 13,
            }}
          >
            + Новая бронь
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button style={btn} onClick={() => setAnchor(addDays(anchor, -7))}>‹ Неделя</button>
        <button style={btn} onClick={() => setAnchor(todayYmd())}>Сегодня</button>
        <button style={btn} onClick={() => setAnchor(addDays(anchor, 7))}>Неделя ›</button>
        <input type="date" style={ctrl} value={anchor} onChange={e => setAnchor(e.target.value)} />
        <select style={ctrl} value={branchId} onChange={e => setBranchId(e.target.value)}>
          <option value="">Все филиалы</option>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      {/* Grid */}
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: 14, overflow: "auto",
      }}>
        {loading ? (
          <div style={{ padding: 30, textAlign: "center", color: "var(--text-muted)" }}>Загрузка…</div>
        ) : filteredRooms.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "var(--text-muted)" }}>
            {branchId ? "В этом филиале нет помещений" : "Помещений ещё нет — создай на странице «Помещения»"}
          </div>
        ) : (
          <div style={{ minWidth: 820 }}>
            {/* Header row */}
            <div style={{
              display: "grid",
              gridTemplateColumns: `200px repeat(7, minmax(110px, 1fr))`,
              borderBottom: "1px solid var(--border)",
              background: "var(--bg-th)",
            }}>
              <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Помещение</div>
              {dates.map((d, i) => {
                const isToday = d === todayYmd();
                return (
                  <div key={d} style={{
                    padding: "10px 8px", fontSize: 12, fontWeight: 600,
                    color: isToday ? "#3acfd5" : "var(--text-muted)",
                    textAlign: "center", borderLeft: "1px solid var(--border)",
                  }}>
                    <div>{DOW[i]}</div>
                    <div style={{ fontSize: 11, opacity: 0.7 }}>{d.slice(5)}</div>
                  </div>
                );
              })}
            </div>

            {/* Body rows */}
            {filteredRooms.map(r => (
              <div key={r.id} style={{
                display: "grid",
                gridTemplateColumns: `200px repeat(7, minmax(110px, 1fr))`,
                borderBottom: "1px solid var(--border-row)",
              }}>
                <div style={{ padding: "10px 12px", fontSize: 13, color: "var(--text-primary)", fontWeight: 600 }}>
                  {r.name}
                  {r.capacity ? <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>Вместимость: {r.capacity}</div> : null}
                </div>
                {dates.map(d => {
                  const items = bookingsMap.get(`${r.id}|${d}`) || [];
                  return (
                    <div
                      key={d}
                      onClick={() => {
                        const branch = branchId || (Array.isArray(r.branch_ids) ? r.branch_ids[0] : r.branch_id) || "";
                        const choice = window.confirm(
                          "Создать БРОНЬ клиента?\n\nОК — Бронь клиента\nОтмена — Заблокировать время"
                        );
                        const init = { branch_id: branch, room_id: r.id, date: d };
                        if (choice) { setPanelInitial(init); setPanelOpen(true); }
                        else        { setBlockInitial(init); setBlockOpen(true); }
                      }}
                      style={{
                        padding: 6, borderLeft: "1px solid var(--border)",
                        display: "flex", flexDirection: "column", gap: 4,
                        minHeight: 60, cursor: "pointer",
                      }}>
                      {items.length === 0 ? (
                        <div style={{ fontSize: 12, color: "var(--text-muted)", opacity: 0.5, textAlign: "center", paddingTop: 14 }}>—</div>
                      ) : items.map(b => {
                        const isBlock = b.kind === "block";
                        return (
                          <div key={b.id} title={isBlock ? (b.notes || "Заблокировано") : `${b.client_name||"—"}\n${b.notes||""}`} style={{
                            fontSize: 11, padding: "4px 6px", borderRadius: 6,
                            background: isBlock
                              ? "repeating-linear-gradient(45deg, rgba(245,158,11,0.18) 0 6px, rgba(245,158,11,0.08) 6px 12px)"
                              : (b.status==="cancelled" ? "var(--badge-cancel-bg)" : "var(--badge-booked-bg)"),
                            color: isBlock
                              ? "#fbbf24"
                              : (b.status==="cancelled" ? "var(--badge-cancel-text)" : "var(--badge-booked-text)"),
                            border: `1px solid ${
                              isBlock ? "rgba(245,158,11,0.40)" :
                              (b.status==="cancelled" ? "var(--badge-cancel-border)" : "var(--badge-booked-border)")
                            }`,
                            lineHeight: 1.3,
                          }}>
                            <div style={{ fontWeight: 700 }}>
                              {isBlock ? "🚧 " : ""}{String(b.start_time).slice(0,5)}–{String(b.end_time).slice(0,5)}
                            </div>
                            <div style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                              {isBlock ? (b.notes || "Заблокировано") : (b.client_name || "Без имени")}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      <RoomBookingPanel
        open={panelOpen}
        branches={branches}
        rooms={rooms}
        initial={panelInitial}
        onClose={() => setPanelOpen(false)}
        onSaved={() => { setPanelOpen(false); reloadBookings(); }}
      />

      <RoomBlockPanel
        open={blockOpen}
        branches={branches}
        rooms={rooms}
        initial={blockInitial}
        onClose={() => setBlockOpen(false)}
        onSaved={() => { setBlockOpen(false); reloadBookings(); }}
      />
    </div>
  );

  function reloadBookings() {
    const params = new URLSearchParams({ from: dateFrom, to: dateTo });
    if (branchId) params.set("branch_id", branchId);
    apiFetch(`/api/v1/room-bookings?${params}`).then(d => setBookings(Array.isArray(d)?d:[])).catch(()=>{});
  }
}

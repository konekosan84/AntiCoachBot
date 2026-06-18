import { createContext, useContext, useState, useCallback, useEffect } from "react";

const ToastContext = createContext(null);

let _idSeed = 0;
const nextId = () => ++_idSeed;

const COLORS = {
  success: { bg: "rgba(34,197,94,0.12)",  border: "rgba(34,197,94,0.45)",  fg: "#86efac", icon: "✓" },
  error:   { bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.45)",  fg: "#fca5a5", icon: "✕" },
  warning: { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.45)", fg: "#fcd34d", icon: "⚠" },
  info:    { bg: "rgba(58,207,213,0.12)", border: "rgba(58,207,213,0.45)", fg: "#7dd3fc", icon: "i" },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts(list => list.filter(t => t.id !== id));
  }, []);

  const show = useCallback((message, opts = {}) => {
    const id = nextId();
    const type = opts.type || "info";
    const ttl  = opts.ttl ?? 4000;
    setToasts(list => [...list, { id, type, message, ttl }]);
    if (ttl > 0) setTimeout(() => dismiss(id), ttl);
    return id;
  }, [dismiss]);

  const api = {
    show,
    success: (msg, opts) => show(msg, { ...opts, type: "success" }),
    error:   (msg, opts) => show(msg, { ...opts, type: "error", ttl: opts?.ttl ?? 6000 }),
    warning: (msg, opts) => show(msg, { ...opts, type: "warning" }),
    info:    (msg, opts) => show(msg, { ...opts, type: "info" }),
    dismiss,
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({ toasts, dismiss }) {
  return (
    <div style={{
      position: "fixed", right: 18, bottom: 18, zIndex: 9999,
      display: "flex", flexDirection: "column", gap: 10,
      pointerEvents: "none",
    }}>
      {toasts.map(t => <ToastItem key={t.id} toast={t} onClose={() => dismiss(t.id)} />)}
    </div>
  );
}

function ToastItem({ toast, onClose }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const c = COLORS[toast.type] || COLORS.info;

  return (
    <div style={{
      pointerEvents: "auto",
      minWidth: 280, maxWidth: 380,
      padding: "12px 14px", borderRadius: 12,
      background: "var(--bg-panel)",
      border: `1px solid ${c.border}`,
      boxShadow: "0 14px 30px rgba(0,0,0,0.30)",
      display: "flex", alignItems: "flex-start", gap: 10,
      transform: visible ? "translateX(0)" : "translateX(120%)",
      opacity: visible ? 1 : 0,
      transition: "transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.25s",
    }}>
      <div style={{
        width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
        background: c.bg, color: c.fg,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, fontWeight: 700,
        border: `1px solid ${c.border}`,
      }}>
        {c.icon}
      </div>
      <div style={{ flex: 1, fontSize: 13, color: "var(--text-primary)", lineHeight: 1.4, whiteSpace: "pre-line" }}>
        {toast.message}
      </div>
      <button
        onClick={onClose}
        style={{
          width: 22, height: 22, borderRadius: 6,
          border: "none", background: "transparent",
          color: "var(--text-muted)", cursor: "pointer", fontSize: 16,
          lineHeight: 1, padding: 0,
        }}
        title="Закрыть"
      >×</button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast() must be inside <ToastProvider>");
  return ctx;
}

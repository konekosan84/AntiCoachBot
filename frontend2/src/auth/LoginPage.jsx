import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../helpers/AuthContext.jsx";

const ERR_LABELS = {
  EMAIL_AND_PASSWORD_REQUIRED: "Введите email и пароль",
  INVALID_CREDENTIALS:         "Неверный email или пароль",
  USER_INACTIVE:               "Пользователь отключён",
  LOGIN_FAILED:                "Не удалось войти. Проверьте подключение.",
};

export default function LoginPage() {
  const { login, error, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [focusEmail, setFocusEmail] = useState(false);
  const [focusPwd, setFocusPwd]     = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const ok = await login(email.trim(), password);
    if (ok) {
      const target = location.state?.from?.pathname || "/dashboard";
      navigate(target, { replace: true });
    }
  }

  const inp = (focused) => ({
    padding: "12px 16px",
    borderRadius: 12,
    border: `2px solid ${focused ? "#3acfd5" : "rgba(255,255,255,0.18)"}`,
    background: "rgba(255,255,255,0.06)",
    color: "#fff",
    fontSize: 15,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    transition: "border-color 0.15s",
  });

  const labelStyle = {
    fontSize: 12,
    color: "rgba(255,255,255,0.65)",
    fontWeight: 600,
    marginBottom: 6,
    display: "block",
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: `
        radial-gradient(circle at 20% 20%, rgba(58,207,213,0.18), transparent 50%),
        radial-gradient(circle at 80% 80%, rgba(101,88,245,0.22), transparent 50%),
        #0a0e1a`,
      padding: 20,
    }}>
      <div style={{
        width: "100%",
        maxWidth: 400,
        padding: 32,
        background: "linear-gradient(180deg, rgba(20,28,48,0.95), rgba(13,18,34,0.95))",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 20,
        boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.02) inset",
        backdropFilter: "blur(20px)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 56, height: 56, borderRadius: 14,
            background: "linear-gradient(135deg, #3acfd5, #6558f5)",
            marginBottom: 12, fontSize: 28,
          }}>
            🚀
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>
            SLOTIQ PRO
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>
            Вход в бизнес-панель
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              placeholder="owner@slotiq.pro"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setFocusEmail(true)}
              onBlur={() => setFocusEmail(false)}
              style={inp(focusEmail)}
              autoFocus
              required
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Пароль</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setFocusPwd(true)}
              onBlur={() => setFocusPwd(false)}
              style={inp(focusPwd)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "13px 0",
              borderRadius: 12,
              border: "none",
              cursor: loading ? "wait" : "pointer",
              background: "linear-gradient(90deg, #3acfd5, #6558f5)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 15,
              letterSpacing: "0.02em",
              opacity: loading ? 0.7 : 1,
              boxShadow: "0 6px 20px rgba(101,88,245,0.35)",
              transition: "transform 0.1s",
            }}
            onMouseDown={(e) => e.currentTarget.style.transform = "scale(0.98)"}
            onMouseUp={(e) => e.currentTarget.style.transform = "scale(1)"}
          >
            {loading ? "Вход…" : "Войти"}
          </button>
        </form>

        {error && (
          <div style={{
            marginTop: 16,
            padding: "11px 14px",
            borderRadius: 10,
            border: "1px solid rgba(239,68,68,0.4)",
            background: "rgba(239,68,68,0.12)",
            fontSize: 13,
            color: "#fca5a5",
            textAlign: "center",
          }}>
            {ERR_LABELS[error] || error}
          </div>
        )}

        <div style={{
          marginTop: 22, paddingTop: 18,
          borderTop: "1px solid rgba(255,255,255,0.08)",
          fontSize: 12, color: "rgba(255,255,255,0.45)",
          textAlign: "center",
        }}>
          Демо-доступ: <code style={{ color: "#3acfd5" }}>owner@slotiq.pro</code> / <code style={{ color: "#3acfd5" }}>admin123</code>
        </div>
      </div>
    </div>
  );
}

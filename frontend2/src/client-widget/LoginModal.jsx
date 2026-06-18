import { useEffect, useState } from "react";
import { Phone, ArrowRight, Loader2, X } from "lucide-react";
import { useClientAuth } from "../helpers/ClientAuthContext.jsx";
import { formatRuPhone, toRawPhone } from "../helpers/phoneMask.js";
import { getTheme } from "./theme.js";

/**
 * Two-step phone+OTP login modal for the booking widget.
 * onSuccess() called after successful verification.
 */
export default function LoginModal({ open, onClose, onSuccess, theme }) {
  const T = theme || getTheme("dark");
  const { lookup, sendCode, verify } = useClientAuth();

  const [step, setStep] = useState("phone"); // phone | code
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [code, setCode] = useState("");
  const [knownClient, setKnownClient] = useState(null);
  const [devCode, setDevCode] = useState(null);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (open) {
      setStep("phone"); setPhone(""); setFullName(""); setCode("");
      setKnownClient(null); setDevCode(null); setErr("");
    }
  }, [open]);

  if (!open) return null;

  async function handlePhoneSubmit() {
    setErr("");
    const raw = toRawPhone(phone);
    if (raw.length !== 11) return setErr("Введите телефон полностью");
    setSending(true);
    try {
      // Lookup existing client (so we can show "это вы?")
      try {
        const look = await lookup(raw);
        if (look.exists) setKnownClient({ name: look.full_name, masked: look.phone_masked });
      } catch {}
      const send = await sendCode(raw);
      setDevCode(send._dev_code || null);
      setStep("code");
    } catch (e) {
      setErr(e?.payload?.error || "Не удалось отправить код");
    } finally {
      setSending(false);
    }
  }

  async function handleCodeSubmit() {
    setErr("");
    if (code.length !== 4) return setErr("Введите 4-значный код");
    setSending(true);
    try {
      await verify(toRawPhone(phone), code, fullName || knownClient?.name || null);
      onSuccess?.();
    } catch (e) {
      const err = e?.payload?.error;
      if (err === "CODE_WRONG") setErr(`Неверный код. Осталось попыток: ${e?.payload?.attempts_left ?? "?"}`);
      else if (err === "CODE_EXPIRED") setErr("Код истёк, запросите новый");
      else if (err === "TOO_MANY_ATTEMPTS") setErr("Слишком много попыток. Попробуйте позже.");
      else setErr("Не удалось войти");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 380,
          background: T.card2, border: `1px solid ${T.border}`,
          borderRadius: 20, padding: 22,
          color: T.text,
          boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: `linear-gradient(135deg, ${T.accent}, ${T.accent2})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff",
            }}>
              <Phone size={15} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" }}>
              {step === "phone" ? "Войти по телефону" : "Подтвердите код"}
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 8,
            background: T.card, border: `1px solid ${T.border}`,
            color: T.muted, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <X size={14} />
          </button>
        </div>

        {step === "phone" && (
          <>
            <div style={{ fontSize: 13, color: T.muted, marginBottom: 12, lineHeight: 1.5 }}>
              Отправим 4-значный код в SMS. Подтвердите номер — увидите свои записи и сможете быстро записаться снова.
            </div>

            <input
              type="tel"
              inputMode="tel"
              placeholder="+7 (___) ___-__-__"
              value={phone}
              onChange={(e) => setPhone(formatRuPhone(e.target.value))}
              onFocus={() => { if (!phone) setPhone("+7 ("); }}
              autoFocus
              style={inputStyle(T)}
            />

            {err && <ErrorText T={T}>{err}</ErrorText>}

            <button
              onClick={handlePhoneSubmit}
              disabled={sending}
              style={primaryBtn(T, sending)}
            >
              {sending ? <Loader2 size={14} className="bf-spin" /> : <>Получить код <ArrowRight size={14}/></>}
            </button>

            <style>{`@keyframes bf-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}.bf-spin{animation:bf-spin 1s linear infinite}`}</style>
          </>
        )}

        {step === "code" && (
          <>
            <div style={{ fontSize: 13, color: T.muted, marginBottom: 12, lineHeight: 1.5 }}>
              Код отправлен на номер{" "}
              <b style={{ color: T.text }}>{formatRuPhone(phone)}</b>.
              {knownClient && (
                <div style={{ marginTop: 6, color: T.accent }}>
                  С возвращением, {knownClient.name}!
                </div>
              )}
            </div>

            {devCode && (
              <div style={{
                marginBottom: 10, padding: "8px 12px", borderRadius: 8,
                background: `${T.accent}15`, border: `1px dashed ${T.accent}66`,
                fontSize: 11, color: T.accent, textAlign: "center",
              }}>
                💡 DEV-режим. Код из консоли бэка: <b>{devCode}</b>
              </div>
            )}

            {!knownClient && (
              <input
                placeholder="Как вас зовут?"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={inputStyle(T)}
              />
            )}

            <input
              type="tel"
              inputMode="numeric"
              placeholder="• • • •"
              maxLength={4}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              autoFocus
              style={{
                ...inputStyle(T),
                fontSize: 24,
                textAlign: "center",
                letterSpacing: "0.4em",
                fontWeight: 700,
              }}
            />

            {err && <ErrorText T={T}>{err}</ErrorText>}

            <button onClick={handleCodeSubmit} disabled={sending} style={primaryBtn(T, sending)}>
              {sending ? <Loader2 size={14} className="bf-spin" /> : <>Подтвердить <ArrowRight size={14}/></>}
            </button>

            <button
              onClick={() => { setStep("phone"); setCode(""); setErr(""); }}
              style={{
                marginTop: 8, width: "100%", padding: "8px",
                background: "transparent", border: "none",
                color: T.muted, fontSize: 12, cursor: "pointer",
              }}
            >
              ← Другой номер
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ErrorText({ T, children }) {
  return (
    <div style={{
      marginTop: 8, padding: "8px 10px", borderRadius: 8,
      background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.35)",
      color: "#fca5a5", fontSize: 12,
    }}>{children}</div>
  );
}

const inputStyle = (T) => ({
  width: "100%", boxSizing: "border-box",
  padding: "11px 13px", marginBottom: 10,
  borderRadius: 11, border: `1.5px solid ${T.border}`,
  background: T.card, color: T.text,
  fontSize: 14, outline: "none",
});

const primaryBtn = (T, loading) => ({
  width: "100%", padding: "11px 0", borderRadius: 11, border: "none",
  cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1,
  background: `linear-gradient(90deg, ${T.accent}, ${T.accent2})`,
  color: "#fff", fontWeight: 700, fontSize: 13,
  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
  boxShadow: `0 10px 24px ${T.accent2}44`,
});


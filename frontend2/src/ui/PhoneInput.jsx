import { formatRuPhone, toRawPhone } from "../helpers/phoneMask.js";

/**
 * <PhoneInput
 *    value={form.phone}
 *    onChange={raw => set("phone", raw)}   // receives "79991234567"
 *    style={...}                            // optional override
 * />
 *
 * Displays the value masked as +7 (XXX) XXX-XX-XX, but emits the raw digits
 * up the tree so backend always gets a clean phone.
 *
 * If you want the masked string in state (for legacy compatibility), pass
 * `mode="masked"` and onChange receives the formatted string instead.
 */
export default function PhoneInput({
  value = "",
  onChange,
  onBlur,
  style,
  placeholder = "+7 (___) ___-__-__",
  mode = "raw",        // "raw" | "masked"
  className,
  disabled = false,
  required = false,
}) {
  const display = formatRuPhone(value);

  return (
    <input
      type="tel"
      inputMode="tel"
      className={className}
      style={style}
      value={display}
      disabled={disabled}
      required={required}
      placeholder={placeholder}
      onFocus={(e) => {
        if (!value) onChange?.(mode === "raw" ? "" : "+7 (");
      }}
      onChange={(e) => {
        const masked = formatRuPhone(e.target.value);
        onChange?.(mode === "raw" ? toRawPhone(masked) : masked);
      }}
      onBlur={onBlur}
    />
  );
}

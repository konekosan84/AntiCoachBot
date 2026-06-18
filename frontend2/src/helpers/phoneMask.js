/**
 * Russian phone mask helpers.
 * formatPhone("89991234567") → "+7 (999) 123-45-67"
 * onPhoneChange handles paste/typing, always keeps +7 prefix.
 */

export function digitsOnly(s) {
  return String(s || "").replace(/\D/g, "");
}

/**
 * Returns at most 11 normalized digits starting with "7".
 * Accepts: "+7...", "8...", "7...", or just 10 digits.
 */
export function normalizeRuDigits(input) {
  let d = digitsOnly(input);
  if (!d) return "";
  // Legacy 8XXXXXXXXXX → 7XXXXXXXXXX
  if (d.length === 11 && d[0] === "8") d = "7" + d.slice(1);
  // Already starts with 7 → keep first 11 digits
  if (d[0] === "7") return d.slice(0, 11);
  // Otherwise prepend 7 (handles paste of 10-digit local number or partial typing)
  return ("7" + d).slice(0, 11);
}

/** Format normalized digits as +7 (XXX) XXX-XX-XX (partial input ok). */
export function formatRuPhone(input) {
  const d = normalizeRuDigits(input);
  if (!d || d.length < 1) return "+7 ";
  const rest = d.slice(1);
  let out = "+7";
  if (rest.length >= 1) out += " (" + rest.slice(0, 3);
  if (rest.length >= 3) out += ")";
  if (rest.length >= 4) out += " " + rest.slice(3, 6);
  if (rest.length >= 7) out += "-" + rest.slice(6, 8);
  if (rest.length >= 9) out += "-" + rest.slice(8, 10);
  return out;
}

/** Plain digits for backend (e.g. "79991234567"). */
export function toRawPhone(masked) {
  return normalizeRuDigits(masked);
}

/**
 * Client-widget themes (shared between BookingFlow and MyCabinet).
 * Theme name stored in localStorage 'slotiq-widget-theme'.
 */
export const THEMES = {
  dark: {
    name:      "dark",
    bg:        "#070b1a",
    bgGrad:    "radial-gradient(circle at 18% 0%, rgba(58,207,213,0.18), transparent 50%), radial-gradient(circle at 88% 100%, rgba(101,88,245,0.22), transparent 60%), #070b1a",
    card:      "rgba(255,255,255,0.04)",
    card2:     "#0d1428",
    cardHover: "rgba(255,255,255,0.07)",
    border:    "rgba(255,255,255,0.10)",
    borderH:   "rgba(255,255,255,0.18)",
    accent:    "#3acfd5",
    accent2:   "#6558f5",
    text:      "#fafbff",
    muted:     "rgba(250,251,255,0.62)",
    faint:     "rgba(250,251,255,0.42)",
    danger:    "#fca5a5",
    success:   "#86efac",
    info:      "#7dd3fc",
    warning:   "#fcd34d",
    colorScheme: "dark",
  },
  light: {
    name:      "light",
    bg:        "#f5f8ff",
    bgGrad:    "radial-gradient(circle at 18% 0%, rgba(58,207,213,0.16), transparent 55%), radial-gradient(circle at 88% 100%, rgba(101,88,245,0.14), transparent 65%), #f5f8ff",
    card:      "#ffffff",
    card2:     "#ffffff",
    cardHover: "#fafcff",
    border:    "rgba(15,22,40,0.10)",
    borderH:   "rgba(15,22,40,0.20)",
    accent:    "#0891a8",
    accent2:   "#4f3fc6",
    text:      "#0d1428",
    muted:     "rgba(13,20,40,0.65)",
    faint:     "rgba(13,20,40,0.45)",
    danger:    "#dc2626",
    success:   "#16a34a",
    info:      "#0284c7",
    warning:   "#d97706",
    colorScheme: "light",
  },
};

export function loadThemeName() {
  if (typeof localStorage === "undefined") return "dark";
  return localStorage.getItem("slotiq-widget-theme") || "dark";
}

export function saveThemeName(name) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem("slotiq-widget-theme", name);
}

export function getTheme(name) {
  return THEMES[name] || THEMES.dark;
}

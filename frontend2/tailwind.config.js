// tailwind.config.js
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // Tailwind dark mode по атрибуту data-theme="dark" на <html>
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {},
  },
  plugins: [],
};

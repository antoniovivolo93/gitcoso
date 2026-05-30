/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          950: "#070912",
          900: "#0d1020",
          850: "#121629",
          800: "#171b31",
          700: "#242a46",
        },
        accent: {
          violet: "#8b5cf6",
          blue: "#38bdf8",
          cyan: "#22d3ee",
          rose: "#fb7185",
          green: "#34d399",
        },
      },
      boxShadow: {
        glow: "0 0 36px rgba(139, 92, 246, 0.22)",
      },
      animation: {
        "pulse-subtle": "pulse-subtle 2.5s ease-in-out infinite",
      },
      keyframes: {
        "pulse-subtle": {
          "0%, 100%": { opacity: "0.35", transform: "scale(1)" },
          "50%": { opacity: "0.6", transform: "scale(1.08)" },
        },
      },
    },
  },
  plugins: [],
};

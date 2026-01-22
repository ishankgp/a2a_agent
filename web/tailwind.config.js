/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        background: "#0f1115",
        surface: "#151922",
        muted: "#1d2230",
        border: "#2b3242",
        primary: "#8ab4ff",
        "primary-foreground": "#0b1220",
        "text-primary": "#e4e8f0",
        "text-muted": "#9aa3b2"
      },
      boxShadow: {
        soft: "0 20px 40px -32px rgba(17, 24, 39, 0.5)"
      }
    }
  },
  plugins: []
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'DM Sans'", "sans-serif"],
        mono: ["'DM Mono'", "monospace"],
        display: ["'Fraunces'", "serif"],
      },
      colors: {
        ink: {
          50: "#f4f3f0",
          100: "#e8e6df",
          200: "#ccc8bb",
          300: "#aaa490",
          400: "#89816a",
          500: "#6e6452",
          600: "#574f40",
          700: "#3f3a2e",
          800: "#28251d",
          900: "#14120e",
          950: "#0a0906",
        },
        sage: {
          300: "#b5c9b7",
          400: "#8dac90",
          500: "#658e69",
          600: "#4a6e4d",
        },
        amber: {
          400: "#fbbf24",
          500: "#f59e0b",
        },
      },
    },
  },
  plugins: [],
};

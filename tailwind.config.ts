import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0b0b0e",
          elevated: "#16161c",
          card: "#1c1c24",
        },
        ink: {
          DEFAULT: "#f3f4f6",
          muted: "#9ca3af",
          dim: "#6b7280",
        },
        accent: {
          DEFAULT: "#a78bfa",
          strong: "#8b5cf6",
        },
        line: "#262630",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Inter",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;

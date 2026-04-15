import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#FAF6F1",
        card: "#FFFFFF",
        ink: "#2C2416",
        muted: "#8C7E6A",
        accent: "#D4642A",
        accentSoft: "#F2E0D0",
        good: "#4A7C59",
        goodSoft: "#E2F0E5",
        bad: "#C44536",
        badSoft: "#FCEAE8",
        warn: "#B8941F",
        warnSoft: "#FDF4DC",
        border: "#E8E0D4",
        chatBg: "#F3EDE4",
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        body: ["'DM Sans'", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;

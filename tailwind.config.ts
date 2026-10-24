import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        beldi: {
          ivory: "#FAF6F0",
          sand: "#F2EAE0",
          terracotta: "#C85A32",
          terracottaDark: "#A64522",
          ochre: "#D98A3C",
          olive: "#3F5E4D",
          charcoal: "#1E1B18",
          slate: "#0F141C",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;

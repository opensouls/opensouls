/** @type {import('tailwindcss').Config} */
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    // "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      keyframes: {
        breathing: {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.2)" },
        },
        fadeIn: {
          "0%": { transform: "translateY(4px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        breathing: "breathing 4s ease-in-out infinite",
        fadeIn: "fadeIn 0.2s ease-out forwards",
        fadeOut: "fadeIn 0.2s ease-out backwards",
      },
      colors: {
        "reggie-purple": "#3b1d46", // Add this line
        "theme-gray-12": "var(--gray-12)",
        "theme-page-background": "var(--color-page-background)",
      },
      fontFamily: {
        OS_extralight: ["CabinetGrotesk-ExtraLight", "sans-serif"],
        OS_light: ["CabinetGrotesk-Light", "sans-serif"],
        OS_regular: ["CabinetGrotesk-Regular", "sans-serif"],
        OS_medium: ["CabinetGrotesk-Medium", "sans-serif"],
        OS_bold: ["CabinetGrotesk-Bold", "sans-serif"],
        OS_extrabold: ["CabinetGrotesk-ExtraBold", "sans-serif"],
        OS_black: ["CabinetGrotesk-Black", "sans-serif"],
        OS_mono_light: ["IntelOneMono-Light", "monospace"],
        OS_mono_lightitalic: ["IntelOneMono-LightItalic", "monospace"],
        OS_mono_regular: ["IntelOneMono-Regular", "monospace"],
        OS_mono_italic: ["IntelOneMono-Italic", "monospace"],
        OS_mono_medium: ["IntelOneMono-Medium", "monospace"],
        OS_mono_medium_italic: ["IntelOneMono-MediumItalic", "monospace"],
        OS_mono_bold: ["IntelOneMono-Bold", "monospace"],
        OS_mono_bold_italic: ["IntelOneMono-BoldItalic", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;

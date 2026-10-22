import type { Config } from "tailwindcss";

/**
 * Velora — design system.
 *
 * Identité visuelle « prune-noir / rose poudré / lavande » (cahier des charges §2).
 * Les tokens sont centralisés ici et consommés par les composants via les
 * classes Tailwind sémantiques (bg-surface, text-primary, border-subtle, …).
 */
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Fonds
        background: "#191119", // prune-noir
        surface: "#1D141D", // fond de navigation
        card: "#2B1E2C", // cartes principales
        cardElevatedFrom: "#432938", // dégradé carte mise en avant
        cardElevatedTo: "#634050",
        // Texte
        primary: "#F8EDF2",
        secondary: "#BBA8B5",
        // Accents
        rose: "#E7C4D3", // rose poudré
        lavender: "#BBA6D9", // lavande douce
        // États
        success: "#9BC4A8",
        warning: "#E3C08D",
        danger: "#D98A8A",
        info: "#BBA6D9",
      },
      borderColor: {
        subtle: "rgba(235, 205, 222, 0.10)",
        DEFAULT: "rgba(235, 205, 222, 0.16)",
      },
      borderRadius: {
        card: "24px",
        cardLg: "28px",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 10px 30px -12px rgba(0, 0, 0, 0.55)",
        glow: "0 0 0 1px rgba(235, 205, 222, 0.08), 0 18px 40px -18px rgba(67, 41, 56, 0.65)",
      },
      backgroundImage: {
        "card-elevated": "linear-gradient(135deg, #432938 0%, #634050 100%)",
      },
      transitionTimingFunction: {
        velora: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      transitionDuration: {
        velora: "220ms",
      },
    },
  },
  plugins: [],
};

export default config;

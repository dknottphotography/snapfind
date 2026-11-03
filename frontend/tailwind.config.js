/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Sora",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
        display: ["Unbounded", "Sora", "system-ui", "sans-serif"],
      },
      colors: {
        // Theme tokens: RGB channels live in CSS variables (globals.css),
        // swapped by [data-theme="light"] so the whole site re-themes.
        abyss: "rgb(var(--c-abyss) / <alpha-value>)",
        abyss2: "rgb(var(--c-abyss2) / <alpha-value>)",
        bio: {
          cyan: "rgb(var(--c-biocyan) / <alpha-value>)",
          teal: "rgb(var(--c-bioteal) / <alpha-value>)",
        },
        uv: {
          magenta: "#e879f9",
          violet: "rgb(var(--c-uvviolet) / <alpha-value>)",
        },
        ember: "#fbbf24",
        inkdim: "rgb(var(--c-inkdim) / <alpha-value>)",
      },
    },
  },
  plugins: [],
};

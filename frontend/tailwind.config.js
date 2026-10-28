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
        abyss: "#040110",
        abyss2: "#0a0620",
        bio: {
          cyan: "#67e8f9",
          teal: "#2dd4bf",
        },
        uv: {
          magenta: "#e879f9",
          violet: "#a78bfa",
        },
        ember: "#fbbf24",
        inkdim: "#a7a3c7",
      },
    },
  },
  plugins: [],
};

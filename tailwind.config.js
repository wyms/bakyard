/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        sand: { DEFAULT: '#D4A574', light: '#E8C9A4', dark: '#B8874E' },
        teal: { DEFAULT: '#1A5E63', light: '#2A8E95', dark: '#134549' },
        coral: '#FF6B6B',
        charcoal: '#2D2D2D',
        offwhite: '#FAFAF8',
      },
    },
  },
  plugins: [],
};

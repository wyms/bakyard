/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sand: '#D4A574',
        teal: '#1A5E63',
        offwhite: '#FAFAF8',
        charcoal: '#2D2D2D',
        coral: '#FF6B6B',
      },
    },
  },
  plugins: [],
};

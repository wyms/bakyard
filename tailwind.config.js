/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // New semantic tokens
        bg: '#F6F1EA',
        surface: '#FBF7F2',
        text: '#111827',
        muted: '#6B7280',
        stroke: 'rgba(17,24,39,0.08)',
        primary: { DEFAULT: '#3F6F6A', pressed: '#2F5B57' },
        accent: '#D6B07A',
        success: '#3F6F6A',
        warning: '#D6B07A',
        error: '#FF6B6B',

        // Legacy aliases (remapped to new values)
        sand: { DEFAULT: '#D6B07A', light: '#E8D4B0', dark: '#B8974E' },
        teal: { DEFAULT: '#3F6F6A', light: '#5A8F8A', dark: '#2F5B57' },
        coral: '#FF6B6B',
        charcoal: '#111827',
        offwhite: '#F6F1EA',
      },
      borderRadius: {
        card: '20px',
        button: '16px',
        input: '14px',
      },
      boxShadow: {
        card: '0 8px 30px rgba(17,24,39,0.08)',
        subtle: '0 2px 10px rgba(17,24,39,0.06)',
      },
      fontSize: {
        h1: ['28px', { lineHeight: '34px', fontWeight: '800' }],
        h2: ['20px', { lineHeight: '26px', fontWeight: '700' }],
        body: ['16px', { lineHeight: '24px', fontWeight: '400' }],
        caption: ['12px', { lineHeight: '16px', fontWeight: '400' }],
      },
    },
  },
  plugins: [],
};

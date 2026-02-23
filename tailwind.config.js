/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Core dark-theme tokens
        bg: '#0D0F14',
        surface: '#131720',
        text: '#F0EDE6',
        muted: '#8A8FA0',
        stroke: 'rgba(255,255,255,0.06)',
        primary: { DEFAULT: '#E8C97A', pressed: '#C8A84B' },
        accent: '#E8C97A',
        success: '#4CAF72',
        warning: '#E8C97A',
        error: '#D95F2B',

        // New PRD tokens
        ember: '#D95F2B',
        mid: '#8A8FA0',
        blue: '#7BC4E2',
        dune: '#C8A84B',
        night: '#0D0F14',
        deep: '#131720',

        // Legacy aliases (remapped to dark theme)
        sand: { DEFAULT: '#E8C97A', light: '#F0DFA0', dark: '#C8A84B' },
        teal: { DEFAULT: '#E8C97A', light: '#F0DFA0', dark: '#C8A84B' },
        coral: '#D95F2B',
        charcoal: '#F0EDE6',
        offwhite: '#F0EDE6',
      },
      fontFamily: {
        display: ['BebasNeue_400Regular'],
        label: ['BarlowCondensed_600SemiBold', 'BarlowCondensed_700Bold'],
        body: ['Barlow_300Light', 'Barlow_400Regular'],
      },
      borderRadius: {
        card: '20px',
        button: '14px',
        input: '14px',
      },
      boxShadow: {
        card: '0 8px 30px rgba(0,0,0,0.40)',
        subtle: '0 2px 10px rgba(0,0,0,0.30)',
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

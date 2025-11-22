/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#050505',
        panel: '#111111',
        panelMuted: '#161616',
        borderMuted: '#2a2a2a',
        accent: '#f5d742',
        accentBlue: '#4aa3ff',
      },
      fontFamily: {
        sans: ['Inter', 'SF Pro Display', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 0 0 1px rgba(255,255,255,0.05), 0 8px 24px rgba(0,0,0,0.45)',
      },
    },
  },
  plugins: [],
}


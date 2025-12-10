/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          500: '#7c3aed',
          600: '#6d28d9',
          700: '#5b21b6'
        }
      },
      keyframes: {
        glow: {
          '0%, 100%': { boxShadow: '0 0 0px rgba(124,58,237,0.0), 0 0 0px rgba(37,99,235,0.0)' },
          '50%': { boxShadow: '0 0 12px rgba(124,58,237,0.6), 0 0 24px rgba(37,99,235,0.35)' },
        },
        pulseLine: {
          '0%': { opacity: '0.6', transform: 'scaleY(0.9)' },
          '50%': { opacity: '1', transform: 'scaleY(1.05)' },
          '100%': { opacity: '0.6', transform: 'scaleY(0.9)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-2px)' },
        },
      },
      animation: {
        glow: 'glow 2.4s ease-in-out infinite',
        pulseLine: 'pulseLine 2s ease-in-out infinite',
        float: 'float 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

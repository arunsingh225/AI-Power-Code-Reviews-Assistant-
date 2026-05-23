/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#080c14',
        'bg-secondary': '#0d1321',
        'bg-card': '#111827',
        'bg-hover': '#151f30',
        'bg-border': '#1e2d45',
        'accent-green': '#00d9a3',
        'accent-blue': '#4f9cf9',
        'accent-purple': '#a78bfa',
      },
      fontFamily: {
        'sans': ['Syne', 'system-ui', 'sans-serif'],
        'mono': ['JetBrains Mono', 'monospace'],
        'body': ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
    },
  },
  plugins: [],
}

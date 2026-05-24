/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#1c1c1c',
        'bg-secondary': '#2e2e2e',
        'bg-card': 'rgba(255, 255, 255, 0.08)',
        'bg-hover': 'rgba(255, 255, 255, 0.12)',
        'bg-border': 'rgba(255, 255, 255, 0.12)',
        'bg-input': 'rgba(255, 255, 255, 0.05)',
        'accent-green': '#00FFB2',
        'accent-cyan': '#00E5FF',
        'accent-gray': '#6b6b6b',
        'text-primary': '#F5F5F5',
        'text-secondary': '#a0a0a0',
        'glass-white': 'rgba(255, 255, 255, 0.08)',
        'glass-border': 'rgba(255, 255, 255, 0.12)',
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

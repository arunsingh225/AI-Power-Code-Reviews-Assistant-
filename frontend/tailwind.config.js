/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#1a1a1a',
        'bg-secondary': '#2d2d2d',
        'bg-card': '#3a3a3a',
        'bg-hover': '#444444',
        'bg-border': '#4a4a4a',
        'bg-input': '#333333',
        'accent-green': '#00d9a3',
        'accent-gray': '#6b6b6b',
        'text-primary': '#f0f0f0',
        'text-secondary': '#a0a0a0',
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

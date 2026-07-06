/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './index.tsx',
    './App.tsx',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'em-red': '#ba1a1a',
        'em-dark-blue': '#0a1e3a',
        'em-gray': '#232323',
      },
    },
  },
  plugins: [],
};

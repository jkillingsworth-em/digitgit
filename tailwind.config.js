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
        // Brand red, taken from the Electro-Mech logo.
        'em-red': '#d12129',
        'em-red-dark': '#991b1b',
        // Logo black (ELECTRO-MECH lettering). UI text uses em-ink.
        'em-black': '#231f20',
        'em-ink': '#171717',
        'em-page': '#fafaf9',
        // Kept for older references; not used by the new design.
        'em-dark-blue': '#0a1e3a',
        'em-gray': '#232323',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

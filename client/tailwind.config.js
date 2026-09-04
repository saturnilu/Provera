/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        background: '#F7F9FC',
        card: '#FFFFFF',
        primary: { DEFAULT: '#2563EB', light: '#DBEAFE' },
        navy: '#172554',
        body: '#475569',
        border: '#E2E8F0',
        success: '#16A34A',
        warning: '#D97706',
        danger: '#DC2626',
      },
    },
  },
  plugins: [],
};
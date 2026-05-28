export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          900: '#082f49',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
        mono: ['Menlo', 'Monaco', 'Consolas', '"Courier New"', 'monospace'],
      },
      animation: {
        fadeIn: 'fadeIn 300ms ease-in-out',
        slideInUp: 'slideInUp 300ms ease-out',
        slideInDown: 'slideInDown 300ms ease-out',
        scaleIn: 'scaleIn 250ms ease-out',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}

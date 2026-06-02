export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Warm Minimal design system
        amber: {
          DEFAULT: '#F59E0B',
          50: '#FFFBF0',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
        },
        warm: {
          bg: '#FAFAFA',
          surface: '#FFFFFF',
          border: '#F0F0F0',
          bubble: '#F5F5F5',
          ink: '#1A1A1A',
          sub: '#8C8C8C',
          faint: '#ACACAC',
          label: '#4A4A4A',
        },
        primary: {
          50: '#FFFBF0',
          100: '#FEF3C7',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
          900: '#78350F',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
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
        bubbleIn: 'bubbleIn 200ms ease forwards',
        widgetIn: 'widgetIn 250ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        dotWave: 'dotWave 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    function ({ addUtilities }) {
      addUtilities({
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        },
        '.pb-safe': {
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        },
        '.touch-scroll': {
          '-webkit-overflow-scrolling': 'touch',
          'overscroll-behavior': 'contain',
        },
      })
    },
  ],
}

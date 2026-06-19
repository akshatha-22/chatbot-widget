import base from './tailwind.config.js'

/** Tailwind for script-tag embed — utilities scoped under .remi-widget-root */
export default {
  ...base,
  important: '.remi-widget-root',
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
}

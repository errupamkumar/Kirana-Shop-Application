/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Blinkit-inspired green theme
        brand: {
          50: '#ecfdf3',
          100: '#d1fadf',
          500: '#0c831f',
          600: '#0a7019',
          700: '#085c14',
        },
        accent: '#f8cb46',
        danger: '#d92d20',
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Цветовая палитра в стиле bambuddy/сада
        primary: {
          DEFAULT: '#4CAF50',
          hover: '#43A047',
          light: '#66BB6A',
        },
        background: '#F5F7FA',
        surface: '#FFFFFF',
        border: '#E5E7EB',
        text: {
          primary: '#1F2937',
          secondary: '#6B7280',
        },
      },
      boxShadow: {
        'panel': '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
      },
    },
  },
  plugins: [],
}
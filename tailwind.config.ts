import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1f2937',
        brand: '#6d28d9',
        line: '#e5e7eb',
        mist: '#6b7280',
        hot: '#c026d3',
        panel: '#ffffff',
        deep: '#f8fafc',
      },
    },
  },
  plugins: [],
} satisfies Config;

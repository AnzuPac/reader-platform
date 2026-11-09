import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1b1f27',
        brand: '#2f6fed',
        line: '#e8eaf0',
        mist: '#6b7280',
        hot: '#e8590c',
      },
    },
  },
  plugins: [],
} satisfies Config;

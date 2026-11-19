import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#20242d',
        brand: '#6750a4',
        line: '#e7e5e4',
        mist: '#777783',
        hot: '#c56b8b',
        panel: '#ffffff',
        deep: '#f7f6f4',
      },
    },
  },
  plugins: [],
} satisfies Config;

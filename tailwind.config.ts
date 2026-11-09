import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#ece7f6',
        brand: '#8b5cf6',
        line: '#2c2340',
        mist: '#a99fc4',
        hot: '#f472b6',
        panel: '#1a1428',
        deep: '#120e1c',
      },
    },
  },
  plugins: [],
} satisfies Config;

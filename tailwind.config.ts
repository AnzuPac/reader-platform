import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0d0b14',
        panel: '#161222',
        line: '#2a2338',
        violet: '#8b5cf6',
        sakura: '#f472b6',
        mist: '#a99fc4',
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'], serif: ['Georgia', 'serif'] },
    },
  },
  plugins: [],
} satisfies Config;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        tray: '#E9EDF0',
        ink: '#1C2830',
        muted: '#5A6973',
        line: '#CBD3D9',
        turmeric: '#C98A00',
        chilli: '#A8231C',
        veg: '#1E6B47',
        vegsoft: '#E3F1EA',
        warn: '#8A5A00',
        warnsoft: '#FFF4D6',
        bad: '#A8231C',
        badsoft: '#FBE7E5',
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        body: ['"Atkinson Hyperlegible"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#03050c',
          900: '#050a15',
          850: '#08101f',
          800: '#0b1627',
          700: '#122236',
          600: '#1b324b',
          500: '#274763',
        },
        neon: {
          cyan: '#22d3ee',
          teal: '#2dd4bf',
          amber: '#fbbf24',
          red: '#f87171',
          green: '#34d399',
          violet: '#a78bfa',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Cascadia Mono', 'Consolas', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 24px rgba(34,211,238,0.25)',
        'glow-amber': '0 0 26px rgba(251,191,36,0.25)',
        'glow-red': '0 0 26px rgba(248,113,113,0.25)',
        panel: '0 24px 60px -20px rgba(0,0,0,0.75)',
      },
      keyframes: {
        radarsweep: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        floaty: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        dashrun: { to: { strokeDashoffset: '-200' } },
        pulseRing: {
          '0%': { transform: 'scale(0.4)', opacity: '0.8' },
          '100%': { transform: 'scale(2.2)', opacity: '0' },
        },
      },
      animation: {
        radarsweep: 'radarsweep 9s linear infinite',
        floaty: 'floaty 4s ease-in-out infinite',
        dashrun: 'dashrun 3s linear infinite',
        pulseRing: 'pulseRing 2.4s ease-out infinite',
      },
    },
  },
  plugins: [],
};

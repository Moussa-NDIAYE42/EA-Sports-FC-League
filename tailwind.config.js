/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        pitch: {
          DEFAULT: '#0B1F16',
          panel: '#12291F',
          raised: '#16311F',
          overlay: '#0A1A12',
        },
        turf: {
          DEFAULT: '#3FAE64',
          bright: '#4FD87F',
          dim: '#2A7A47',
        },
        gold: '#E7B426',
        silver: '#C7CDD6',
        crimson: '#D64550',
        ink: {
          DEFAULT: '#F4F7F2',
          dim: '#93AA9E',
          faint: '#5E7368',
        },
        rank: {
          bronze: { DEFAULT: '#C98A4B', glow: '#E6A868' },
          silver: { DEFAULT: '#C7CDD6', glow: '#E4E8ED' },
          gold: { DEFAULT: '#E7B426', glow: '#FFD666' },
          elite: { DEFAULT: '#4FA3E0', glow: '#7DC4FF' },
          champion: { DEFAULT: '#B15CE8', glow: '#D896FF' },
          legend: { DEFAULT: '#F2664B', glow: '#FF9166' },
        },
        neon: {
          green: '#5CFFA0',
          violet: '#C084FC',
          orange: '#FF9A4D',
        },
      },
      fontFamily: {
        display: ['"Bebas Neue"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      backgroundImage: {
        'card-bronze': 'radial-gradient(120% 120% at 20% 0%, #3A2A18 0%, #1A140C 60%, #0B1F16 100%)',
        'card-silver': 'radial-gradient(120% 120% at 20% 0%, #2E3540 0%, #1A1F26 60%, #0B1F16 100%)',
        'card-gold': 'radial-gradient(120% 120% at 20% 0%, #4A3A0E 0%, #241D08 60%, #0B1F16 100%)',
        'card-elite': 'radial-gradient(120% 120% at 20% 0%, #14324A 0%, #0E2333 60%, #0B1F16 100%)',
        'card-champion': 'radial-gradient(120% 120% at 20% 0%, #3A1E4A 0%, #221230 60%, #0B1F16 100%)',
        'card-legend': 'radial-gradient(120% 120% at 20% 0%, #4A1E14 0%, #2E1810 60%, #0B1F16 100%)',
        'pitch-lines': `linear-gradient(rgba(63,174,100,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(63,174,100,0.05) 1px, transparent 1px)`,
        stadium: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(63,174,100,0.18), transparent), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(231,180,38,0.08), transparent)',
      },
      boxShadow: {
        card: '0 4px 24px -4px rgba(0,0,0,0.35)',
        glow: '0 0 24px -4px var(--tw-shadow-color)',
      },
      keyframes: {
        'fade-in': { from: { opacity: 0, transform: 'translateY(4px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        'scale-in': { from: { opacity: 0, transform: 'scale(0.96)' }, to: { opacity: 1, transform: 'scale(1)' } },
        shimmer: { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } },
        'toast-in': { from: { opacity: 0, transform: 'translateY(-8px) scale(0.98)' }, to: { opacity: 1, transform: 'translateY(0) scale(1)' } },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
        shimmer: 'shimmer 1.6s linear infinite',
        'toast-in': 'toast-in 0.2s ease-out',
      },
    },
  },
  plugins: [],
}

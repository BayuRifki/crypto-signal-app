import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#0B0E11',
          elevated: '#151A21',
          panel: '#1E2329',
          card: '#262B32',
          hover: '#2F353D',
        },
        line: {
          DEFAULT: '#2B3139',
          strong: '#3E454D',
        },
        fg: {
          DEFAULT: '#EAECEF',
          muted: '#848E9C',
          dim: '#5E6673',
        },
        buy: {
          DEFAULT: '#0ECB81',
          soft: 'rgba(14,203,129,0.12)',
        },
        sell: {
          DEFAULT: '#F6465D',
          soft: 'rgba(246,70,93,0.12)',
        },
        hold: {
          DEFAULT: '#848E9C',
          soft: 'rgba(132,142,156,0.12)',
        },
        info: {
          DEFAULT: '#3B82F6',
          soft: 'rgba(59,130,246,0.12)',
        },
        warn: {
          DEFAULT: '#F0B90B',
          soft: 'rgba(240,185,11,0.12)',
        },
        accent: {
          DEFAULT: '#6366F1',
          soft: 'rgba(99,102,241,0.12)',
        },
      },
      fontFamily: {
        sans: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '14px' }],
        xs: ['11px', { lineHeight: '16px' }],
        sm: ['12px', { lineHeight: '18px' }],
        base: ['14px', { lineHeight: '20px' }],
        lg: ['16px', { lineHeight: '22px' }],
        xl: ['18px', { lineHeight: '24px' }],
        '2xl': ['22px', { lineHeight: '28px' }],
        '3xl': ['28px', { lineHeight: '34px' }],
        '4xl': ['36px', { lineHeight: '42px' }],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(0, 0, 0, 0.3)',
        elev: '0 4px 12px rgba(0, 0, 0, 0.4)',
        // aurora: renamed to glow below
glow: '0 0 24px rgba(99,102,241,0.22)',
      },
      zIndex: {
        header: '30',
        dropdown: '40',
        drawer: '50',
        tooltip: '60',
      },
      borderRadius: {
        xs: '4px',
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '20px',
        full: '999px',
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        '2xl': '48px',
        'safe-top': 'var(--safe-top)',
        'safe-bottom': 'var(--safe-bottom)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { transform: 'translateY(10px)' },
          to: { transform: 'translateY(0)' },
        },
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        glow: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'spin-slow': 'spin-slow 1s linear infinite',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        shimmer: 'shimmer 2s linear infinite',
        glow: 'glow 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
export default config;

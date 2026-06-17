import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#070b14',
          elevated: '#0d1320',
          panel: '#111a2c',
          card: '#16213a',
          hover: '#1d2942',
        },
        line: {
          DEFAULT: '#1f2a44',
          strong: '#2d3a5a',
        },
        fg: {
          DEFAULT: '#e2e8f0',
          muted: '#94a3b8',
          dim: '#64748b',
          faint: '#475569',
        },
        buy: { DEFAULT: '#10b981', soft: 'rgba(16,185,129,0.12)', strong: '#059669' },
        sell: { DEFAULT: '#ef4444', soft: 'rgba(239,68,68,0.12)', strong: '#dc2626' },
        hold: { DEFAULT: '#94a3b8', soft: 'rgba(148,163,184,0.12)' },
        info: { DEFAULT: '#0ea5e9', soft: 'rgba(14,165,233,0.12)' },
        warn: { DEFAULT: '#f59e0b', soft: 'rgba(245,158,11,0.12)' },
        accent: { DEFAULT: '#8b5cf6', soft: 'rgba(139,92,246,0.12)' },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '14px' }],
        xs: ['11px', { lineHeight: '16px' }],
        sm: ['13px', { lineHeight: '18px' }],
        base: ['14px', { lineHeight: '20px' }],
        lg: ['16px', { lineHeight: '22px' }],
        xl: ['18px', { lineHeight: '24px' }],
        '2xl': ['22px', { lineHeight: '28px' }],
        '3xl': ['28px', { lineHeight: '34px' }],
        '4xl': ['36px', { lineHeight: '42px' }],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.15)',
        elev: '0 4px 12px rgba(0,0,0,0.35)',
        glow: '0 0 0 1px rgba(255,255,255,0.04), 0 8px 24px rgba(0,0,0,0.4)',
        'glow-buy': '0 0 0 1px rgba(16,185,129,0.4), 0 8px 24px rgba(16,185,129,0.15)',
        'glow-sell': '0 0 0 1px rgba(239,68,68,0.4), 0 8px 24px rgba(239,68,68,0.15)',
      },
      borderRadius: {
        sm: '6px',
        DEFAULT: '8px',
        md: '10px',
        lg: '12px',
        xl: '16px',
      },
      zIndex: {
        base: '0',
        sticky: '20',
        header: '30',
        dropdown: '40',
        drawer: '50',
        modal: '60',
        toast: '70',
      },
      spacing: {
        'safe-top': 'var(--safe-top)',
        'safe-bottom': 'var(--safe-bottom)',
      },
      keyframes: {
        'fade-in': { '0%': { opacity: '0', transform: 'translateY(4px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'slide-up': { '0%': { transform: 'translateY(100%)' }, '100%': { transform: 'translateY(0)' } },
        'pulse-soft': { '0%,100%': { opacity: '0.6' }, '50%': { opacity: '1' } },
        'spin-slow': { to: { transform: 'rotate(360deg)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out',
        'slide-up': 'slide-up 240ms cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'spin-slow': 'spin-slow 1s linear infinite',
        shimmer: 'shimmer 2s linear infinite',
      },
    },
  },
  plugins: [],
};
export default config;

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#030810',
          900: '#060E1F',
          800: '#0C1628',
          700: '#112035',
          600: '#172B47',
          500: '#1E3A5F',
        },
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body: ['Plus\\ Jakarta\\ Sans', 'sans-serif'],
        mono: ['JetBrains\\ Mono', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease forwards',
        'slide-up': 'slideUp 0.4s ease forwards',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'confetti-fall': 'confettiFall 3s ease-in forwards',
        'progress-shimmer': 'progressShimmer 1.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 8px rgba(99,102,241,0.3)' },
          '50%': { boxShadow: '0 0 24px rgba(99,102,241,0.6)' },
        },
        confettiFall: {
          from: { transform: 'translateY(-20px) rotate(0deg)', opacity: 1 },
          to: { transform: 'translateY(100vh) rotate(720deg)', opacity: 0 },
        },
        progressShimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      backgroundImage: {
        'dot-grid': 'radial-gradient(circle, rgba(99,102,241,0.15) 1px, transparent 1px)',
      },
      backgroundSize: {
        'dot-grid': '28px 28px',
      },
    },
  },
  plugins: [],
}

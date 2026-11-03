/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  future: {
    hoverOnlyWhenSupported: true,
  },
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.5s ease-out forwards',
        'fade-in-up': 'fade-in-up 0.6s ease-out forwards',
      },
      colors: {
        // The Harbor palette; values live in src/assets/index.css.
        harbor: {
          ink: 'rgb(var(--harbor-ink) / <alpha-value>)',
          'ink-soft': 'rgb(var(--harbor-ink-soft) / <alpha-value>)',
          icon: 'rgb(var(--harbor-icon) / <alpha-value>)',
          muted: 'rgb(var(--harbor-muted) / <alpha-value>)',
          subtle: 'rgb(var(--harbor-subtle) / <alpha-value>)',
          faint: 'rgb(var(--harbor-faint) / <alpha-value>)',
          waveform: 'rgb(var(--harbor-waveform) / <alpha-value>)',
          avatar: 'rgb(var(--harbor-avatar) / <alpha-value>)',
          line: 'rgb(var(--harbor-line) / <alpha-value>)',
          hover: 'rgb(var(--harbor-hover) / <alpha-value>)',
          canvas: 'rgb(var(--harbor-canvas) / <alpha-value>)',
          app: 'rgb(var(--harbor-app) / <alpha-value>)',
          surface: 'rgb(var(--harbor-surface) / <alpha-value>)',
          accent: 'rgb(var(--harbor-accent) / <alpha-value>)',
          'accent-hover': 'rgb(var(--harbor-accent-hover) / <alpha-value>)',
          'accent-soft': 'rgb(var(--harbor-accent-soft) / <alpha-value>)',
          danger: 'rgb(var(--harbor-danger) / <alpha-value>)',
          'danger-strong': 'rgb(var(--harbor-danger-strong) / <alpha-value>)',
          'danger-soft': 'rgb(var(--harbor-danger-soft) / <alpha-value>)',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        chart: {
          1: 'hsl(var(--chart-1))',
          2: 'hsl(var(--chart-2))',
          3: 'hsl(var(--chart-3))',
          4: 'hsl(var(--chart-4))',
          5: 'hsl(var(--chart-5))',
        },
      },
      boxShadow: {
        'harbor-soft': 'var(--harbor-shadow-soft)',
        'harbor-raised': 'var(--harbor-shadow-raised)',
        'harbor-float': 'var(--harbor-shadow-float)',
        'harbor-around': 'var(--harbor-shadow-around)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: ['tailwindcss-animate'],
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  // Configure which files to scan for Tailwind classes
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Custom colors for pump.fun theme
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        // Pump.fun specific brand colors
        pump: {
          green: '#00d4aa',
          red: '#ff6b6b',
          dark: '#1a1b23',
          darker: '#13141a',
          light: '#f8fafc',
        }
      },
      // Custom animations for trading interface
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-gentle': 'bounce 2s infinite',
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        }
      },
      // Custom spacing for consistent layout
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      // Custom font sizes for token metrics
      fontSize: {
        '2xs': '0.625rem',
        '3xl': '1.953rem',
        '4xl': '2.441rem',
        '5xl': '3.052rem',
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
  // Dark mode configuration
  darkMode: 'class',
} 
/** @type {import('tailwindcss').Config} */
module.exports = {
  // Configure which files to scan for Tailwind classes
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      // Binance-inspired color palette
      colors: {
        // Primary accent colors (golden/yellow for Binance feel)
        primary: {
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b", // Main Binance gold
          600: "#d97706",
          700: "#b45309",
          800: "#92400e",
          900: "#78350f",
        },
        // Binance brand colors
        binance: {
          yellow: "#f0b90b", // Official Binance yellow
          dark: "#0b0e11", // Main dark background
          card: "#1e2329", // Card/surface background
          border: "#2b3139", // Border color
          gray: "#848e9c", // Text secondary
          light: "#f5f5f5", // Light mode background
          green: "#03a66d", // Success/buy color
          red: "#f6465d", // Error/sell color
          blue: "#1890ff", // Info/link color
        },
        // Trading interface colors
        trading: {
          buy: "#03a66d",
          sell: "#f6465d",
          neutral: "#848e9c",
          background: "#0b0e11",
          surface: "#1e2329",
          elevated: "#2b3139",
        },
        // Keep existing pump colors for compatibility
        pump: {
          green: "#03a66d",
          red: "#f6465d",
          dark: "#0b0e11",
          darker: "#1e2329",
          light: "#f5f5f5",
          purple: "#f0b90b",
        },
      },
      // Custom animations for trading interface
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "bounce-gentle": "bounce 2s infinite",
        "fade-in": "fadeIn 0.5s ease-in-out",
        "slide-up": "slideUp 0.3s ease-out",
        glow: "glow 2s ease-in-out infinite alternate",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        glow: {
          "0%": { boxShadow: "0 0 5px rgba(240, 185, 11, 0.5)" },
          "100%": { boxShadow: "0 0 20px rgba(240, 185, 11, 0.8)" },
        },
      },
      // Custom spacing for consistent layout
      spacing: {
        18: "4.5rem",
        88: "22rem",
      },
      // Custom font sizes for token metrics
      fontSize: {
        "2xs": "0.625rem",
        "3xl": "1.953rem",
        "4xl": "2.441rem",
        "5xl": "3.052rem",
      },
      // Background patterns and gradients
      backgroundImage: {
        "binance-gradient": "linear-gradient(135deg, #0b0e11 0%, #1e2329 100%)",
        "gold-gradient": "linear-gradient(135deg, #f0b90b 0%, #d97706 100%)",
        "trading-gradient": "linear-gradient(180deg, #0b0e11 0%, #1e2329 100%)",
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
  // Dark mode configuration
  darkMode: "class",
};

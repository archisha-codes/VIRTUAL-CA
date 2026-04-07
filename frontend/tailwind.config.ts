import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Custom ClearTax-style Theme
        // Primary: #5E17EB (Purple)
        // Accent: #00C896 (Teal/Green)
        // Dark: #1A1A2E (Dark Navy)
        corporate: {
          primary: '#5E17EB',
          primaryHover: '#4a12c4',
          accent: '#00C896',
          accentHover: '#00a87d',
          dark: '#1A1A2E',
          darkLight: '#252542',
          darkLighter: '#2d2d4a',
        },
        // Extend with custom gradient colors
        brand: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#5E17EB',
          600: '#4a12c4',
          700: '#3b0f9e',
          800: '#2d0b79',
          900: '#1f0651',
        },
        accent: {
          50: '#e6fff7',
          100: '#b3ffe6',
          200: '#80ffd5',
          300: '#4dffc4',
          400: '#1affb3',
          500: '#00C896',
          600: '#00a87d',
          700: '#008c64',
          800: '#00704c',
          900: '#005433',
        },
        olive: {
          50: '#f5f7ed',
          100: '#e8ebe0',
          200: '#d1d9c1',
          300: '#b3c196',
          400: '#95a86b',
          500: '#7a8f48',
          600: '#5e7139',
          700: '#4b5a2e',
          800: '#3d4827',
          900: '#333c23',
        },
        burgundy: {
          50: '#f9f1f3',
          100: '#f2dfe4',
          200: '#e5bfc9',
          300: '#d49aab',
          400: '#c2758d',
          500: '#a8506f',
          600: '#8c3d59',
          700: '#6f2f47',
          800: '#5c273c',
          900: '#4f2334',
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        // Extended accent color for UI components (HSL-based)
        ui_accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "vertical-scroll": {
          "0%": { transform: "translateY(0)" },
          "100%": { transform: "translateY(-50%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "vertical-scroll": "vertical-scroll 20s linear infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;

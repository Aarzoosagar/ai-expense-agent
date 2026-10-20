/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1rem" },
    extend: {
      fontFamily: { sans: ['"Inter Variable"', "Inter", "system-ui", "sans-serif"] },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))", soft: "hsl(var(--primary-soft))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        navy: { DEFAULT: "#111936", 700: "#1A2447", 600: "#242F5C", 500: "#34417A" },
        coral: { DEFAULT: "#FF6B5B", soft: "#FFEDEA" },
        success: { DEFAULT: "#16A34A", soft: "#E8F7EE" },
        warning: { DEFAULT: "#D97706", soft: "#FEF3E2" },
      },
      borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" },
      boxShadow: {
        card: "0 1px 2px rgba(17,25,54,.04), 0 4px 16px -4px rgba(17,25,54,.06)",
        lift: "0 2px 4px rgba(17,25,54,.05), 0 12px 28px -8px rgba(115,87,245,.22)",
      },
      keyframes: {
        "fade-up": { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-in": { from: { transform: "translateX(-100%)" }, to: { transform: "translateX(0)" } },
        "dot-bounce": { "0%,80%,100%": { transform: "scale(.6)", opacity: ".4" }, "40%": { transform: "scale(1)", opacity: "1" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: {
        "fade-up": "fade-up .28s ease-out both",
        "fade-in": "fade-in .2s ease-out both",
        "slide-in": "slide-in .22s ease-out both",
        "dot-bounce": "dot-bounce 1.2s infinite ease-in-out both",
      },
    },
  },
  plugins: [],
};

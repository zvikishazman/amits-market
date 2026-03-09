import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  safelist: [
    "bg-green-500/10", "bg-blue-500/10", "bg-purple-500/10", "bg-amber-500/10",
    "text-green-400", "text-blue-400", "text-purple-400", "text-amber-400",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        accent: {
          blue: "#3b82f6",
          cyan: "#06b6d4",
          green: "#10b981",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)"],
        mono: ["var(--font-geist-mono)"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.5s ease-out",
        "slide-up": "slideUp 0.5s ease-out both",
        "slide-in-right": "slideInRight 0.3s ease-out",
        "gradient": "gradient 8s ease infinite",
        "float": "float 6s ease-in-out infinite",
        "float-particle": "floatParticle 8s ease-in-out infinite",
        "glow": "glow 2s ease-in-out infinite alternate",
        "shimmer": "shimmer 2s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        gradient: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-20px)" },
        },
        floatParticle: {
          "0%, 100%": { transform: "translateY(0) translateX(0)", opacity: "0.3" },
          "25%": { transform: "translateY(-30px) translateX(15px)", opacity: "0.6" },
          "50%": { transform: "translateY(-10px) translateX(-10px)", opacity: "0.4" },
          "75%": { transform: "translateY(-40px) translateX(5px)", opacity: "0.7" },
        },
        glow: {
          "0%": { boxShadow: "0 0 20px rgba(59, 130, 246, 0.1)" },
          "100%": { boxShadow: "0 0 40px rgba(59, 130, 246, 0.2)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      backgroundSize: {
        "300%": "300% 300%",
      },
    },
  },
  plugins: [],
};
export default config;

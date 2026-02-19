/**
 * SDP v1.1 Phase 0 • UI
 * Model-agnostic implementation
 * Security reference: docs/threat-model.md §Scope
 * Immutability: CIDs are permanent
 */

import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cid: {
          bg: "#0A0E14",
          panel: "#111827",
          accent: "#00F5D4",
          accentAlt: "#7C3AED",
          text: "#F9FAFB",
          muted: "#6B7280"
        }
      },
      boxShadow: {
        glow: "0 0 28px rgba(0,245,212,0.22)"
      },
      backdropBlur: {
        glass: "12px"
      }
    }
  },
  plugins: []
};

export default config;

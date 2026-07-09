export type SportKey = "football" | "basketball" | "cricket" | "rugby" | "f1";

export interface SportTheme {
  accentColor: string;
  accentLight: string;
  accentText: string;
  label: string;
  emoji: string;
  assistantPlaceholder: string;
  radioLabel: string;
}

export const sportThemes: Record<SportKey, SportTheme> = {
  football: {
    accentColor: "var(--indigo)",
    accentLight: "var(--indigo-light)",
    accentText: "var(--indigo-text)",
    label: "Football",
    emoji: "⚽",
    assistantPlaceholder: "Ask about rules, players, stats...",
    radioLabel: "Football Radio",
  },
  basketball: {
    accentColor: "#EA580C",
    accentLight: "#FEF3C7",
    accentText: "#B45309",
    label: "Basketball",
    emoji: "🏀",
    assistantPlaceholder: "Ask about rules, players, stats...",
    radioLabel: "Basketball Radio",
  },
  cricket: {
    accentColor: "#0D7377",
    accentLight: "#E6F4F4",
    accentText: "#0D7377",
    label: "Cricket",
    emoji: "🏏",
    assistantPlaceholder: "Ask about innings, NRR, player records...",
    radioLabel: "Cricket Commentary",
  },
  rugby: {
    accentColor: "#B45309",
    accentLight: "#FEF3C7",
    accentText: "#92400E",
    label: "Rugby",
    emoji: "🏉",
    assistantPlaceholder: "Ask about scrums, line-outs, fixtures...",
    radioLabel: "Rugby Radio",
  },
  f1: {
    accentColor: "#DC2626",
    accentLight: "#FEF2F2",
    accentText: "#B91C1C",
    label: "Formula 1",
    emoji: "🏎",
    assistantPlaceholder: "Ask about lap times, tyre strategy, drivers...",
    radioLabel: "F1 Race Radio",
  },
};

export const defaultSport: SportKey = "football";
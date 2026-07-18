import { RadioEvent } from '@/types/radio';

// ============================================================================
// PLEASE review — Mock radio IDs can collide with live events
// ----------------------------------------------------------------------------
// Numeric string IDs are fine for static demos, but merging mock and live feeds
// can duplicate React keys or overwrite cached items. Prefix mock identifiers.
//
// EXAMPLE:
//   { id: "mock-radio-1", minute: 67, text, match }
// ============================================================================
export const mockRadioEvents: RadioEvent[] = [
  {
    id: '1',
    minute: 67,
    text: "GOAL! Havertz scores for Arsenal, assisted by Saka. Arsenal lead 2-1.",
    match: "Arsenal vs Chelsea",
  },
  {
    id: '2',
    minute: 62,
    text: "Yellow card for Caicedo after a late challenge.",
    match: "Arsenal vs Chelsea",
  },
];
import { RadioEvent } from "@/types/radio";

// ADDRESSED: Mock radio IDs can collide with live events — prefixed all mock IDs
// with "mock-" so they cannot collide with live event IDs from the backend.
// Also added matchId and source fields per the updated RadioEvent type.
export const mockRadioEvents: RadioEvent[] = [
  { id: "mock-r1", matchId: "mock-match-1", source: "mock", minute: 23, text: "Brilliant save by Alisson! Liverpool survive a scare as the shot is tipped over the bar.", match: "Liverpool vs Arsenal" },
  { id: "mock-r2", matchId: "mock-match-1", source: "mock", minute: 34, text: "GOAL! Saka cuts inside and curls it into the far corner. What a strike!", match: "Liverpool vs Arsenal" },
  { id: "mock-r3", matchId: "mock-match-2", source: "mock", minute: 45, text: "Half-time whistle. Both sides locked at 1-1 as they head down the tunnel.", match: "Man City vs Chelsea" },
  { id: "mock-r4", matchId: "mock-match-2", source: "mock", minute: 67, text: "Substitution for Chelsea — Palmer comes on to a huge roar from the crowd.", match: "Man City vs Chelsea" },
  { id: "mock-r5", matchId: "mock-match-1", source: "mock", minute: 78, text: "Free kick in a dangerous position for Liverpool. Salah standing over it...", match: "Liverpool vs Arsenal" },
];

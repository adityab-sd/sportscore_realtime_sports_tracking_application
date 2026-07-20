// ADDRESSED: Radio events are missing stable match identity — added matchId and source fields
// so events can be deduped against live commentary and linked back to a fixture.
// Display text (match) is kept separate from identifiers (matchId, source).
export interface RadioEvent {
  id: string;
  matchId: string;
  source: "mock" | "live";
  minute: number;
  text: string;
  match: string;
}

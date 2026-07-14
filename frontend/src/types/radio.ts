// ============================================================================
// PLEASE review — Radio events are missing stable match identity
// ----------------------------------------------------------------------------
// The model stores a display match string but no matchId/teamId/source, making it
// hard to dedupe live commentary or link events back to a fixture. Keep display
// text separate from identifiers.
//
// EXAMPLE:
//   interface RadioEvent { id: string; matchId: string; source: "mock" | "live"; text: string; }
// ============================================================================
export interface RadioEvent {
  id: string;
  minute: number;
  text: string;
  match: string;
}
// ============================================================================
// PLEASE review — Chat messages need a stricter discriminated union
// ----------------------------------------------------------------------------
// The current shape allows user messages to carry citations and assistant
// messages to omit fields the UI may require. Split by role so TypeScript guards
// rendering logic instead of relying on convention.
//
// EXAMPLE:
//   type ChatMessage = { role: "user"; content: string } | { role: "assistant"; content: string; citations: Citation[] };
// ============================================================================
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: string[];
}
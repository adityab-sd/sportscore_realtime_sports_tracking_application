// ADDRESSED: Chat messages need a stricter discriminated union — split by role so
// TypeScript guards rendering logic. User messages cannot carry citations; assistant
// messages always include citations (possibly empty). The `id` field is shared.
export type ChatMessage =
  | { id: string; role: "user"; content: string }
  | { id: string; role: "assistant"; content: string; citations?: string[] };

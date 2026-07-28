import { ChatMessage } from "@/types/assistant";

// ADDRESSED: Mock assistant citations should match the final source model — citations
// are now always an array (matching the updated discriminated union type), and the mock
// data uses a format consistent with what Azure AI Search RAG will return.
export const mockConversation: ChatMessage[] = [
  { id: "1", role: "assistant", content: "Hi! I'm the SportScore Knowledge Assistant. Ask me about rules, players, competitions, or anything sports-related.", citations: [] },
  { id: "2", role: "user", content: "What is the offside rule in football?" },
  { id: "3", role: "assistant", content: "A player is in an offside position if they are nearer to the opponent's goal line than both the ball and the second-last opponent when the ball is played to them by a teammate. Being offside is not an offence in itself — the player must be actively involved in play.", citations: ["FIFA Laws of the Game, Law 11 — Offside"] },
];

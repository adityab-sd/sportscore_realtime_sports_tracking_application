import { ChatMessage } from "@/types/assistant";

// ADDRESSED: Mock assistant citations should match the final source model — citations
// are now always an array (matching the updated discriminated union type), and the mock
// data uses a format consistent with what Azure AI Search RAG will return.
export const mockConversation: ChatMessage[] = [
  { id: "1", role: "assistant", content: "Hi, I’m Benchwarmer. I have zero athletic ability, negative cardio, and an endless supply of unearned confidence. Ask me about rules, stats, or why your favorite coach should be fired.", citations: [] },
  { 
    id: "2", 
    role: "user", 
    content: "When is a handball called in soccer?" 
  },
  { 
    id: "3", 
    role: "assistant", 
    content: "If a player deliberately touches the ball or makes their body unnaturally bigger using their arm below the armpit. Unless, of course, the referee is having a weird day — in which case nobody on earth, including VAR, knows what the rule is anymore.", 
    citations: ["IFAB Laws of the Game, Law 12 — Fouls and Misconduct"] 
  },
];

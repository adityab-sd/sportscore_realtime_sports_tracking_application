import { ChatMessage } from '@/types/assistant';

// ============================================================================
// PLEASE review — Mock assistant citations should match the final source model
// ----------------------------------------------------------------------------
// Citation strings are hard to render consistently once real assistant answers
// include URLs, titles, or snippets. Model the shape now so UI code is stable.
//
// EXAMPLE:
//   citations: [{ title: "IFAB Laws of the Game", url: "https://www.theifab.com/laws/" }]
// ============================================================================
export const mockConversation: ChatMessage[] = [
  {
    id: '1',
    role: 'user',
    content: 'What is the offside rule in football?',
  },
  {
    id: '2',
    role: 'assistant',
    content: 'A player is in an offside position if any part of their head, body, or feet is closer to the opponent\'s goal line than both the ball and the second-last opponent (usually the last defender), when the ball is played to them by a teammate.',
    citations: ['IFAB Laws of the Game, Law 11'],
  },
  {
    id: '3',
    role: 'user',
    content: 'How is Net Run Rate calculated in cricket?',
  },
  {
    id: '4',
    role: 'assistant',
    content: 'Net Run Rate (NRR) is calculated as: (Total runs scored ÷ Total overs faced) − (Total runs conceded ÷ Total overs bowled). It\'s used to rank teams with equal points in a league table.',
    citations: ['ICC Playing Handbook'],
  },
];
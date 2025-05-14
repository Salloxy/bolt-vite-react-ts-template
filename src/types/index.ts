// src/types/index.ts

export type Suit = 'H' | 'D' | 'C' | 'S'; // Hearts, Diamonds, Clubs, Spades
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A'; // T for Ten

export interface Card {
  suit: Suit;
  rank: Rank;
  id: string; // e.g., "KH" for King of Hearts, "AS" for Ace of Spades
  hidden?: boolean; // To mark the 5th card as hidden
}

export interface Hand {
  cards: (Card | null)[]; // Each hand can have up to 5 cards, null if slot is empty
  // Potentially add hand evaluation result here later
}

export interface Player {
  id: string; // Could be socket.id for online players, or 'player1'/'ai' for local
  hands: Hand[]; // Each player has 5 hands
  // Potentially add player name or other details
}

export interface GameState {
  deck: Card[];
  id?: string; // Optional game ID, useful for online rooms
  players: Player[];
  currentPlayerId: string | null; // ID of the player whose turn it is
  gamePhase: 'setup' | 'playing' | 'evaluation' | 'gameOver';
  turnNumber: number;
  placementRuleActive: boolean; // Tracks if the placement restriction is active
  heldCard?: Card | null; // Card currently held by the active player (synced from server in online)
  winnerMessage?: string; // Overall game winner message
  individualHandWinners?: (string | null)[]; // Winner for each of the 5 hands
  turnStartTime?: number; // Timestamp when the current turn started
  turnTimerEndsAt?: number; // Timestamp when the current turn timer will end
  // Potentially add more game state info like scores, messages, etc.
}

// Add evaluation to Hand interface
export interface Hand {
  cards: (Card | null)[];
  evaluation?: EvaluatedHand | null; // Store evaluation result for display
}


// Enum for Poker Hand Rankings
export enum PokerHandRank {
  HIGH_CARD,
  ONE_PAIR,
  TWO_PAIR,
  THREE_OF_A_KIND,
  STRAIGHT,
  FLUSH,
  FULL_HOUSE,
  FOUR_OF_A_KIND,
  STRAIGHT_FLUSH,
  // ROYAL_FLUSH is a specific type of STRAIGHT_FLUSH
}

export interface EvaluatedHand {
  rank: PokerHandRank;
  values: Rank[]; // Ranks involved in the hand (e.g., [K, K] for a pair of Kings)
  description: string; // e.g., "Pair of Kings"
}

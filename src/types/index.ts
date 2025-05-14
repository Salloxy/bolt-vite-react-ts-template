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
  rematchState?: RematchState; // State of the rematch process
  rematchAgreedCount?: number; // Number of players who agreed to a rematch (0, 1, or 2)
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

export type RematchState = 
  | 'none'          // No rematch activity
  | 'can_offer'     // Game ended, current player can offer a rematch
  | 'offer_sent'    // Current player sent an offer, waiting for opponent
  | 'offer_received'// Opponent sent an offer, current player can accept/decline
  | 'accepted'      // Rematch accepted by both, waiting for server to start new game
  | 'declined_by_opponent' // Opponent declined the offer
  | 'declined_by_self'   // Current player declined the offer
  | 'cancelled_by_self' // Current player cancelled their sent offer
  | 'cancelled_by_opponent' // Opponent cancelled their sent offer
  | 'offer_timed_out';   // Offer (sent or received) timed out

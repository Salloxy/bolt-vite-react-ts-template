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

// --- Set & Seize Game Types ---

export type SnsSuit = 'H' | 'D' | 'C' | 'S'; // Hearts, Diamonds, Clubs, Spades
export type SnsRank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';

export interface SnsCard {
  suit: SnsSuit;
  rank: SnsRank;
  id: string; // e.g., "KH", "AS"
  value: number; // Numeric value for calculations (Ace can be 1 or 14, handled in logic)
  isAce?: boolean; // Flag for Aces to handle dual value
}

export interface SnsPlayer {
  id: string; // 'player1', 'player2' (or 'ai')
  hand: SnsCard[]; // 4 cards in hand
  capturedPile: SnsCard[];
  score: number;
  activeBuilds: SnsBuild[]; // Builds this player owns
}

export interface SnsBuild {
  id: string; // Unique ID for the build
  cards: SnsCard[]; // Cards comprising the build
  totalValue: number; // Sum of card values in the build
  ownerId: string; // Player who created/owns this build
  isHard: boolean; // True if it's a hard build
  // position?: { x: number, y: number }; // Optional: for UI positioning if needed
}

export interface SnsGameState {
  deck: SnsCard[];
  middleCards: SnsCard[];
  players: { [key: string]: SnsPlayer }; // 'player1', 'player2'
  currentPlayerId: string;
  gamePhase: 'dealing' | 'playing' | 'scoring' | 'gameOver';
  roundOver: boolean; // True when players have played their 4 cards
  lastCapturePlayerId: string | null; // ID of player who made the last capture
  mustCaptureBuildId: string | null; // ID of the build the current player must try to capture
  winnerMessage?: string;
  // Potentially add history of plays, etc.
}

// For scoring details
export interface SnsScoreDetails {
  aces: number; // count of aces
  twoOfSpades: boolean;
  tenOfDiamonds: boolean;
  mostSpades: boolean;
  mostCards: boolean;
  totalPoints: number;
}

export interface GameMessage {
  id: string;
  text: string;
  type: 'info' | 'error' | 'success' | 'action'; // 'action' for player actions like "Player1 captured 10H"
  timestamp: number;
}

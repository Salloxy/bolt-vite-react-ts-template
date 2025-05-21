import { useState, useEffect, useCallback } from 'react';
import { SnsCard, SnsSuit, SnsRank } from '../types'; // Import SnsCard, SnsSuit, SnsRank

// Helper to get card value (Ace can be 1 or 14, handled during play)
const getCardValue = (rank: SnsRank): number => {
  switch (rank) {
    case 'J': return 11;
    case 'Q': return 12;
    case 'K': return 13;
    case 'A': return 14; // Default to 14, can be changed to 1 during play
    case 'T': return 10; // 'T' for Ten
    default: return parseInt(rank, 10);
  }
};

// Generate a standard 52-card deck
const createDeck = (): SnsCard[] => {
  const suits: SnsSuit[] = ['H', 'D', 'C', 'S'];
  const ranks: SnsRank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
  const deck: SnsCard[] = [];

  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ 
        rank, 
        suit, 
        value: getCardValue(rank),
        id: `${rank}${suit}`, // Generate ID
        isAce: rank === 'A' // Flag for Aces
      });
    }
  }
  return deck;
};

// Shuffle function (Fisher-Yates)
const shuffleDeck = (deck: SnsCard[]): SnsCard[] => {
  let currentIndex = deck.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [deck[currentIndex], deck[randomIndex]] = [
      deck[randomIndex], deck[currentIndex]];
  }
  return deck;
};

interface UseSetAndSeizeGameLogicProps {
  isOnline: boolean;
}

const useSetAndSeizeGameLogic = ({ isOnline }: UseSetAndSeizeGameLogicProps) => {
  const [deck, setDeck] = useState<SnsCard[]>([]);
  const [playerHand, setPlayerHand] = useState<SnsCard[]>([]);
  const [aiHand, setAiHand] = useState<SnsCard[]>([]);
  const [middleCards, setMiddleCards] = useState<SnsCard[]>([]);
  const [playerCollected, setPlayerCollected] = useState<SnsCard[]>([]);
  const [aiCollected, setAiCollected] = useState<SnsCard[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<'player' | 'ai'>('player');
  const [mustCapture, setMustCapture] = useState(false);
  const [lastCapturePlayerId, setLastCapturePlayerId] = useState<'player' | 'ai' | null>(null);

  const dealNewHands = useCallback((currentDeck: SnsCard[]) => {
    const newDeck = shuffleDeck(currentDeck); // Shuffle remaining deck
    const newPlayerHand: SnsCard[] = [];
    const newAiHand: SnsCard[] = [];

    // Deal 4 new cards to each player
    for (let i = 0; i < 4; i++) {
      if (newDeck.length > 0) newPlayerHand.push(newDeck.pop()!);
      if (newDeck.length > 0) newAiHand.push(newDeck.pop()!);
    }

    setDeck(newDeck);
    setPlayerHand(newPlayerHand);
    setAiHand(newAiHand);
    // Do not add cards to the middle for new hands
  }, []);

  const initializeGame = useCallback(() => {
    const newDeck = shuffleDeck(createDeck());
    const initialPlayerHand: SnsCard[] = [];
    const initialAiHand: SnsCard[] = [];
    const initialMiddleCards: SnsCard[] = [];

    // Deal 4 cards face-down to each player
    for (let i = 0; i < 4; i++) {
      initialPlayerHand.push(newDeck.pop()!);
      initialAiHand.push(newDeck.pop()!);
    }

    // Deal 4 cards face-up to the middle
    for (let i = 0; i < 4; i++) {
      initialMiddleCards.push(newDeck.pop()!);
    }

    setDeck(newDeck);
    setPlayerHand(initialPlayerHand);
    setAiHand(initialAiHand);
    setMiddleCards(initialMiddleCards);
    setPlayerCollected([]);
    setAiCollected([]);
    setCurrentPlayer('player');
    setMustCapture(false);
    setLastCapturePlayerId(null);
  }, []);

  useEffect(() => {
    initializeGame();
  }, [initializeGame]);

  const endTurn = useCallback(() => {
    // Check if both hands are empty
    if (playerHand.length === 0 && aiHand.length === 0) {
      if (deck.length > 0) {
        // Deal new hands if deck is not empty
        dealNewHands(deck);
      } else {
        // Game over logic: Final Capture and Scoring
        console.log('Deck is empty. Game Over!');
        // For now, last player who captured gets middle cards
        if (lastCapturePlayerId) {
          if (lastCapturePlayerId === 'player') {
            setPlayerCollected(prev => [...prev, ...middleCards]);
          } else {
            setAiCollected(prev => [...prev, ...middleCards]);
          }
          setMiddleCards([]);
        }
        // TODO: Implement scoring
      }
    }
    setCurrentPlayer(prev => (prev === 'player' ? 'ai' : 'player'));
  }, [playerHand, aiHand, deck, dealNewHands, lastCapturePlayerId, middleCards]);

  const playCard = useCallback((cardToPlay: SnsCard, actionType: 'drop' | 'capture' | 'build', targetCards: SnsCard[] = []) => {
    // Remove card from current player's hand
    if (currentPlayer === 'player') {
      setPlayerHand(prev => prev.filter(c => c.id !== cardToPlay.id));
    } else {
      setAiHand(prev => prev.filter(c => c.id !== cardToPlay.id));
    }

    if (actionType === 'drop') {
      setMiddleCards(prev => [...prev, cardToPlay]);
      console.log(`${currentPlayer} drops ${cardToPlay.rank}${cardToPlay.suit}`);
    } else if (actionType === 'capture') {
      // Placeholder for capture logic
      console.log(`${currentPlayer} captures with ${cardToPlay.rank}${cardToPlay.suit}`);
      // For now, just add played card and target cards to collected pile
      if (currentPlayer === 'player') {
        setPlayerCollected(prev => [...prev, cardToPlay, ...targetCards]);
      } else {
        setAiCollected(prev => [...prev, cardToPlay, ...targetCards]);
      }
      setMiddleCards(prev => prev.filter(c => !targetCards.some(tc => tc.id === c.id))); // Remove captured cards from middle
      setLastCapturePlayerId(currentPlayer);
      setMustCapture(false); // Capture clears must-capture rule
    } else if (actionType === 'build') {
      // Placeholder for build logic
      console.log(`${currentPlayer} builds with ${cardToPlay.rank}${cardToPlay.suit}`);
      setMiddleCards(prev => [...prev, cardToPlay]); // For now, just add to middle
      setMustCapture(true); // Building activates must-capture rule
    }

    endTurn();
  }, [currentPlayer, endTurn]);

  // AI turn logic
  useEffect(() => {
    if (currentPlayer === 'ai' && !isOnline) {
      const aiTurnTimeout = setTimeout(() => {
        if (aiHand.length > 0) {
          const cardToPlay = aiHand[0]; // AI always plays the first card for now
          // Basic AI: always try to drop for now
          playCard(cardToPlay, 'drop');
        } else {
          // If AI hand is empty, end turn to trigger new hand dealing or game over
          endTurn();
        }
      }, 1000);

      return () => clearTimeout(aiTurnTimeout);
    }
  }, [currentPlayer, aiHand, isOnline, playCard, endTurn]);

  return {
    deck,
    playerHand,
    aiHand,
    middleCards,
    playerCollected,
    aiCollected,
    currentPlayer,
    mustCapture,
    initializeGame,
    playCard,
    // Add other game state and actions as needed
  };
};

export default useSetAndSeizeGameLogic;

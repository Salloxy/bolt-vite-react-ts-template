import { useState, useEffect, useCallback } from 'react';
import { SnsCard, SnsSuit, SnsRank } from '../types'; // Import SnsCard, SnsSuit, SnsRank

// Helper to get card value (Ace can be 1 or 14, handled during play)
const getCardValue = (rank: SnsRank): number => {
  switch (rank) {
    case 'J': return 11;
    case 'Q': return 12;
    case 'K': return 13;
    case 'A': return 14;
    case 'T': return 10;
    default: return parseInt(rank, 10);
  }
};

// Helper to get all possible numeric values for a card (e.g., Ace can be 1 or 14)
const getCardPossibleValues = (card: SnsCard): number[] => {
  if (card.isAce) {
    return [1, 14];
  }
  return [card.value];
};

// Recursive function to check if a set of cards can be partitioned into subsets,
// where each subset sums to the target value.
const canAllCardsBePartitioned = (
  targetSum: number,
  cards: SnsCard[],
  currentUsedIndices: boolean[] // Tracks which cards are used in the overall partitioning
): boolean => {
  // Base case: if all cards are used, we found a valid partition
  if (currentUsedIndices.every(u => u)) {
    return true;
  }

  // Find the first unused card to start a new subset search
  let firstUnusedIndex = -1;
  for (let i = 0; i < currentUsedIndices.length; i++) {
    if (!currentUsedIndices[i]) {
      firstUnusedIndex = i;
      break;
    }
  }

  // If no unused cards but not all are used (shouldn't happen if logic is correct)
  if (firstUnusedIndex === -1) {
    return false;
  }

  // Try to form a subset starting from firstUnusedIndex
  const findSubsetAndRecurse = (
    startIndexForSubset: number,
    currentSubsetSum: number,
    currentSubsetIndices: number[],
    tempUsedIndices: boolean[] // Temporary 'used' array for this subset branch
  ): boolean => {
    // If current subset sums to targetSum
    if (currentSubsetSum === targetSum) {
      // Create a new 'used' array for the next level of partitioning
      const nextOverallUsedIndices = [...currentUsedIndices];
      currentSubsetIndices.forEach(idx => nextOverallUsedIndices[idx] = true);

      // Recursively check if the remaining cards can be partitioned
      return canAllCardsBePartitioned(targetSum, cards, nextOverallUsedIndices);
    }

    // If current subset sum exceeds target or no more cards to consider for this subset
    if (currentSubsetSum > targetSum || startIndexForSubset >= cards.length) {
      return false;
    }

    // Try to add cards to the current subset
    for (let i = startIndexForSubset; i < cards.length; i++) {
      if (!tempUsedIndices[i]) { // Only consider cards not yet used in this temporary subset
        const card = cards[i];
        const possibleValues = getCardPossibleValues(card);

        for (const val of possibleValues) {
          currentSubsetIndices.push(i);
          tempUsedIndices[i] = true; // Mark as temporarily used for this subset branch

          if (findSubsetAndRecurse(i + 1, currentSubsetSum + val, currentSubsetIndices, tempUsedIndices)) {
            return true;
          }

          currentSubsetIndices.pop(); // Backtrack
          tempUsedIndices[i] = false; // Unmark for backtracking
        }
      }
    }
    return false;
  };

  // Start the process of finding a subset from the first unused card
  const initialTempUsedIndices = [...currentUsedIndices]; // Copy the overall used state
  return findSubsetAndRecurse(firstUnusedIndex, 0, [], initialTempUsedIndices);
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
  const [hasPlayedCardThisTurn, setHasPlayedCardThisTurn] = useState(false);
  const [selectedMiddleCards, setSelectedMiddleCards] = useState<SnsCard[]>([]); // New state for selected middle cards

  const toggleMiddleCardSelection = useCallback((card: SnsCard) => {
    setSelectedMiddleCards(prev =>
      prev.some(c => c.id === card.id)
        ? prev.filter(c => c.id !== card.id)
        : [...prev, card]
    );
  }, []);

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
    setHasPlayedCardThisTurn(false);
  }, []);

  useEffect(() => {
    initializeGame();
  }, [initializeGame]);

  const endTurn = useCallback(() => {
    setCurrentPlayer(prev => {
      setHasPlayedCardThisTurn(false); // Reset for the next player's turn
      return prev === 'player' ? 'ai' : 'player';
    });
  }, []); // Dependencies changed as it no longer relies on playerHand, aiHand, deck etc.

  useEffect(() => {
    // Only trigger this logic if both hands are empty
    if (playerHand.length === 0 && aiHand.length === 0) {
      if (deck.length > 0) {
        // Deal new hands if deck is not empty
        dealNewHands(deck);
      } else {
        // Game over logic: Deck is empty and no more cards to deal
        console.log('Deck is empty. Game Over!');
        // Last player who captured gets middle cards
        if (lastCapturePlayerId) {
          if (lastCapturePlayerId === 'player') {
            setPlayerCollected(prev => [...prev, ...middleCards]);
          } else {
            setAiCollected(prev => [...prev, ...middleCards]);
          }
          setMiddleCards([]); // Clear middle cards
        }
        // TODO: Implement final scoring and game end state
      }
    }
  }, [playerHand, aiHand, deck, dealNewHands, lastCapturePlayerId, middleCards, setPlayerCollected, setAiCollected, setMiddleCards]);

  const checkValidCapture = useCallback((handCard: SnsCard, middleCardsToCapture: SnsCard[]): boolean => {
    if (middleCardsToCapture.length === 0) {
      return false;
    }

    const handCardPossibleValues = getCardPossibleValues(handCard);

    for (const handValue of handCardPossibleValues) {
      const initialUsedIndices = new Array(middleCardsToCapture.length).fill(false);
      if (canAllCardsBePartitioned(handValue, middleCardsToCapture, initialUsedIndices)) {
        return true;
      }
    }
    return false;
  }, []);

  const playCard = useCallback((cardToPlay: SnsCard, actionType: 'drop' | 'capture' | 'build') => {
    if (hasPlayedCardThisTurn) {
      console.log(`${currentPlayer} has already played a card this turn.`);
      return;
    }

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
      if (!checkValidCapture(cardToPlay, selectedMiddleCards)) {
        console.log("Invalid capture: Selected middle cards do not sum up to the played card's value.");
        // Re-add the card to the player's hand if the capture is invalid
        if (currentPlayer === 'player') {
          setPlayerHand(prev => [...prev, cardToPlay]);
        } else {
          setAiHand(prev => [...prev, cardToPlay]);
        }
        setSelectedMiddleCards([]); // Clear selected middle cards
        return; // Stop the function execution
      }

      console.log(`${currentPlayer} captures with ${cardToPlay.rank}${cardToPlay.suit} and target cards:`, selectedMiddleCards);
      if (currentPlayer === 'player') {
        setPlayerCollected(prev => [...prev, cardToPlay, ...selectedMiddleCards]);
      } else {
        setAiCollected(prev => [...prev, cardToPlay, ...selectedMiddleCards]);
      }
      setMiddleCards(prev => prev.filter(c => !selectedMiddleCards.some(tc => tc.id === c.id)));
      setLastCapturePlayerId(currentPlayer);
      setMustCapture(false);
      setSelectedMiddleCards([]); // Clear selected middle cards after capture
    } else if (actionType === 'build') {
      console.log(`${currentPlayer} builds with ${cardToPlay.rank}${cardToPlay.suit}`);
      setMiddleCards(prev => [...prev, cardToPlay]);
      setMustCapture(true);
    }

    setHasPlayedCardThisTurn(true);
    endTurn();
  }, [currentPlayer, endTurn, hasPlayedCardThisTurn, selectedMiddleCards, checkValidCapture]); // Added checkValidCapture to dependencies

  // AI turn logic
  useEffect(() => {
    if (currentPlayer === 'ai' && !isOnline) {
      const aiTurnTimeout = setTimeout(() => {
        if (aiHand.length > 0) {
          const cardToPlay = aiHand[0];
          // Basic AI: always try to drop for now
          playCard(cardToPlay, 'drop');
        } else {
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
    selectedMiddleCards, // Expose selected middle cards
    setSelectedMiddleCards, // Expose the setter for selectedMiddleCards
    initializeGame,
    playCard,
    toggleMiddleCardSelection, // Expose toggle function
    hasPlayedCardThisTurn,
    checkValidCapture, // Expose checkValidCapture
    // Add other game state and actions as needed
  };
};

export default useSetAndSeizeGameLogic;

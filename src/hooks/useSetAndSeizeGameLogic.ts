import { useState, useEffect, useCallback } from 'react';
import { SnsCard, SnsSuit, SnsRank, SnsBuild } from '../types';
import { getRankValue } from '../lib/utils'; // Import getRankValue

// Helper to get all possible numeric values for a card (e.g., Ace can be 1 or 14)
// This is specifically for capture logic where multiple sums are possible.
const getCardPossibleValues = (card: SnsCard): number[] => {
  // Assuming SnsCard now has a 'rank' property
  const rankValue = getRankValue(card.rank);
  if (card.rank === 'A') {
    return [1, rankValue]; // Ace can be 1 or 14
  }
  return [rankValue];
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
        value: getRankValue(rank), // Use getRankValue here
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
  // Helper to flatten selected items (cards or builds) into individual cards
  const getIndividualCardsFromSelection = useCallback((items: (SnsCard | SnsBuild)[]): SnsCard[] => {
    return items.flatMap(item => 'cards' in item ? item.cards : item);
  }, []);

  const [deck, setDeck] = useState<SnsCard[]>([]);
  const [playerHand, setPlayerHand] = useState<SnsCard[]>([]);
  const [aiHand, setAiHand] = useState<SnsCard[]>([]);
  const [middleCards, setMiddleCards] = useState<(SnsCard | SnsBuild)[]>([]);
  const [playerCollected, setPlayerCollected] = useState<SnsCard[]>([]);
  const [aiCollected, setAiCollected] = useState<SnsCard[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<'player' | 'ai'>('player');
  const [mustCapture, setMustCapture] = useState(false);
  const [lastCapturePlayerId, setLastCapturePlayerId] = useState<'player' | 'ai' | null>(null);
  const [hasPlayedCardThisTurn, setHasPlayedCardThisTurn] = useState(false);
  const [selectedMiddleCards, setSelectedMiddleCards] = useState<(SnsCard | SnsBuild)[]>([]); // New state for selected middle cards

  const toggleMiddleCardSelection = useCallback((item: SnsCard | SnsBuild) => {
    setSelectedMiddleCards(prev =>
      prev.some(c => c.id === item.id)
        ? prev.filter(c => c.id !== item.id)
        : [...prev, item]
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
      initialMiddleCards.push(newDeck.pop() as SnsCard); // Cast to SnsCard
    }

    setDeck(newDeck);
    setPlayerHand(initialPlayerHand);
    setAiHand(initialAiHand);
    setMiddleCards(initialMiddleCards as (SnsCard | SnsBuild)[]); // Cast to the correct type
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
          const remainingMiddleCards = getIndividualCardsFromSelection(middleCards);
          if (lastCapturePlayerId === 'player') {
            setPlayerCollected(prev => [...prev, ...remainingMiddleCards]);
          } else {
            setAiCollected(prev => [...prev, ...remainingMiddleCards]);
          }
          setMiddleCards([]); // Clear middle cards
        }
        // TODO: Implement final scoring and game end state
      }
    }
  }, [playerHand, aiHand, deck, dealNewHands, lastCapturePlayerId, middleCards, setPlayerCollected, setAiCollected, setMiddleCards, getIndividualCardsFromSelection]);

  const checkValidCapture = useCallback((handCard: SnsCard, selectedMiddleItems: (SnsCard | SnsBuild)[]): boolean => {
    if (selectedMiddleItems.length === 0) {
      return false;
    }

    const middleCardsToCapture = getIndividualCardsFromSelection(selectedMiddleItems);

    const handCardPossibleValues = getCardPossibleValues(handCard);

    for (const handValue of handCardPossibleValues) {
      const initialUsedIndices = new Array(middleCardsToCapture.length).fill(false);
      if (canAllCardsBePartitioned(handValue, middleCardsToCapture, initialUsedIndices)) {
        return true;
      }
    }
    return false;
  }, [getIndividualCardsFromSelection]);

  const checkValidSoftBuild = useCallback((
    handCard: SnsCard,
    targetCard: SnsCard,
    selectedMiddleItems: (SnsCard | SnsBuild)[]
  ): boolean => {
    if (!handCard || !targetCard || selectedMiddleItems.length === 0) {
      return false;
    }

    const middleCardsToBuild = getIndividualCardsFromSelection(selectedMiddleItems);

    const targetCardPossibleValues = getCardPossibleValues(targetCard);
    const handCardPossibleValues = getCardPossibleValues(handCard);

    // Function to generate all possible sums from a list of cards
    const generatePossibleSums = (cards: SnsCard[]): number[] => {
      if (cards.length === 0) {
        return [0];
      }

      const firstCard = cards[0];
      const restOfCards = cards.slice(1);

      const sumsFromRest = generatePossibleSums(restOfCards);
      const possibleValuesOfFirstCard = getCardPossibleValues(firstCard);

      const allSums: number[] = [];
      for (const sumRest of sumsFromRest) {
        for (const valFirst of possibleValuesOfFirstCard) {
          allSums.push(sumRest + valFirst);
        }
      }
      return Array.from(new Set(allSums)); // Remove duplicates
    };

    const possibleSumsOfMiddleCards = generatePossibleSums(middleCardsToBuild);

    for (const handValue of handCardPossibleValues) {
      for (const middleSum of possibleSumsOfMiddleCards) {
        const totalSum = handValue + middleSum;
        if (targetCardPossibleValues.includes(totalSum)) {
          return true;
        }
      }
    }
    return false;
  }, [getIndividualCardsFromSelection]);

  const playCard = useCallback((
    cardToPlay: SnsCard,
    actionType: 'drop' | 'capture' | 'build',
    targetCard?: SnsCard | null, // Optional for build action
    buildType?: 'soft-build' | 'hard-build' | null // Optional for build action
  ) => {
    if (hasPlayedCardThisTurn) {
      console.log(`${currentPlayer} has already played a card this turn.`);
      return;
    }

    // Remove cardToPlay from current player's hand
    if (currentPlayer === 'player') {
      setPlayerHand(prev => prev.filter(c => c.id !== cardToPlay.id));
    } else {
      setAiHand(prev => prev.filter(c => c.id !== cardToPlay.id));
    }

    if (actionType === 'drop') {
      setMiddleCards((prevMiddleCards: (SnsCard | SnsBuild)[]) => [...prevMiddleCards, cardToPlay as SnsCard]);
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
      
      const capturedIndividualCards = getIndividualCardsFromSelection(selectedMiddleCards);

      if (currentPlayer === 'player') {
        setPlayerCollected(prev => [...prev, cardToPlay, ...capturedIndividualCards]);
      } else {
        setAiCollected(prev => [...prev, cardToPlay, ...capturedIndividualCards]);
      }
      setMiddleCards(prev => prev.filter(item => !selectedMiddleCards.some(selectedItem => selectedItem.id === item.id)));
      setLastCapturePlayerId(currentPlayer);
      setMustCapture(false);
      setSelectedMiddleCards([]); // Clear selected middle cards after capture
    } else if (actionType === 'build' && targetCard && buildType === 'soft-build') {
      if (!checkValidSoftBuild(cardToPlay, targetCard, selectedMiddleCards)) {
        console.log("Invalid soft build: Selected cards do not sum up to the target value.");
        // Re-add the card to the player's hand if the build is invalid
        if (currentPlayer === 'player') {
          setPlayerHand(prev => [...prev, cardToPlay]);
        } else {
          setAiHand(prev => [...prev, cardToPlay]);
        }
        setSelectedMiddleCards([]); // Clear selected middle cards
        return; // Stop the function execution
      }

      console.log(`${currentPlayer} performs a soft build with ${cardToPlay.rank}${cardToPlay.suit} onto`, selectedMiddleCards, `to target ${targetCard.rank}${targetCard.suit}`);

      // Create a new SnsBuild object
      const newBuild: SnsBuild = {
        id: `BUILD-${targetCard.id}-${Date.now()}`, // Unique ID for the build
        cards: [cardToPlay, ...selectedMiddleCards], // All cards in the pile
        totalValue: getRankValue(targetCard.rank), // The target value
        ownerId: currentPlayer, // The player who created this build
        isHard: false, // This is a soft build
      };

      // Remove selected middle cards from the middle
      setMiddleCards(prev => prev.filter(item => {
        const isSelected = selectedMiddleCards.some(selectedItem => selectedItem.id === item.id);
        return item.id !== cardToPlay.id && !isSelected;
      }));
      
      // Add the new built pile to the middle
      setMiddleCards(prev => [...prev, newBuild]);

      setMustCapture(true); // A build always results in a capture opportunity
      setSelectedMiddleCards([]); // Clear selected middle cards after build
    } else if (actionType === 'build' && buildType === 'hard-build') {
      console.log(`${currentPlayer} initiates a hard build (functionality not yet implemented)`);
      // Hard build logic will go here later
      setMiddleCards(prev => [...prev, cardToPlay]); // For now, just drop the card
      setMustCapture(true);
    }

    setHasPlayedCardThisTurn(true);
    endTurn();
  }, [currentPlayer, endTurn, hasPlayedCardThisTurn, selectedMiddleCards, checkValidCapture, checkValidSoftBuild]); // Added checkValidSoftBuild to dependencies

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
    checkValidSoftBuild, // Expose checkValidSoftBuild
    // Add other game state and actions as needed
  };
};

export default useSetAndSeizeGameLogic;

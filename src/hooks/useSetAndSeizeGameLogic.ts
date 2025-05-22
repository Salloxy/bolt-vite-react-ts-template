// DEBUG: Attempting write at 2025-05-21 22:16:45
import { useState, useEffect, useCallback, useRef } from 'react';
import { SnsCard, SnsSuit, SnsRank, SnsBuild, SnsGameState, SnsPlayerState } from '../types';
import { getRankValue } from '../lib/utils'; // Import getRankValue
import io, { Socket } from 'socket.io-client';

// Helper to get all possible numeric values for a card (e.g., Ace can be 1 or 14)
// This is specifically for capture logic where multiple sums are possible.
const getCardPossibleValues = (card: SnsCard): number[] => {
  // Assuming SnsCard now has a 'rank' property
  const rankValue = getRankValue(card.rank);
  let possibleValues: number[];
  if (card.rank === 'A') {
    possibleValues = [1, rankValue]; // Ace can be 1 or 14
  } else {
    possibleValues = [rankValue];
  }
  console.log(`getCardPossibleValues: card=${card.id}, rankValue=${rankValue}, possibleValues=${possibleValues.join(',')}`);
  return possibleValues;
};

// Helper to find all possible combinations of cards that sum to a target value
// Returns an array of arrays of SnsCard objects, representing the combinations
const findAllSubsetsSummingToTarget = (
  targetSum: number,
  cards: SnsCard[],
): SnsCard[][] => {
  const results: SnsCard[][] = [];

  const find = (
    startIndex: number,
    currentSubset: SnsCard[],
    currentSubsetValues: number[] // Store the specific values chosen for each card in the subset
  ) => {
    const currentSum = currentSubsetValues.reduce((acc, val) => acc + val, 0);

    if (currentSum === targetSum) {
      if (currentSubset.length > 0) {
        results.push([...currentSubset]);
      }
      // Do NOT return here, continue to find other combinations
    }
    if (currentSum > targetSum || startIndex >= cards.length) {
      return;
    }

    for (let i = startIndex; i < cards.length; i++) {
      const card = cards[i];
      const possibleValues = getCardPossibleValues(card);

      for (const val of possibleValues) {
        currentSubset.push(card);
        currentSubsetValues.push(val);
        find(i + 1, currentSubset, currentSubsetValues);
        currentSubsetValues.pop(); // Backtrack
        currentSubset.pop(); // Backtrack
      }
    }
  };

  find(0, [], []);
  console.log(`findAllSubsetsSummingToTarget: targetSum=${targetSum}, cards=${cards.map(c => c.id).join(',')}, results=${JSON.stringify(results.map(s => s.map(c => c.id)))}`);
  return results;
};

// New helper: Finds if a set of cards can be partitioned into multiple subsets, each summing to targetSum.
// Returns an array of arrays of builds (SnsCard[][]) if successful, or null.
const findMultipleDisjointBuilds = (
  targetSum: number,
  cardsPool: SnsCard[], // All cards available for partitioning
  minBuilds: number, // Minimum number of builds required
  currentPartition: SnsCard[][], // Builds found so far in this partition attempt
  usedIndices: boolean[] // Tracks which cards from cardsPool are used
): SnsCard[][] | null => {
  // Base case: If all cards are used and we have enough builds
  if (usedIndices.every(u => u)) {
    if (currentPartition.length >= minBuilds) {
      return currentPartition;
    }
    return null; // Not enough builds
  }

  // Find the first unused card to start a new subset search
  let firstUnusedIndex = -1;
  for (let i = 0; i < usedIndices.length; i++) {
    if (!usedIndices[i]) {
      firstUnusedIndex = i;
      break;
    }
  }

  // If no unused cards left and we haven't found enough builds
  if (firstUnusedIndex === -1) {
    return null;
  }

  // Find all subsets starting from firstUnusedIndex that sum to targetSum
  // Only consider cards not yet used in the overall partitioning
  const availableCardsForSubset = cardsPool.filter((_, idx) => !usedIndices[idx]);
  const possibleSubsets = findAllSubsetsSummingToTarget(targetSum, availableCardsForSubset);

  for (const subset of possibleSubsets) {
    // Create new usedIndices for this branch
    const nextUsedIndices = [...usedIndices];
    let canUseSubset = true;
    for (const sCard of subset) {
      const originalIndex = cardsPool.findIndex(c => c.id === sCard.id); // Find original index in the full pool
      if (originalIndex === -1 || nextUsedIndices[originalIndex]) {
        canUseSubset = false; // Card already used or not found (shouldn't happen if logic is correct)
        break;
      }
      nextUsedIndices[originalIndex] = true;
    }

    if (canUseSubset) {
      const result = findMultipleDisjointBuilds(
        targetSum,
        cardsPool,
        minBuilds,
        [...currentPartition, subset],
        nextUsedIndices
      );
      if (result) {
        return result;
      }
    }
  }
  return null;
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
    if (currentSubsetSum > targetSum || startIndexForSubset >= cards.length) {
      return false;
    }
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

  const socketRef = useRef<Socket | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [players, setPlayers] = useState<SnsPlayerState[]>([]);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [middleCards, setMiddleCards] = useState<(SnsCard | SnsBuild)[]>([]);
  const [deckSize, setDeckSize] = useState<number>(0);
  const [lastCapturePlayerId, setLastCapturePlayerId] = useState<string | null>(null);
  const [gameEnded, setGameEnded] = useState(false);
  const [gameResult, setGameResult] = useState<{ winner: 'player' | 'ai' | 'draw' | null; playerScore: number; aiScore: number } | null>(null);
  const [gamePhase, setGamePhase] = useState<'loading' | 'playing' | 'gameOver'>('loading');
  const [isGameInitialized, setIsGameInitialized] = useState(false);
  const [playerMustCapture, setPlayerMustCapture] = useState(false);
  const [playerLastBuildValue, setPlayerLastBuildValue] = useState<number | null>(null);
  const [playerJustMadeBuild, setPlayerJustMadeBuild] = useState(false);
  const [selectedMiddleCards, setSelectedMiddleCards] = useState<(SnsCard | SnsBuild)[]>([]);
  const [selectedPlayerCard, setSelectedPlayerCard] = useState<SnsCard | null>(null);
  const [turnTimerEndsAt, setTurnTimerEndsAt] = useState<number | undefined>(undefined);
  const [messages, setMessages] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const toggleMiddleCardSelection = useCallback((item: SnsCard | SnsBuild) => {
    setSelectedMiddleCards(prev => {
      const newSelection = prev.some(c => c.id === item.id)
        ? prev.filter(c => c.id !== item.id)
        : [...prev, item];

      if (isOnline && socketRef.current && gameId) {
        socketRef.current.emit('snsSelectMiddleCard', { gameId, playerId: socketRef.current.id, selectedItems: newSelection });
      }
      return newSelection;
    });
  }, [isOnline, gameId]); // middleCards is no longer a direct dependency, but isOnline and gameId are.

  const initializeGame = useCallback(() => {
    if (isOnline) {
      console.log('Online game: Initializing via server matchmaking.');
      setGamePhase('loading');
      setMessages(prev => [...prev, 'Looking for an opponent...']);
      if (socketRef.current) {
        socketRef.current.emit('findSetAndSeizeMatch');
      }
    } else {
      console.log('Offline game: Initializing locally.');
      const newDeck = shuffleDeck(createDeck());
      const initialPlayerHand: SnsCard[] = [];
      const initialAiHand: SnsCard[] = [];
      const initialMiddleCards: (SnsCard | SnsBuild)[] = [];

      for (let i = 0; i < 4; i++) {
        if (newDeck.length > 0) initialPlayerHand.push(newDeck.pop()!);
        if (newDeck.length > 0) initialAiHand.push(newDeck.pop()!);
      }

      for (let i = 0; i < 4; i++) {
        if (newDeck.length > 0) initialMiddleCards.push(newDeck.pop()!);
      }

      setPlayers([
        { id: 'player', hand: initialPlayerHand, collectedCards: [], mustCapture: false, lastBuildValue: null, justMadeBuild: false },
        { id: 'ai', hand: initialAiHand, collectedCards: [], mustCapture: false, lastBuildValue: null, justMadeBuild: false }
      ]);
      setMiddleCards(initialMiddleCards);
      setDeckSize(newDeck.length);
      setCurrentPlayerId('player');
      setLastCapturePlayerId(null);
      setGameEnded(false);
      setGameResult(null);
      setGamePhase('playing');
      setIsGameInitialized(true);
      setSelectedMiddleCards([]);
      setSelectedPlayerCard(null);
      setPlayerMustCapture(false);
      setPlayerLastBuildValue(null);
      setPlayerJustMadeBuild(false);
    }
  }, [isOnline]);

  const resetGame = useCallback(() => {
    setGameEnded(false);
    setGameResult(null);
    setGamePhase('loading');
    setIsGameInitialized(false);
    setSelectedMiddleCards([]);
    setSelectedPlayerCard(null);
    setMessages([]);
    setErrors([]);
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    initializeGame();
  }, [initializeGame, isOnline]);

  const cancelMatchmaking = useCallback(() => {
    if (isOnline && socketRef.current && socketRef.current.connected) {
      console.log('Cancelling Set & Seize matchmaking...');
      socketRef.current.emit('cancelSetAndSeizeMatchmaking');
      setMessages(prev => [...prev, 'Matchmaking cancelled.']);
      setGamePhase('loading'); // Go back to loading state
      setIsGameInitialized(false); // Reset initialization state
      setErrors([]); // Clear any errors
    }
  }, [isOnline]);

  useEffect(() => {
    if (isOnline && !socketRef.current) {
      const socket = io(import.meta.env.VITE_SNS_SERVER_URL || 'http://localhost:3001');
      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('Connected to Set & Seize server:', socket.id);
        setMessages(prev => [...prev, 'Connected to server.']);
        initializeGame(); // Start matchmaking once connected
      });

      socket.on('snsGameStart', (gameState: SnsGameState) => {
        console.log('Received snsGameStart. Full gameState:', JSON.stringify(gameState, null, 2));
        console.log('Player hands on game start:', gameState.players.map(p => ({ id: p.id, handSize: p.hand.length })));
        setGameId(gameState.id);
        setPlayers(gameState.players.map(p => ({
          ...p,
          hand: p.hand.map(card => ({ ...card })), // Deep copy cards in hand
          collectedCards: p.collectedCards.map(card => ({ ...card })), // Deep copy collected cards
        })));
        setMiddleCards(gameState.middleCards.map(item => {
          if ('cards' in item) {
            return { ...item, cards: item.cards.map(card => ({ ...card })) }; // Deep copy cards in builds
          }
          return { ...item }; // Deep copy single cards
        }));
        setDeckSize(gameState.deck.length);
        setCurrentPlayerId(gameState.currentPlayerId);
        setLastCapturePlayerId(gameState.lastCapturePlayerId);
        setGameEnded(gameState.gameEnded);
        setGameResult(gameState.gameResult);
        setGamePhase(gameState.gamePhase);
        setIsGameInitialized(true);
        setTurnTimerEndsAt(gameState.turnTimerEndsAt);
        setMessages(prev => [...prev, 'Game started!']);
        setErrors([]); // Clear errors on game start
      });

      socket.on('snsGameStateUpdate', (gameState: SnsGameState) => {
        console.log('Received snsGameStateUpdate. Full gameState:', JSON.stringify(gameState, null, 2));
        console.log('Player hands on update:', gameState.players.map(p => ({ id: p.id, handSize: p.hand.length, handIds: p.hand.map(c => c.id) })));
        setPlayers(gameState.players.map(p => ({
          ...p,
          hand: p.hand.map(card => ({ ...card })), // Deep copy cards in hand
          collectedCards: p.collectedCards.map(card => ({ ...card })), // Deep copy collected cards
        })));
        setMiddleCards(gameState.middleCards.map(item => {
          if ('cards' in item) {
            return { ...item, cards: item.cards.map(card => ({ ...card })) }; // Deep copy cards in builds
          }
          return { ...item }; // Deep copy single cards
        }));
        setDeckSize(gameState.deck.length);
        setCurrentPlayerId(gameState.currentPlayerId);
        setLastCapturePlayerId(gameState.lastCapturePlayerId);
        setGameEnded(gameState.gameEnded);
        setGameResult(gameState.gameResult);
        setGamePhase(gameState.gamePhase);
        setTurnTimerEndsAt(gameState.turnTimerEndsAt);
        // Update player-specific states for the current client
        const selfPlayerState = gameState.players.find((p: SnsPlayerState) => p.id === socketRef.current?.id);
        if (selfPlayerState) {
          setPlayerMustCapture(selfPlayerState.mustCapture);
          setPlayerLastBuildValue(selfPlayerState.lastBuildValue);
          setPlayerJustMadeBuild(selfPlayerState.justMadeBuild);
        }
        setSelectedMiddleCards([]); // Clear selection after server update
        setSelectedPlayerCard(null); // Clear selection after server update
      });

      socket.on('snsTurnTimeout', ({ playerId }: { gameId: string, playerId: string }) => {
        // This event is no longer used, as players are now kicked on timeout.
        // The 'snsKickedDueToTimeout' or 'snsOpponentDisconnected' events will handle this.
        console.log(`(Deprecated) Player ${playerId} timed out.`);
      });

      socket.on('snsKickedDueToTimeout', ({ message }: { gameId: string, playerId: string, message: string }) => {
        console.log('Kicked due to timeout:', message);
        setMessages(prev => [...prev, message]);
        setGameEnded(true);
        setGamePhase('gameOver');
        setGameResult({ winner: 'ai', playerScore: 0, aiScore: 99 }); // Player loses if kicked
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
        }
      });

      socket.on('snsOpponentDisconnected', (message: string) => {
        console.log('Opponent disconnected:', message);
        setMessages(prev => [...prev, `Opponent disconnected: ${message}`]);
        setGameEnded(true);
        setGamePhase('gameOver');
        setGameResult({ winner: 'player', playerScore: 99, aiScore: 0 }); // Award win to player
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
        }
      });

      socket.on('snsMessage', (message: string) => {
        setMessages(prev => [...prev, message]);
      });

      socket.on('snsError', (error: string) => {
        setErrors(prev => [...prev, error]);
        console.error('Set & Seize Server Error:', error);
      });

      socket.on('disconnect', () => {
        console.log('Disconnected from Set & Seize server.');
        setMessages(prev => [...prev, 'Disconnected from server.']);
        setGameEnded(true);
        setGamePhase('gameOver');
        setGameResult(prev => prev || { winner: null, playerScore: 0, aiScore: 0 }); // Set a default if not already set
        socketRef.current = null;
      });

      return () => {
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
        }
      };
    } else if (!isOnline && !isGameInitialized) {
      // For offline play, initialize game directly if not already initialized
      initializeGame();
    }
  }, [isOnline, initializeGame, isGameInitialized]);

  // AI turn logic (only for offline play)
  useEffect(() => {
    const selfPlayer = players.find(p => p.id === socketRef.current?.id);
    const opponentPlayer = players.find(p => p.id !== socketRef.current?.id);

    if (!isOnline && currentPlayerId === 'ai' && opponentPlayer) {
      const aiTurnTimeout = setTimeout(() => {
        if (opponentPlayer.hand.length > 0) {
          const cardToPlay = opponentPlayer.hand[0];
          // Basic AI: always try to drop for now
          // In a real AI, this would involve complex decision-making
          playCard(cardToPlay, 'drop');
        } else {
          // If AI has no cards, end turn (this shouldn't happen if dealing new hands works)
          // This path might need more robust handling for game end in offline mode
          console.log('AI has no cards, ending turn.');
          // For now, we'll just let the game end naturally if deck is empty.
        }
      }, 1000);

      return () => clearTimeout(aiTurnTimeout);
    }
  }, [currentPlayerId, players, isOnline]); // Depend on currentPlayerId and players

  const checkValidCapture = useCallback((handCard: SnsCard, selectedMiddleItems: (SnsCard | SnsBuild)[]): boolean => {
    if (selectedMiddleItems.length === 0) {
      return false;
    }

    const middleCardsToCapture = getIndividualCardsFromSelection(selectedMiddleItems);

    const handCardPossibleValues = getCardPossibleValues(handCard);

    // First, validate that if any part of a hard build is selected, the entire hard build is selected.
    const selectedHardBuildGroups = new Set<string>();
    const selectedIndividualHardBuilds = new Set<string>();

    selectedMiddleItems.forEach(item => {
      if ('isHard' in item && item.isHard && item.hardBuildGroupId) {
        selectedHardBuildGroups.add(item.hardBuildGroupId);
        selectedIndividualHardBuilds.add(item.id);
      }
    });

    for (const groupId of selectedHardBuildGroups) {
      const allGroupMembers = middleCards.filter(
        (mItem): mItem is SnsBuild =>
          'isHard' in mItem && mItem.isHard && mItem.hardBuildGroupId === groupId
      );
      // Check if all members of this hard build group are present in selectedMiddleItems
      const allMembersSelected = allGroupMembers.every(member =>
        selectedIndividualHardBuilds.has(member.id)
      );
      if (!allMembersSelected) {
        console.log("Invalid capture: Partial hard build selected.");
        return false; // Partial hard build selected, invalid capture
      }
    }

    for (const handValue of handCardPossibleValues) {
      const initialUsedIndices = new Array(middleCardsToCapture.length).fill(false);
      if (canAllCardsBePartitioned(handValue, middleCardsToCapture, initialUsedIndices)) {
        return true;
      }
    }
    return false;
  }, [getIndividualCardsFromSelection, middleCards]); // middleCards is a dependency now

  const checkValidSoftBuild = useCallback((
    handCard: SnsCard,
    targetCard: SnsCard,
    selectedMiddleItems: (SnsCard | SnsBuild)[]
  ): boolean => {
    if (!handCard || !targetCard || selectedMiddleItems.length === 0) {
      return false;
    }

    const middleCardsToBuild = getIndividualCardsFromSelection(selectedMiddleItems);

    const targetValue = getRankValue(targetCard.rank);
    const handCardPossibleValues = getCardPossibleValues(handCard);

    for (const handValue of handCardPossibleValues) {
      const requiredSumFromMiddle = targetValue - handValue;
      if (requiredSumFromMiddle < 0) continue;

      const possibleMiddleSubsets = findAllSubsetsSummingToTarget(requiredSumFromMiddle, middleCardsToBuild);

      for (const subset of possibleMiddleSubsets) {
        // Check if this subset uses ALL cards from middleCardsToBuild
        if (subset.length === middleCardsToBuild.length &&
            subset.every(sCard => middleCardsToBuild.some(mCard => mCard.id === sCard.id))) {
          return true;
        }
      }
    }
    return false;
  }, [getIndividualCardsFromSelection]);

  const checkValidHardBuild = useCallback((
    handCard: SnsCard,
    targetCard: SnsCard,
    selectedMiddleItems: (SnsCard | SnsBuild)[]
  ): SnsCard[][] | null => { // Returns an array of builds (each build is an array of cards) or null
    console.log(`checkValidHardBuild: handCard=${handCard.id}, targetCard=${targetCard.id}, selectedMiddleItems=${selectedMiddleItems.map(item => item.id).join(',')}`);
    if (!handCard || !targetCard || selectedMiddleItems.length === 0) {
      console.log("checkValidHardBuild: Initial check failed (missing cards or empty selection).");
      return null;
    }

    const middleCardsToBuild = getIndividualCardsFromSelection(selectedMiddleItems);
    const targetValue = getRankValue(targetCard.rank);
    console.log(`checkValidHardBuild: middleCardsToBuild=${middleCardsToBuild.map(c => c.id).join(',')}, targetValue=${targetValue}`);

    // Combine handCard and middleCardsToBuild into a single pool for partitioning
    const allPotentialBuildCards = [handCard, ...middleCardsToBuild];
    const initialUsedIndices = new Array(allPotentialBuildCards.length).fill(false);

    // Try to find multiple disjoint builds from the combined pool
    const foundBuilds = findMultipleDisjointBuilds(
      targetValue,
      allPotentialBuildCards,
      2, // Minimum 2 builds for a hard build
      [],
      initialUsedIndices
    );

    if (foundBuilds) {
      // Verify that the handCard is part of one of the found builds
      const handCardUsed = foundBuilds.some(build => build.some(c => c.id === handCard.id));
      if (!handCardUsed) {
        console.log("checkValidHardBuild: Hand card not used in any found build.");
        return null;
      }

      // Verify that all selected middle cards are used across the found builds
      const allUsedCardsInFoundBuilds = new Set<string>();
      foundBuilds.forEach(build => build.forEach(c => allUsedCardsInFoundBuilds.add(c.id)));

      const allSelectedMiddleUsed = middleCardsToBuild.every(mc => {
        const isUsed = allUsedCardsInFoundBuilds.has(mc.id);
        console.log(`checkValidHardBuild: Checking if middle card ${mc.id} is used: ${isUsed}`);
        return isUsed;
      });
      console.log(`checkValidHardBuild: Final check: allSelectedMiddleUsed = ${allSelectedMiddleUsed}`);

      if (!allSelectedMiddleUsed) {
        console.log("checkValidHardBuild: Not all selected middle cards were used in the builds.");
        return null;
      }

      console.log(`checkValidHardBuild: Valid hard build found: ${JSON.stringify(foundBuilds.map(s => s.map(c => c.id)))}`);
      return foundBuilds;
    }

    return null; // No valid hard build found
  }, [getIndividualCardsFromSelection]);

  const playCard = useCallback((
    cardToPlay: SnsCard,
    actionType: 'drop' | 'capture' | 'build',
    targetCard?: SnsCard | null,
    buildType?: 'soft-build' | 'hard-build' | null
  ) => {
    if (isOnline && socketRef.current && gameId) {
      console.log(`Emitting snsPlayCard: ${actionType} with ${cardToPlay.id}`);
      socketRef.current.emit('snsPlayCard', {
        gameId,
        playerId: socketRef.current.id,
        cardToPlay,
        actionType,
        targetCard,
        buildType,
        selectedMiddleItems: selectedMiddleCards,
      });
    } else {
      // Offline logic (mostly moved to server for online)
      const currentPlayerState = players.find(p => p.id === currentPlayerId);
      if (!currentPlayerState) {
        console.error('Current player state not found for offline play.');
        return;
      }

      // Enforce "Must Capture" rule for offline AI
      if (currentPlayerState.mustCapture) {
        if (actionType === 'capture') {
          console.log(`${currentPlayerId} is fulfilling 'Must Capture' rule with a capture.`);
        } else if (actionType === 'build' && targetCard && currentPlayerState.lastBuildValue !== null) {
          const newBuildValue = getRankValue(targetCard.rank);
          if (newBuildValue === currentPlayerState.lastBuildValue) {
            console.log(`${currentPlayerId} is fulfilling 'Must Capture' exception by building same value (${newBuildValue}).`);
          } else {
            console.log(`Invalid move: ${currentPlayerId} must capture or build same value (${currentPlayerState.lastBuildValue}) after a build. Tried to build ${newBuildValue}.`);
            return;
          }
        } else {
          console.log(`Invalid move: ${currentPlayerId} must capture after a build. Tried to ${actionType}.`);
          return;
        }
      }

      setPlayers(prevPlayers => {
        const updatedPlayers = prevPlayers.map(p => {
          if (p.id === currentPlayerId) {
            const updatedHand = p.hand.filter(c => c.id !== cardToPlay.id);
            let updatedCollected = [...p.collectedCards];
            let updatedMustCapture = p.mustCapture;
            let updatedLastBuildValue = p.lastBuildValue;
            let updatedJustMadeBuild = false;

            if (actionType === 'drop') {
              setMiddleCards(prevMiddle => [...prevMiddle, cardToPlay]);
              console.log(`${currentPlayerId} drops ${cardToPlay.rank}${cardToPlay.suit}`);
              updatedMustCapture = false;
              updatedLastBuildValue = null;
            } else if (actionType === 'capture') {
              if (!checkValidCapture(cardToPlay, selectedMiddleCards)) {
                console.log("Invalid capture: Selected middle cards do not sum up to the played card's value.");
                return p; // Return original player state if invalid
              }
              const capturedIndividualCards = getIndividualCardsFromSelection(selectedMiddleCards);
              updatedCollected = [...updatedCollected, cardToPlay, ...capturedIndividualCards];
              setMiddleCards(prevMiddle => prevMiddle.filter(item => !selectedMiddleCards.some(selectedItem => selectedItem.id === item.id)));
              setLastCapturePlayerId(currentPlayerId);
              updatedMustCapture = false;
              updatedLastBuildValue = null;
            } else if (actionType === 'build' && targetCard) {
              if (buildType === 'soft-build') {
                const isBuildingOnHardBuildForSoft = selectedMiddleCards.some(item => 'isHard' in item && item.isHard);
                if (isBuildingOnHardBuildForSoft) {
                  console.log("Invalid soft build: Cannot soft build on a hard build.");
                  return p;
                }
                if (!checkValidSoftBuild(cardToPlay, targetCard, selectedMiddleCards)) {
                  console.log("Invalid soft build: Selected cards do not sum up to the target value.");
                  return p;
                }
                const newBuild: SnsBuild = {
                  id: `BUILD-${targetCard.id}-${Date.now()}`,
                  cards: [cardToPlay, ...getIndividualCardsFromSelection(selectedMiddleCards)],
                  totalValue: getRankValue(targetCard.rank),
                  ownerId: currentPlayerId,
                  isHard: false,
                };
                setMiddleCards(prevMiddle => prevMiddle.filter(item => !selectedMiddleCards.some(selectedItem => selectedItem.id === item.id)));
                setMiddleCards(prevMiddle => [...prevMiddle, newBuild]);
                updatedMustCapture = true;
                updatedLastBuildValue = newBuild.totalValue;
                updatedJustMadeBuild = true;
              } else if (buildType === 'hard-build') {
                const selectedHardBuilds = selectedMiddleCards.filter((item): item is SnsBuild => 'isHard' in item && item.isHard);
                const targetValue = getRankValue(targetCard.rank);
                if (selectedHardBuilds.length > 0) {
                  const allHardBuildsMatchTarget = selectedHardBuilds.every(build => build.totalValue === targetValue);
                  if (!allHardBuildsMatchTarget) {
                    console.log("Invalid hard build: When building on existing hard builds, the new build's value must match the existing hard build's value.");
                    return p;
                  }
                }
                const validHardBuilds = checkValidHardBuild(cardToPlay, targetCard, selectedMiddleCards);
                if (!validHardBuilds) {
                  console.log("Invalid hard build: Selected cards do not form multiple builds for the target value.");
                  return p;
                }
                const hardBuildGroupId = `HARDBUILDGROUP-${Date.now()}`;
                const newBuilds: SnsBuild[] = validHardBuilds.map((buildCards, index) => ({
                  id: `HARDBUILD-${targetCard.id}-${Date.now()}-${index}`,
                  cards: buildCards,
                  totalValue: targetValue,
                  ownerId: currentPlayerId,
                  isHard: true,
                  hardBuildGroupId: hardBuildGroupId,
                }));
                const allCardsInNewBuilds = new Set<string>();
                newBuilds.forEach(build => {
                  build.cards.forEach(card => allCardsInNewBuilds.add(card.id));
                });
                setMiddleCards(prevMiddle => prevMiddle.filter(item => {
                  if ('id' in item && allCardsInNewBuilds.has(item.id)) return false;
                  if ('cards' in item && selectedMiddleCards.some(selectedItem => selectedItem.id === item.id)) return false;
                  return true;
                }));
                setMiddleCards(prevMiddle => [...prevMiddle, ...newBuilds]);
                updatedMustCapture = true;
                updatedLastBuildValue = targetValue;
                updatedJustMadeBuild = true;
              }
            }
            return { ...p, hand: updatedHand, collectedCards: updatedCollected, mustCapture: updatedMustCapture, lastBuildValue: updatedLastBuildValue, justMadeBuild: updatedJustMadeBuild };
          }
          return p;
        });

        // Update opponent's mustCapture if a capture happened
        if (actionType === 'capture') {
          const opponentId = currentPlayerId === 'player' ? 'ai' : 'player';
          return updatedPlayers.map(p => {
            if (p.id === opponentId) {
              return { ...p, mustCapture: false, lastBuildValue: null, justMadeBuild: false };
            }
            return p;
          });
        }
        return updatedPlayers;
      });

      // Check for game end in offline mode
      const player1 = players.find(p => p.id === 'player');
      const player2 = players.find(p => p.id === 'ai');
      if (player1?.hand.length === 0 && player2?.hand.length === 0) {
        // This is where dealNewHands or game over logic would be.
        // For now, let's assume the game ends.
        setGamePhase('gameOver');
        setGameEnded(true);
        // Calculate scores for offline mode
        const player1Collected = players.find(p => p.id === 'player')?.collectedCards || [];
        const player2Collected = players.find(p => p.id === 'ai')?.collectedCards || [];
        
        const calculatePlayerPoints = (collectedCards: SnsCard[]): number => {
          let points = 0;
          collectedCards.forEach(card => {
            if (card.rank === 'A') points += 1;
            if (card.rank === '2' && card.suit === 'S') points += 1;
            if (card.rank === 'T' && card.suit === 'D') points += 2;
          });
          return points;
        };

        let p1Score = calculatePlayerPoints(player1Collected);
        let p2Score = calculatePlayerPoints(player2Collected);

        const p1Spades = player1Collected.filter(card => card.suit === 'S').length;
        const p2Spades = player2Collected.filter(card => card.suit === 'S').length;
        if (p1Spades > p2Spades) p1Score += 1;
        else if (p2Spades > p1Spades) p2Score += 1;

        const p1TotalCards = player1Collected.length;
        const p2TotalCards = player2Collected.length;
        if (p1TotalCards > p2TotalCards) p1Score += 3;
        else if (p2TotalCards > p1TotalCards) p2Score += 3;

        let winner: 'player' | 'ai' | 'draw' | null = null;
        if (p1Score > p2Score) winner = 'player';
        else if (p2Score > p1Score) winner = 'ai';
        else winner = 'draw';

        setGameResult({ winner, playerScore: p1Score, aiScore: p2Score });

        // Last player who captured gets middle cards
        if (lastCapturePlayerId) {
          const remainingMiddleCards = getIndividualCardsFromSelection(middleCards);
          setPlayers(prevPlayers => prevPlayers.map(p => {
            if (p.id === lastCapturePlayerId) {
              return { ...p, collectedCards: [...p.collectedCards, ...remainingMiddleCards] };
            }
            return p;
          }));
          setMiddleCards([]); // Clear middle cards
        }
      }

      setSelectedMiddleCards([]);
      setSelectedPlayerCard(null);
      setCurrentPlayerId(prev => (prev === 'player' ? 'ai' : 'player'));
    }
  }, [isOnline, gameId, selectedMiddleCards, players, currentPlayerId, checkValidCapture, checkValidSoftBuild, checkValidHardBuild, getIndividualCardsFromSelection, lastCapturePlayerId]);


  return {
    clientPlayerId: socketRef.current?.id || null, // Expose the client's actual socket ID
    gameId,
    players,
    currentPlayerId,
    middleCards,
    deckSize,
    lastCapturePlayerId,
    gameEnded,
    gameResult,
    gamePhase,
    isGameInitialized,
    playerMustCapture,
    playerLastBuildValue,
    playerJustMadeBuild,
    selectedMiddleCards,
    setSelectedMiddleCards,
    selectedPlayerCard,
    setSelectedPlayerCard,
    turnTimerEndsAt,
    messages,
    errors,
    initializeGame,
    resetGame,
    playCard,
    toggleMiddleCardSelection,
    checkValidCapture,
    checkValidSoftBuild,
    checkValidHardBuild,
    cancelMatchmaking, // Add cancelMatchmaking to the returned object
  };
};

export default useSetAndSeizeGameLogic;

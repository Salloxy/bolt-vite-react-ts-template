import { useState, useEffect, useCallback } from 'react';
import { SnsCard, SnsSuit, SnsRank, SnsBuild } from '../types';
import { getRankValue } from '../lib/utils'; // Import getRankValue

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
  const [playerMustCapture, setPlayerMustCapture] = useState(false);
  const [aiMustCapture, setAiMustCapture] = useState(false);
  const [playerLastBuildValue, setPlayerLastBuildValue] = useState<number | null>(null);
  const [aiLastBuildValue, setAiLastBuildValue] = useState<number | null>(null);
  const [lastCapturePlayerId, setLastCapturePlayerId] = useState<'player' | 'ai' | null>(null);
  const [hasPlayedCardThisTurn, setHasPlayedCardThisTurn] = useState(false);
  const [selectedMiddleCards, setSelectedMiddleCards] = useState<(SnsCard | SnsBuild)[]>([]); // New state for selected middle cards
  const [playerJustMadeBuild, setPlayerJustMadeBuild] = useState(false);
  const [aiJustMadeBuild, setAiJustMadeBuild] = useState(false);

  const toggleMiddleCardSelection = useCallback((item: SnsCard | SnsBuild) => {
    setSelectedMiddleCards(prev => {
      // If the clicked item is a hard build
      if ('isHard' in item && item.isHard && item.hardBuildGroupId) {
        const groupMembers = middleCards.filter(
          (mItem): mItem is SnsBuild =>
            'isHard' in mItem && mItem.isHard && mItem.hardBuildGroupId === item.hardBuildGroupId
        );

        const isGroupCurrentlySelected = groupMembers.every(member =>
          prev.some(pItem => pItem.id === member.id)
        );

        if (isGroupCurrentlySelected) {
          // If the entire group is selected, deselect all members of the group
          return prev.filter(pItem => !groupMembers.some(member => member.id === pItem.id));
        } else {
          // If the group is not fully selected, select all members of the group
          const newSelection = new Set(prev.map(c => c.id));
          groupMembers.forEach(member => newSelection.add(member.id));
          
          // Reconstruct the array from middleCards to maintain order and original objects
          return middleCards.filter(mItem => newSelection.has(mItem.id));
        }
      } else {
        // Normal card or soft build selection
        return prev.some(c => c.id === item.id)
          ? prev.filter(c => c.id !== item.id)
          : [...prev, item];
      }
    });
  }, [middleCards]); // middleCards is a dependency now

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
    setPlayerMustCapture(false); // Reset player's mustCapture
    setAiMustCapture(false);     // Reset AI's mustCapture
    setPlayerLastBuildValue(null); // Reset player's lastBuildValue
    setAiLastBuildValue(null);     // Reset AI's lastBuildValue
    setLastCapturePlayerId(null);
    setHasPlayedCardThisTurn(false);
  }, []);

  useEffect(() => {
    initializeGame();
  }, [initializeGame]);

  const endTurn = useCallback(() => {
    setCurrentPlayer(prev => {
      // Check if the previous player (who just finished their turn) had just made a build
      // The playerJustMadeBuild flag indicates if the player *just* made a build on this turn.
      // If they did NOT make a build this turn, and they were previously under the mustCapture rule,
      // then the mustCapture rule ends.
      if (prev === 'player') {
        if (!playerJustMadeBuild && playerMustCapture) { // If no build was made this turn, and mustCapture was active
          setPlayerMustCapture(false);
          setPlayerLastBuildValue(null);
        }
        setPlayerJustMadeBuild(false); // Reset for the next turn
      } else if (prev === 'ai') {
        if (!aiJustMadeBuild && aiMustCapture) { // If no build was made this turn, and mustCapture was active
          setAiMustCapture(false);
          setAiLastBuildValue(null);
        }
        setAiJustMadeBuild(false); // Reset for the next turn
      }

      setHasPlayedCardThisTurn(false); // Reset for the next player's turn
      return prev === 'player' ? 'ai' : 'player';
    });
  }, [playerJustMadeBuild, aiJustMadeBuild, setPlayerMustCapture, setPlayerLastBuildValue, setPlayerJustMadeBuild, setAiMustCapture, setAiLastBuildValue, setAiJustMadeBuild]);

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
    const handCardPossibleValues = getCardPossibleValues(handCard); // Re-added this declaration here.

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
    targetCard?: SnsCard | null, // Optional for build action
    buildType?: 'soft-build' | 'hard-build' | null // Optional for build action
  ) => {
    if (hasPlayedCardThisTurn) {
      console.log(`${currentPlayer} has already played a card this turn.`);
      return;
    }

    // Determine current player's mustCapture and lastBuildValue states
    const currentMustCapture = currentPlayer === 'player' ? playerMustCapture : aiMustCapture;
    const currentLastBuildValue = currentPlayer === 'player' ? playerLastBuildValue : aiLastBuildValue;
    const setPlayerMustCaptureState = currentPlayer === 'player' ? setPlayerMustCapture : setAiMustCapture;
    const setPlayerLastBuildValueState = currentPlayer === 'player' ? setPlayerLastBuildValue : setAiLastBuildValue;


    // Enforce "Must Capture" rule
    if (currentMustCapture) {
      if (actionType === 'capture') {
        // Allowed to capture
        console.log(`${currentPlayer} is fulfilling 'Must Capture' rule with a capture.`);
      } else if (actionType === 'build' && targetCard && currentLastBuildValue !== null) {
        const newBuildValue = getRankValue(targetCard.rank);
        if (newBuildValue === currentLastBuildValue) {
          // Exception: Allowed to build if the new build value matches the last build value
          console.log(`${currentPlayer} is fulfilling 'Must Capture' exception by building same value (${newBuildValue}).`);
        } else {
          console.log(`Invalid move: ${currentPlayer} must capture or build same value (${currentLastBuildValue}) after a build. Tried to build ${newBuildValue}.`);
          setSelectedMiddleCards([]); // Clear selected middle cards
          return; // Stop the function execution
        }
      } else {
        console.log(`Invalid move: ${currentPlayer} must capture after a build. Tried to ${actionType}.`);
        setSelectedMiddleCards([]); // Clear selected middle cards
        return; // Stop the function execution
      }
    }

    if (actionType === 'drop') {
      setMiddleCards(prevMiddleCards => [...prevMiddleCards, cardToPlay]);
      console.log(`${currentPlayer} drops ${cardToPlay.rank}${cardToPlay.suit}`);
      setPlayerMustCaptureState(false);
      setPlayerLastBuildValueState(null);
      if (currentPlayer === 'player') {
        setPlayerJustMadeBuild(false); // Dropping a card ends the "just made build" state
      } else {
        setAiJustMadeBuild(false);
      }
    } else if (actionType === 'capture') {
      if (!checkValidCapture(cardToPlay, selectedMiddleCards)) {
        console.log("Invalid capture: Selected middle cards do not sum up to the played card's value.");
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
      setPlayerMustCaptureState(false); // Capture was performed, reset mustCapture for current player
      setPlayerLastBuildValueState(null); // Reset lastBuildValue for current player after capture
      setSelectedMiddleCards([]); // Clear selected middle cards after capture
      // If a capture happened, the mustCapture rule ends for the *other* player if they had it.
      if (currentPlayer === 'player') {
        setAiMustCapture(false);
        setAiLastBuildValue(null);
        setAiJustMadeBuild(false);
      } else {
        setPlayerMustCapture(false);
        setPlayerLastBuildValue(null);
        setPlayerJustMadeBuild(false); // Capturing ends the "just made build" state for the player
      }
    } else if (actionType === 'build' && targetCard) {
      if (buildType === 'soft-build') {
        // Check if any selected middle card is a hard build, which cannot be built upon by a soft build
        const isBuildingOnHardBuildForSoft = selectedMiddleCards.some(item => 'isHard' in item && item.isHard);
        if (isBuildingOnHardBuildForSoft) {
          console.log("Invalid soft build: Cannot soft build on a hard build.");
          setSelectedMiddleCards([]);
          return;
        }

        if (!checkValidSoftBuild(cardToPlay, targetCard, selectedMiddleCards)) {
          console.log("Invalid soft build: Selected cards do not sum up to the target value.");
          setSelectedMiddleCards([]);
          return;
        }
        console.log(`${currentPlayer} performs a soft build with ${cardToPlay.rank}${cardToPlay.suit} onto`, selectedMiddleCards, `to target ${targetCard.rank}${targetCard.suit}`);

        // Create a new SnsBuild object
        const newBuild: SnsBuild = {
          id: `BUILD-${targetCard.id}-${Date.now()}`, // Unique ID for the build
          cards: [cardToPlay, ...getIndividualCardsFromSelection(selectedMiddleCards)], // All cards in the pile, flattened
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

        setPlayerMustCaptureState(true); // A build always results in a capture opportunity for current player
        setPlayerLastBuildValueState(newBuild.totalValue); // Store the value of the new build for current player
        setSelectedMiddleCards([]); // Clear selected middle cards after build
        if (currentPlayer === 'player') {
          setPlayerJustMadeBuild(true);
        } else {
          setAiJustMadeBuild(true);
        }
      } // Closing brace for if (buildType === 'soft-build')
      
      // This else if should be a sibling to the soft-build if, not nested inside it.
      else if (buildType === 'hard-build') {
        // Check if any selected middle card is a hard build
        const selectedHardBuilds = selectedMiddleCards.filter((item): item is SnsBuild => 'isHard' in item && item.isHard);
        const targetValue = getRankValue(targetCard.rank);

        // If hard builds are selected, ensure their values match the target value
        if (selectedHardBuilds.length > 0) {
          const allHardBuildsMatchTarget = selectedHardBuilds.every(build => build.totalValue === targetValue);
          if (!allHardBuildsMatchTarget) {
            console.log("Invalid hard build: When building on existing hard builds, the new build's value must match the existing hard build's value.");
            setSelectedMiddleCards([]);
            return;
          }
        }

        const validHardBuilds = checkValidHardBuild(cardToPlay, targetCard, selectedMiddleCards);

        if (!validHardBuilds) {
          console.log("Invalid hard build: Selected cards do not form multiple builds for the target value.");
          setSelectedMiddleCards([]); // Clear selected middle cards
          return; // Stop the function execution
        }
        console.log(`${currentPlayer} performs a hard build with ${cardToPlay.rank}${cardToPlay.suit} and selected cards:`, selectedMiddleCards, `to target ${targetCard.rank}${targetCard.suit}`);

        // Check if any selected hard builds belonged to the opponent
        const opponent = currentPlayer === 'player' ? 'ai' : 'player';
        const setOpponentMustCaptureState = opponent === 'player' ? setPlayerMustCapture : setAiMustCapture;
        const setOpponentLastBuildValueState = opponent === 'player' ? setPlayerLastBuildValue : setAiLastBuildValue;
        const setOpponentJustMadeBuildState = opponent === 'player' ? setPlayerJustMadeBuild : setAiJustMadeBuild;

        selectedMiddleCards.forEach(item => {
          if ('isHard' in item && item.isHard && item.ownerId === opponent) {
            console.log(`Opponent's (${opponent}) hard build (${item.id}) was stack built. Resetting their mustCapture state.`);
            setOpponentMustCaptureState(false);
            setOpponentLastBuildValueState(null);
            setOpponentJustMadeBuildState(false);
          }
        });

        const hardBuildGroupId = `HARDBUILDGROUP-${Date.now()}`; // Unique ID for this group of hard builds

        const newBuilds: SnsBuild[] = validHardBuilds.map((buildCards, index) => ({
          id: `HARDBUILD-${targetCard.id}-${Date.now()}-${index}`, // Unique ID for each individual build within the group
          cards: buildCards, // Cards in this specific build
          totalValue: getRankValue(targetCard.rank), // The target value
          ownerId: currentPlayer, // The player who created this build
          isHard: true, // This is a hard build
          hardBuildGroupId: hardBuildGroupId, // Assign the common group ID
        }));

        // Collect all individual cards that were part of the new hard builds
        const allCardsInNewBuilds = new Set<string>();
        newBuilds.forEach(build => {
          build.cards.forEach(card => allCardsInNewBuilds.add(card.id));
        });

        // Remove selected middle cards from the middle and the played card
        setMiddleCards(prev => prev.filter(item => {
          // Filter out individual cards that are now part of the new builds
          if ('id' in item && allCardsInNewBuilds.has(item.id)) {
            return false;
          }
          // Also filter out any existing builds that were part of selectedMiddleCards
          // (though getIndividualCardsFromSelection already flattens them, this is a safeguard)
          if ('cards' in item && selectedMiddleCards.some(selectedItem => selectedItem.id === item.id)) {
            return false;
          }
          return true;
        }));
        
        // Add the new built piles to the middle
        setMiddleCards(prev => [...prev, ...newBuilds]);

        setPlayerMustCaptureState(true); // A build always results in a capture opportunity for current player
        setPlayerLastBuildValueState(getRankValue(targetCard.rank)); // Store the value of the new hard build for current player
        setSelectedMiddleCards([]); // Clear selected middle cards after build
        if (currentPlayer === 'player') {
          setPlayerJustMadeBuild(true);
        } else {
          setAiJustMadeBuild(true);
        }
      } // Closing brace for else if (buildType === 'hard-build')
    } // Closing brace for else if (actionType === 'build' && targetCard)

    // Remove card from hand after all validations and actions are complete
    if (currentPlayer === 'player') {
      setPlayerHand(prev => prev.filter(c => c.id !== cardToPlay.id));
    } else {
      setAiHand(prev => prev.filter(c => c.id !== cardToPlay.id));
    }

    setHasPlayedCardThisTurn(true);
    endTurn();
  }, [currentPlayer, endTurn, hasPlayedCardThisTurn, selectedMiddleCards, checkValidCapture, checkValidSoftBuild, checkValidHardBuild, playerMustCapture, aiMustCapture, playerLastBuildValue, aiLastBuildValue, getIndividualCardsFromSelection, setPlayerMustCapture, setAiMustCapture, setPlayerLastBuildValue, setAiLastBuildValue, setPlayerJustMadeBuild, setAiJustMadeBuild]);

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
    playerMustCapture, // Expose playerMustCapture
    aiMustCapture,     // Expose aiMustCapture
    selectedMiddleCards, // Expose selected middle cards
    setSelectedMiddleCards, // Expose the setter for selectedMiddleCards
    initializeGame,
    playCard,
    toggleMiddleCardSelection, // Expose toggle function
    hasPlayedCardThisTurn,
    checkValidCapture, // Expose checkValidCapture
    checkValidSoftBuild, // Expose checkValidSoftBuild
    checkValidHardBuild, // Expose checkValidHardBuild
    playerJustMadeBuild, // Expose playerJustMadeBuild
    aiJustMadeBuild,     // Expose aiJustMadeBuild
    // Add other game state and actions as needed
  };
};

export default useSetAndSeizeGameLogic;

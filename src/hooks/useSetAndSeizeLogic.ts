import { useState, useEffect, useCallback } from 'react';
import { SnsCard, SnsGameState, SnsPlayer, SnsRank, SnsSuit, SnsBuild, GameMessage } from '../types';
import { v4 as uuidv4 } from 'uuid';

const SUITS: SnsSuit[] = ['H', 'D', 'C', 'S'];
const RANKS: SnsRank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

const getCardValue = (rank: SnsRank, aceValue?: 1 | 14): number => {
  if (rank === 'A') return aceValue || 1; 
  if (rank === 'K') return 13;
  if (rank === 'Q') return 12;
  if (rank === 'J') return 11;
  if (rank === 'T') return 10;
  return parseInt(rank, 10);
};

const createDeck = (): SnsCard[] => {
  const deck: SnsCard[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        suit,
        rank,
        id: `${rank}${suit}`,
        value: getCardValue(rank), 
        isAce: rank === 'A',
      });
    }
  }
  return deck;
};

const shuffleDeck = (deck: SnsCard[]): SnsCard[] => {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const initialPlayerState = (id: string): SnsPlayer => ({
  id,
  hand: [],
  capturedPile: [],
  score: 0,
  activeBuilds: [],
});

export type ActionType = 'drop' | 'capture' | 'build';
export interface ActionDetails {
  actionType: ActionType;
  playedCardId: string;
  aceValueChoice?: 1 | 14;
  selectedMiddleCardIdsForCapture?: string[];
  selectedMiddleCardIdsForBuild?: string[]; // For the primary build involving the played card
  additionalSelectedMiddleCardGroupsForBuild?: string[][]; // For additional builds from middle only
  buildTargetValue?: number;
  isHardBuild?: boolean; // Applies to the primary build
  cardToPairForHardBuildId?: string; // Applies to the primary build
  buildToStackOnId?: string; // Applies to the primary build
}

const useSetAndSeizeLogic = () => {
  const [gameMessages, setGameMessages] = useState<GameMessage[]>([]);
  const [gameState, setGameState] = useState<SnsGameState>(() => {
    const initialDeck = shuffleDeck(createDeck());
    return {
      deck: initialDeck,
      middleCards: [],
      players: {
        player1: initialPlayerState('player1'),
        player2: initialPlayerState('player2'),
      },
      currentPlayerId: 'player1',
      gamePhase: 'dealing',
      roundOver: false,
      lastCapturePlayerId: null,
      mustCaptureBuildId: null,
      winnerMessage: undefined,
    };
  });

  const addGameMessage = useCallback((text: string, type: GameMessage['type']) => {
    setGameMessages(prevMessages => {
      const newMessage: GameMessage = {
        id: uuidv4(),
        text,
        type,
        timestamp: Date.now(),
      };
      const updatedMessages = [...prevMessages, newMessage];
      if (updatedMessages.length > 20) {
        return updatedMessages.slice(updatedMessages.length - 20);
      }
      return updatedMessages;
    });
  }, []);
  
  const getSumOfCards = (cards: SnsCard[]): number => {
    return cards.reduce((acc, card) => acc + card.value, 0); // Assumes card.value is correctly set for Aces
  };

  const doCardsSumToTarget = (cardsToCheck: SnsCard[], targetValue: number): boolean => {
    if (!cardsToCheck || cardsToCheck.length === 0) return false;
    return getSumOfCards(cardsToCheck) === targetValue;
  };
  
  const findAllSumCombinations = (cards: SnsCard[], target: number): SnsCard[][] => {
    const result: SnsCard[][] = [];
    const findCombinationsRecursive = (startIndex: number, currentSum: number, currentCombination: SnsCard[]) => {
      if (currentSum === target) {
        if (currentCombination.length > 0) result.push([...currentCombination]);
      }
      if (currentSum >= target && target !==0 ) { 
          if(currentSum === target && currentCombination.length > 0) { /* already handled */ }
          else return;
      }
      if (startIndex >= cards.length) return;

      for (let i = startIndex; i < cards.length; i++) {
        const card = cards[i];
        currentCombination.push(card);
        findCombinationsRecursive(i + 1, currentSum + card.value, currentCombination);
        currentCombination.pop();
      }
    };
    findCombinationsRecursive(0, 0, []);
    return result;
  };
  
  const generateBuildId = (): string => uuidv4();

  const canPlayerMakeAnyCapture = (
    playerHand: SnsCard[], 
    middleCards: SnsCard[], 
    allBuilds: SnsBuild[]
  ): boolean => {
    for (const handCard of playerHand) {
      const potentialValuesToPlay = handCard.isAce ? [1, 14] : [getCardValue(handCard.rank)];
      for (const val of potentialValuesToPlay) {
        const tempPlayedCardValue = val;
        
        const looseCombos = findAllSumCombinations(middleCards, tempPlayedCardValue);
        if (looseCombos.length > 0) return true;

        for (const build of allBuilds) {
          if (build.totalValue === tempPlayedCardValue) return true;
        }
      }
    }
    return false;
  };

  const dealCards = useCallback(() => {
    setGameState(prev => {
      if (prev.gamePhase !== 'dealing' && !prev.roundOver) return prev;
      const newDeck = [...prev.deck];
      const newPlayers = JSON.parse(JSON.stringify(prev.players)) as { [key: string]: SnsPlayer };
      let newMiddleCards = [...prev.middleCards];
      const cardsToDealPerPlayer = 4;
      const cardsToDealToMiddle = prev.gamePhase === 'dealing' ? 4 : 0;

      if (newDeck.length < (cardsToDealPerPlayer * Object.keys(newPlayers).length) + cardsToDealToMiddle) {
        return { ...prev, gamePhase: 'scoring' };
      }

      if (prev.gamePhase === 'dealing') {
        for (let i = 0; i < cardsToDealToMiddle; i++) {
          const card = newDeck.pop();
          if (card) newMiddleCards.push(card);
        }
      }
      for (const playerId in newPlayers) {
        newPlayers[playerId].hand = [];
        for (let i = 0; i < cardsToDealPerPlayer; i++) {
          const card = newDeck.pop();
          if (card) newPlayers[playerId].hand.push(card);
        }
      }
      return {
        ...prev, deck: newDeck, players: newPlayers, middleCards: newMiddleCards,
        gamePhase: 'playing', roundOver: false, currentPlayerId: prev.currentPlayerId || 'player1',
      };
    });
  }, []);

  useEffect(() => {
    if (gameState.gamePhase === 'dealing') dealCards();
  }, [gameState.gamePhase, dealCards]);

  const playCard = useCallback((playerId: string, details: ActionDetails) => {
    setGameState(prev => {
      if (prev.currentPlayerId !== playerId || prev.gamePhase !== 'playing') {
        addGameMessage(`Turn/Phase Error. Current: ${prev.currentPlayerId}, Tried: ${playerId}, Phase: ${prev.gamePhase}`, 'error');
        return prev;
      }
      const player = prev.players[playerId];
      let cardToPlay = player.hand.find(c => c.id === details.playedCardId);
      if (!cardToPlay) {
        addGameMessage(`Card ${details.playedCardId} not in hand. Hand: ${player.hand.map(c=>c.id).join(', ')}`, 'error');
        return prev;
      }
      
      cardToPlay = { ...cardToPlay }; 
      if (cardToPlay.isAce && details.aceValueChoice) {
        cardToPlay.value = details.aceValueChoice;
      } else if (!cardToPlay.isAce) { 
        cardToPlay.value = getCardValue(cardToPlay.rank);
      } else if (cardToPlay.isAce && !details.aceValueChoice) { 
        cardToPlay.value = 1; 
      }

      let newMiddleCards = [...prev.middleCards];
      let newPlayerHand = player.hand.filter(c => c.id !== details.playedCardId);
      let newCapturedPile = [...player.capturedPile];
      let newPlayerActiveBuilds = [...player.activeBuilds];
      const allBuildsFromPreviousState = Object.values(prev.players).reduce((acc, pVal) => acc.concat(pVal.activeBuilds), [] as SnsBuild[]);
      let playersCopy = JSON.parse(JSON.stringify(prev.players)) as { [key: string]: SnsPlayer };
      let currentMustCaptureId = prev.mustCaptureBuildId; 
      let lastCaptureBy = prev.lastCapturePlayerId;
      
      // --- Start of Must Capture Rule Enforcement ---
      // Check if the current player is under an obligation for a build they own.
      const obligatedBuild = prev.mustCaptureBuildId
        ? allBuildsFromPreviousState.find(b => b.id === prev.mustCaptureBuildId && b.ownerId === playerId)
        : null;

      if (obligatedBuild) { // Player is under obligation for one of THEIR builds
        const canMakeAnyCaptureAtAll = canPlayerMakeAnyCapture(player.hand, prev.middleCards, allBuildsFromPreviousState);

        if (details.actionType === 'drop') {
          if (canMakeAnyCaptureAtAll) {
            addGameMessage(`Must Capture Rule: You must attempt a capture or build a same-value build (value ${obligatedBuild.totalValue}). Dropping is not allowed.`, 'error');
            return prev;
          }
        } else if (details.actionType === 'build') {
          // Player is attempting to make a new build (either primary, or stacking on opponent's build).
          // Stacking on their own build is disallowed elsewhere.
          // Exception: Allowed to build if the new build's value matches the obligated build's value.
          const isNewBuildSameValueAsObligation = details.buildTargetValue === obligatedBuild.totalValue;

          if (!isNewBuildSameValueAsObligation && canMakeAnyCaptureAtAll) {
            addGameMessage(`Must Capture Rule: You must attempt a capture, or build a new build of value ${obligatedBuild.totalValue}. Building a different value (${details.buildTargetValue}) is not allowed when a capture is possible.`, 'error');
            return prev;
          }
          // If isNewBuildSameValueAsObligation is true, the build is allowed (exception met).
          // If canMakeAnyCaptureAtAll is false, any build is allowed (no capture to be forced over).
          // If the build is allowed, the mustCaptureBuildId will be updated to the new build's ID later if it's a primary/stacking build.
        }
        // If actionType is 'capture', it's always a valid attempt under the must-capture rule.
      }
      // --- End of Must Capture Rule Enforcement ---

      if (details.actionType === 'drop') {
        newMiddleCards.push(cardToPlay);
        addGameMessage(`${playerId} dropped ${cardToPlay.id}.`, 'action');
      } else if (details.actionType === 'capture') {
        const playedValue = cardToPlay.value;
        let capturedCardIdsFromTable: string[] = [];
        let tempMiddleCards = [...newMiddleCards]; // Operate on a temporary copy for finding combinations

        // 1. Capture all matching builds
        let capturedBuildInfoText = "";
        const buildsToProcess = [...allBuildsFromPreviousState]; // All builds on table
        
        buildsToProcess.forEach(build => {
            if (build.totalValue === playedValue) {
                const buildCardIds = build.cards.map(c => c.id);
                capturedCardIdsFromTable.push(...buildCardIds.filter(id => !capturedCardIdsFromTable.includes(id)));
                
                // Remove build from its owner
                for (const ownerId in playersCopy) {
                    playersCopy[ownerId].activeBuilds = playersCopy[ownerId].activeBuilds.filter(b => b.id !== build.id);
                }
                capturedBuildInfoText += ` Captured build ${build.id} (owner: ${build.ownerId}, value: ${build.totalValue}).`;
                if (build.id === prev.mustCaptureBuildId) {
                    currentMustCaptureId = null;
                }
            }
        });
        if (capturedBuildInfoText) addGameMessage(capturedBuildInfoText.trim(), 'action');
        
        // Update tempMiddleCards to reflect captured builds' cards being removed from consideration for loose captures
        tempMiddleCards = tempMiddleCards.filter(mc => !capturedCardIdsFromTable.includes(mc.id));

        // 2. Capture all valid combinations from remaining loose middle cards
        // The findAllSumCombinations function returns arrays of cards. We need to collect all unique card IDs.
        // This needs to be iterative: find one combo, remove its cards, find next combo from remaining, etc.
        // Or, find all combos on current tempMiddle, then take union of all cards in those combos.
        
        let foundLooseCombos = true; // Flag to keep searching for combos
        while(foundLooseCombos) {
            const allPossibleLooseCombinations = findAllSumCombinations(tempMiddleCards, playedValue);
            if (allPossibleLooseCombinations.length > 0) {
                // Greedily take all cards from all found combinations for this pass
                let idsFromThisPass: string[] = [];
                allPossibleLooseCombinations.forEach(combo => {
                    combo.forEach(card => {
                        if (!idsFromThisPass.includes(card.id)) {
                            idsFromThisPass.push(card.id);
                        }
                    });
                });

                if (idsFromThisPass.length > 0) {
                    capturedCardIdsFromTable.push(...idsFromThisPass.filter(id => !capturedCardIdsFromTable.includes(id)));
                    tempMiddleCards = tempMiddleCards.filter(mc => !idsFromThisPass.includes(mc.id)); // Remove for next iteration
                    // No need to set foundLooseCombos = true, loop continues if combos were found
                } else {
                    foundLooseCombos = false; // No new cards found in this pass's combos
                }
            } else {
                foundLooseCombos = false; // No more combinations can be found
            }
        }

        if (capturedCardIdsFromTable.length === 0) {
          addGameMessage(`Invalid capture: No builds or card combinations on the table sum to ${playedValue}.`, 'error');
          return prev; // Nothing was captured
        }

        const actualCardsTakenObjects = newMiddleCards.filter(mc => capturedCardIdsFromTable.includes(mc.id));
        newCapturedPile.push(cardToPlay, ...actualCardsTakenObjects);
        
        const displayCapturedIds = actualCardsTakenObjects.map(c => c.id).join(', ');
        addGameMessage(`${playerId} captured ${displayCapturedIds || 'builds'} with ${cardToPlay.id} (value ${playedValue}).`, 'action');
        
        newMiddleCards = newMiddleCards.filter(mc => !capturedCardIdsFromTable.includes(mc.id));
        lastCaptureBy = playerId;
        newPlayerActiveBuilds = playersCopy[playerId].activeBuilds; // Reflects removed builds if any were player's own

      } else if (details.actionType === 'build') {
        if (!details.buildTargetValue) { addGameMessage("Build target value missing.", 'error'); return prev; }
        const buildCardsFromMiddleInput = newMiddleCards.filter(mc => details.selectedMiddleCardIdsForBuild?.includes(mc.id));
        
        const cardForMatchingBuildTotalInHand = newPlayerHand.find(c => {
          const cardValueInHand = getCardValue(c.rank, c.isAce ? (details.buildTargetValue === 14 ? 14 : 1) : undefined);
          return cardValueInHand === details.buildTargetValue;
        });
        
        if (details.buildToStackOnId) {
            const targetBuild = allBuildsFromPreviousState.find(b => b.id === details.buildToStackOnId);
            if (!targetBuild || targetBuild.ownerId === playerId || targetBuild.isHard) { addGameMessage("Invalid stack target.", 'error'); return prev; }
            if (!cardForMatchingBuildTotalInHand) { addGameMessage("Stacking: No card in hand matches new build total.", 'error'); return prev; }
            
            const sumOfAdditional = getSumOfCards(buildCardsFromMiddleInput);
            const newStackedTotal = targetBuild.totalValue + cardToPlay.value + sumOfAdditional;
            
            if (newStackedTotal !== details.buildTargetValue) { addGameMessage(`Stacking total/target mismatch. New: ${newStackedTotal}, Target: ${details.buildTargetValue}`, 'error'); return prev; }

            if (playersCopy[targetBuild.ownerId]) {
                playersCopy[targetBuild.ownerId].activeBuilds = playersCopy[targetBuild.ownerId].activeBuilds.filter(b => b.id !== targetBuild.id);
                // If the opponent (targetBuild.ownerId) was under a must-capture for this build,
                // and the current player (playerId) is stacking on it, the opponent's obligation is cleared.
                if (prev.mustCaptureBuildId === targetBuild.id && targetBuild.ownerId !== playerId) {
                    // Note: currentMustCaptureId will be set to the newBuild's ID for the current player later.
                    // We are clearing the *previous* global mustCaptureBuildId if it was the one being stacked upon by an opponent.
                    // This specific scenario (opponent stacking on your must-capture build) clears your obligation.
                    // The current player (stacker) will become obligated by their new build.
                    // If the global mustCaptureBuildId was for the current player, it will be overwritten by their new build anyway.
                    // If it was for the opponent, and current player stacks, it should be cleared.
                    // However, the current logic sets currentMustCaptureId to the *new* build for the *current* player.
                    // The rule implies the *opponent's* must-capture is cleared.
                    // Let's refine: if the stacked-upon build was the global `prev.mustCaptureBuildId`,
                    // and its owner is NOT the current player, then that `mustCaptureBuildId` should be cleared.
                    // The current player will then get a new `mustCaptureBuildId` for their new build.
                    if (prev.mustCaptureBuildId === targetBuild.id) {
                         currentMustCaptureId = null; // Clear the global one, new one for current player will be set below.
                         addGameMessage(`Player ${targetBuild.ownerId}'s must-capture obligation for build ${targetBuild.id} was cleared by ${playerId} stacking on it.`, 'info');
                    }
                }
            }
            const newBuild: SnsBuild = { id: generateBuildId(), cards: [...targetBuild.cards, cardToPlay, ...buildCardsFromMiddleInput], totalValue: newStackedTotal, ownerId: playerId, isHard: false };
            newPlayerActiveBuilds.push(newBuild);
            currentMustCaptureId = newBuild.id; // Current player is now obligated by this new build
            const buildInputIds = details.selectedMiddleCardIdsForBuild || [];
            newMiddleCards = newMiddleCards.filter(mc => !buildInputIds.includes(mc.id));
            addGameMessage(`${playerId} created new build ${newBuild.id} (value ${newStackedTotal}) by stacking.`, 'action');
        } else { // Regular new build
            if (!cardForMatchingBuildTotalInHand) { addGameMessage("No card in hand matches build target value.", 'error'); return prev; }

            let finalBuildValue = details.buildTargetValue;
            let buildConstituentCards: SnsCard[] = [];
            let isActuallyHard = details.isHardBuild || false;
            let successfullyMadeBuild = false;
            const middleInputIds = buildCardsFromMiddleInput.map(c => c.id);

            if (isActuallyHard) {
                if (details.cardToPairForHardBuildId) { // Hard build using a pairing card from hand
                    const pairingCardFromHand = newPlayerHand.find(c => c.id === details.cardToPairForHardBuildId);
                    if (!pairingCardFromHand) { 
                        addGameMessage("Hard build error: Pairing card from hand not found.", 'error'); 
                        return prev; 
                    }

                    const sumOfPlayedAndSelectedMiddle = cardToPlay.value + getSumOfCards(buildCardsFromMiddleInput);
                    const valueOfPairingCardFromHand = getCardValue(pairingCardFromHand.rank, pairingCardFromHand.isAce ? (finalBuildValue === 14 ? 14 : 1) : undefined);

                    if (sumOfPlayedAndSelectedMiddle === finalBuildValue && valueOfPairingCardFromHand === finalBuildValue) {
                        buildConstituentCards = [cardToPlay, ...buildCardsFromMiddleInput, pairingCardFromHand];
                        newPlayerHand = newPlayerHand.filter(c => c.id !== details.cardToPairForHardBuildId); // Remove pairing card from hand
                        newMiddleCards = newMiddleCards.filter(mc => !middleInputIds.includes(mc.id)); // Remove selected middle cards
                        successfullyMadeBuild = true;
                        addGameMessage(`Hard build: ${cardToPlay.id} + middle [${buildCardsFromMiddleInput.map(c=>c.id).join(',')}] (sum ${sumOfPlayedAndSelectedMiddle}) paired with ${pairingCardFromHand.id} from hand.`, 'info');
                    } else {
                        addGameMessage(`Hard build from hand failed: Sum of played/middle (${sumOfPlayedAndSelectedMiddle}) or pairing card value (${valueOfPairingCardFromHand}) does not match target (${finalBuildValue}).`, 'error');
                        isActuallyHard = false; // Downgrade to soft or fail
                    }
                } else { // Attempt hard build using middle cards (or direct hard build if components match target)
                    // Type A (Played X + Middle X = Hard X)
                    if (buildCardsFromMiddleInput.length === 1 &&
                        cardToPlay.value === finalBuildValue &&
                        getCardValue(buildCardsFromMiddleInput[0].rank, buildCardsFromMiddleInput[0].isAce ? (finalBuildValue === 14 ? 14 : 1) : undefined) === finalBuildValue) {
                        buildConstituentCards = [cardToPlay, buildCardsFromMiddleInput[0]];
                        newMiddleCards = newMiddleCards.filter(mc => mc.id !== buildCardsFromMiddleInput[0].id);
                        successfullyMadeBuild = true;
                    } 
                    // Type B (Middle cards sum to X, Played card is X = Hard X)
                    else if (buildCardsFromMiddleInput.length >= 1 &&
                             getSumOfCards(buildCardsFromMiddleInput) === finalBuildValue &&
                             cardToPlay.value === finalBuildValue) {
                        buildConstituentCards = [...buildCardsFromMiddleInput, cardToPlay];
                        newMiddleCards = newMiddleCards.filter(mc => !middleInputIds.includes(mc.id));
                        successfullyMadeBuild = true;
                    }
                    // Type C (Played card + Middle cards sum to X, separate Middle card pairs to make it Hard X)
                    else {
                        const sumOfPlayedAndSelectedMiddle = cardToPlay.value + getSumOfCards(buildCardsFromMiddleInput);
                        if (sumOfPlayedAndSelectedMiddle === finalBuildValue) {
                            const availableForPairingInMiddle = prev.middleCards.filter(mc => !middleInputIds.includes(mc.id) && mc.id !== cardToPlay.id);
                            const hardPairCardFromTable = availableForPairingInMiddle.find(mc => getCardValue(mc.rank, mc.isAce ? (finalBuildValue === 14 ? 14 : 1) : undefined) === finalBuildValue);

                            if (hardPairCardFromTable) {
                                buildConstituentCards = [cardToPlay, ...buildCardsFromMiddleInput, hardPairCardFromTable];
                                const idsToRemove = [...middleInputIds, hardPairCardFromTable.id];
                                newMiddleCards = newMiddleCards.filter(mc => !idsToRemove.includes(mc.id));
                                successfullyMadeBuild = true;
                            } else { isActuallyHard = false; }
                        } else { isActuallyHard = false; }
                    }
                }
                if (details.isHardBuild && !successfullyMadeBuild) {
                    addGameMessage("Failed to make a hard build. Check values or selection.", "error");
                    return prev;
                }
            }
            
            if (!isActuallyHard) { // Soft build
                 if (buildCardsFromMiddleInput.length === 0 && !details.cardToPairForHardBuildId) { 
                    addGameMessage("Soft build requires middle cards if not building from hand pair.", "error"); return prev;
                 }
                const sumOfPlayedAndMiddle = cardToPlay.value + getSumOfCards(buildCardsFromMiddleInput);
                addGameMessage(`Soft Build Debug: cardToPlay.value=${cardToPlay.value}, sumMiddle=${getSumOfCards(buildCardsFromMiddleInput)}, totalSum=${sumOfPlayedAndMiddle}, target=${finalBuildValue}`, "info");
                if (sumOfPlayedAndMiddle !== finalBuildValue) { 
                    addGameMessage(`Soft Build: Sum (${sumOfPlayedAndMiddle}) does not match target (${finalBuildValue}).`, 'error');
                    return prev;
                }
                buildConstituentCards = [cardToPlay, ...buildCardsFromMiddleInput];
                newMiddleCards = newMiddleCards.filter(mc => !middleInputIds.includes(mc.id));
                successfullyMadeBuild = true;
            }

            if (!successfullyMadeBuild) { addGameMessage("Build failed.", "error"); return prev; }

            const newBuild: SnsBuild = {
                id: generateBuildId(), cards: buildConstituentCards, totalValue: finalBuildValue, 
                ownerId: playerId, isHard: isActuallyHard
            };
            newPlayerActiveBuilds.push(newBuild);
            currentMustCaptureId = newBuild.id; // Primary build sets the mustCaptureId
            addGameMessage(`${playerId} created ${isActuallyHard ? 'HARD ' : ''}build ${newBuild.id} (value ${newBuild.totalValue}) with played card ${cardToPlay.id}.`, 'action');
        }

        // Process additional builds from middle cards only
        if (details.additionalSelectedMiddleCardGroupsForBuild && details.additionalSelectedMiddleCardGroupsForBuild.length > 0) {
          for (const additionalGroupCardIds of details.additionalSelectedMiddleCardGroupsForBuild) {
            if (!additionalGroupCardIds || additionalGroupCardIds.length === 0) continue;

            const additionalBuildCards = newMiddleCards.filter(mc => additionalGroupCardIds.includes(mc.id));
            
            // Ensure all selected cards for this additional build are actually available
            if (additionalBuildCards.length !== additionalGroupCardIds.length) {
              addGameMessage(`Additional build error: Some cards (${additionalGroupCardIds.join(', ')}) not found or already used.`, 'error');
              // Potentially revert primary build or handle error more gracefully if needed,
              // for now, we'll skip this additional build and continue.
              continue; 
            }

            if (doCardsSumToTarget(additionalBuildCards, details.buildTargetValue as number)) {
              const additionalNewBuild: SnsBuild = {
                id: generateBuildId(),
                cards: [...additionalBuildCards],
                totalValue: details.buildTargetValue as number,
                ownerId: playerId,
                isHard: false, // Additional builds from middle only are always soft
              };
              newPlayerActiveBuilds.push(additionalNewBuild);
              newMiddleCards = newMiddleCards.filter(mc => !additionalGroupCardIds.includes(mc.id));
              addGameMessage(`${playerId} also created additional build ${additionalNewBuild.id} (value ${additionalNewBuild.totalValue}) from middle cards.`, 'action');
            } else {
              addGameMessage(`Additional build error: Selected middle cards (${additionalGroupCardIds.join(', ')}) do not sum to target value ${details.buildTargetValue}.`, 'error');
            }
          }
        }

        // After all primary and additional builds are tentatively added to newPlayerActiveBuilds
        // Check for combining two builds of the same value into a hard build
        const buildsOfTargetValue = newPlayerActiveBuilds.filter(b => b.ownerId === playerId && b.totalValue === details.buildTargetValue);
        if (buildsOfTargetValue.length >= 2) {
          let combinedCards: SnsCard[] = [];
          let madeHardFromCombination = false;
          // Check if at least one was intended to be hard, or if just having two is enough
          // The rule says "You may combine two builds of the same value to form a hard build."
          // This implies if two exist, they *can* become one hard build.
          
          // Consolidate all cards from same-value builds into one
          buildsOfTargetValue.forEach(b => combinedCards.push(...b.cards));
          // Remove the original builds
          newPlayerActiveBuilds = newPlayerActiveBuilds.filter(b => !(b.ownerId === playerId && b.totalValue === details.buildTargetValue));
          
          // Create the new combined hard build
          const combinedHardBuild: SnsBuild = {
            id: generateBuildId(), // New ID for the combined build
            cards: combinedCards,
            totalValue: details.buildTargetValue as number,
            ownerId: playerId,
            isHard: true,
          };
          newPlayerActiveBuilds.push(combinedHardBuild);
          // If the original primary build was the one setting mustCaptureId, update it to the new combined build's ID
          // This assumes the primary build was part of the combination.
          // The `currentMustCaptureId` would have been set by the primary build if it was created.
          // If that primary build is now part of this new hard build, its ID is obsolete.
          // The new hard build should now be the must-capture.
          const primaryBuildThatWasCombined = buildsOfTargetValue.find(b => b.id === currentMustCaptureId);
          if (primaryBuildThatWasCombined || buildsOfTargetValue.length > 0) { // if any build of this value was made, and now combined.
             currentMustCaptureId = combinedHardBuild.id;
          }
          addGameMessage(`${playerId} combined multiple builds of value ${details.buildTargetValue} into a new HARD build ${combinedHardBuild.id}.`, 'action');
          madeHardFromCombination = true;

          // If the primary build was made hard through other means AND an additional build of same value was made,
          // they are now combined. If the primary build was soft, and an additional same-value build was made,
          // they are now combined into a hard build.
        }
      }
      
      playersCopy[playerId] = { ...playersCopy[playerId], hand: newPlayerHand, capturedPile: newCapturedPile, activeBuilds: newPlayerActiveBuilds };
      const isRoundOver = Object.values(playersCopy).every((p: SnsPlayer) => p.hand.length === 0);
      let nextPlayerId = prev.currentPlayerId === 'player1' ? 'player2' : 'player1';
      let nextGamePhase: SnsGameState['gamePhase'] = prev.gamePhase;
      if (isRoundOver) nextGamePhase = prev.deck.length === 0 ? 'scoring' : 'dealing';

      return {
        ...prev, players: playersCopy, middleCards: newMiddleCards, currentPlayerId: nextPlayerId,
        roundOver: isRoundOver, gamePhase: nextGamePhase, lastCapturePlayerId: lastCaptureBy, mustCaptureBuildId: currentMustCaptureId,
      };
    });
  }, [addGameMessage]);

  useEffect(() => { 
    if (gameState.currentPlayerId === 'player2' && gameState.gamePhase === 'playing' && !gameState.roundOver) {
      const aiPlayer = gameState.players['player2'];
      if (aiPlayer.hand.length > 0) {
        let aiActionDetails: ActionDetails | null = null;
        const aiObligatedBuild = aiPlayer.activeBuilds.find(b => b.id === gameState.mustCaptureBuildId);
        if (aiObligatedBuild) {
            for (const handCard of aiPlayer.hand) {
                const aceVal = handCard.isAce ? (aiObligatedBuild.totalValue === 1 ? 1 : aiObligatedBuild.totalValue === 14 ? 14 : 1) : undefined; 
                if (getCardValue(handCard.rank, aceVal) === aiObligatedBuild.totalValue) {
                    aiActionDetails = { actionType: 'capture', playedCardId: handCard.id, aceValueChoice: aceVal, selectedMiddleCardIdsForCapture: aiObligatedBuild.cards.map(c => c.id) };
                    break;
                }
            }
        }

        if (!aiActionDetails) {
            for (const handCard of aiPlayer.hand) {
              const aceValForPlay = handCard.isAce ? 14 : undefined; 
              const playedValue = getCardValue(handCard.rank, aceValForPlay);
              const captureCombinations = findAllSumCombinations(gameState.middleCards, playedValue);
              if (captureCombinations.length > 0) {
                aiActionDetails = { actionType: 'capture', playedCardId: handCard.id, aceValueChoice: aceValForPlay, selectedMiddleCardIdsForCapture: captureCombinations[0].map(c => c.id) };
                break;
              }
            }
        }
        
        if (!aiActionDetails && aiPlayer.hand.length >=2) { 
            const cardToPlayForBuild = aiPlayer.hand[0];
            const remainingHandForBuildTarget = aiPlayer.hand.slice(1);
            for (const middleCard of gameState.middleCards) {
                const sumVal = getCardValue(cardToPlayForBuild.rank, cardToPlayForBuild.isAce ? 14 : undefined) + getCardValue(middleCard.rank, middleCard.isAce ? (middleCard.value === 14 ? 14 : 1) : undefined);
                const targetCardInHand = remainingHandForBuildTarget.find(rc => getCardValue(rc.rank, rc.isAce ? 14: undefined) === sumVal);
                if (targetCardInHand) {
                    aiActionDetails = {
                        actionType: 'build', playedCardId: cardToPlayForBuild.id,
                        aceValueChoice: cardToPlayForBuild.isAce ? 14 : undefined,
                        selectedMiddleCardIdsForBuild: [middleCard.id], buildTargetValue: sumVal,
                        isHardBuild: false, 
                    };
                    break;
                }
            }
        }

        if (!aiActionDetails) {
          const cardToDrop = aiPlayer.hand[0];
          aiActionDetails = { actionType: 'drop', playedCardId: cardToDrop.id, aceValueChoice: cardToDrop.isAce ? 14 : undefined };
        }
        
        if (aiActionDetails) {
          const finalAiAction = aiActionDetails;
          addGameMessage(`AI (${'player2'}) playing: ${finalAiAction.actionType} with ${finalAiAction.playedCardId}`, 'info');
          setTimeout(() => playCard('player2', finalAiAction), 1000);
        }
      }
    }
  }, [gameState.currentPlayerId, gameState.gamePhase, gameState.players, gameState.middleCards, playCard, gameState.roundOver, gameState.mustCaptureBuildId, addGameMessage]);

  const calculatePlayerScore = (capturedPile: SnsCard[]): { score: number, spadesCount: number, cardCount: number } => {
    let score = 0; let spadesCount = 0; const cardCount = capturedPile.length;
    for (const card of capturedPile) {
      if (card.rank === 'A') score += 1;
      if (card.id === '2S') score += 1;
      if (card.id === 'TD') score += 2;
      if (card.suit === 'S') spadesCount += 1;
    }
    return { score, spadesCount, cardCount };
  };

  const calculateScores = useCallback(() => {
    setGameState(prev => {
      if (prev.gamePhase !== 'scoring') return prev;
      let workingPlayers = JSON.parse(JSON.stringify(prev.players)) as { [key: string]: SnsPlayer };
      let updatedMiddleCards = [...prev.middleCards];
      
      if (prev.lastCapturePlayerId && updatedMiddleCards.length > 0) {
        if (workingPlayers[prev.lastCapturePlayerId]) {
          workingPlayers[prev.lastCapturePlayerId].capturedPile.push(...updatedMiddleCards);
          addGameMessage(`${prev.lastCapturePlayerId} takes remaining ${updatedMiddleCards.length} cards from the middle.`, 'info');
        }
        updatedMiddleCards = [];
      }
      const p1Stats = calculatePlayerScore(workingPlayers.player1.capturedPile);
      const p2Stats = calculatePlayerScore(workingPlayers.player2.capturedPile);
      workingPlayers.player1.score = p1Stats.score;
      workingPlayers.player2.score = p2Stats.score;

      addGameMessage(`Player 1 initial points: ${p1Stats.score} (Spades: ${p1Stats.spadesCount}, Cards: ${p1Stats.cardCount})`, 'info');
      addGameMessage(`Player 2 initial points: ${p2Stats.score} (Spades: ${p2Stats.spadesCount}, Cards: ${p2Stats.cardCount})`, 'info');

      if (p1Stats.spadesCount > p2Stats.spadesCount) {
        workingPlayers.player1.score += 1;
        addGameMessage("Player 1 gets +1 point for Most Spades.", 'success');
      } else if (p2Stats.spadesCount > p1Stats.spadesCount) {
        workingPlayers.player2.score += 1;
        addGameMessage("Player 2 gets +1 point for Most Spades.", 'success');
      } else {
        addGameMessage("Spades count tied. No points for Most Spades.", 'info');
      }

      if (p1Stats.cardCount === 26 && p2Stats.cardCount === 26) {
         addGameMessage("Card count tied (26 each). No points for Most Cards.", 'info');
      } else if (p1Stats.cardCount > p2Stats.cardCount) {
        workingPlayers.player1.score += 3;
        addGameMessage("Player 1 gets +3 points for Most Cards.", 'success');
      } else if (p2Stats.cardCount > p1Stats.cardCount) {
        workingPlayers.player2.score += 3;
        addGameMessage("Player 2 gets +3 points for Most Cards.", 'success');
      }
      
      let finalMsg = "";
      if (workingPlayers.player1.score > workingPlayers.player2.score) finalMsg = `Player 1 wins ${workingPlayers.player1.score}-${workingPlayers.player2.score}!`;
      else if (workingPlayers.player2.score > workingPlayers.player1.score) finalMsg = `Player 2 wins ${workingPlayers.player2.score}-${workingPlayers.player1.score}!`;
      else finalMsg = `It's a Draw ${workingPlayers.player1.score}-${workingPlayers.player2.score}.`;
      
      addGameMessage(finalMsg, 'success');
      return { ...prev, players: workingPlayers, middleCards: updatedMiddleCards, gamePhase: 'gameOver', winnerMessage: finalMsg };
    });
  }, [addGameMessage]);

  useEffect(() => {
    if (gameState.gamePhase === 'scoring') calculateScores();
  }, [gameState.gamePhase, calculateScores]);

  return { gameState, dealCards, playCard, gameMessages, addGameMessage };
};

export default useSetAndSeizeLogic;

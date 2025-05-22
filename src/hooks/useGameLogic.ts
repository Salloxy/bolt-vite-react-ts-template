// src/hooks/useGameLogic.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, Player, Hand, Card, EvaluatedHand, PokerHandRank, Rank } from '../types';
import { createDeck, shuffleDeck, getRankValue } from '../lib/utils'; // Added getRankValue
import { evaluateHand, compareEvaluatedHands } from '../lib/pokerEvaluator';
import io, { Socket } from 'socket.io-client';

// For local development, use localhost. For production, connect to the same origin.
const POKER_SERVER_URL = process.env.NODE_ENV === 'production' ? window.location.origin : import.meta.env.VITE_POKER_SERVER_URL || 'http://localhost:3000';

// Helper function for AI strategic evaluation
const calculateHandPotential = (
    originalHandCards: readonly (Card | null)[],
    cardToPlace: Card,
    targetSlotIndex: number
): number => {
    const tempHandCards: (Card | null)[] = [...originalHandCards];
    if (targetSlotIndex < 0 || targetSlotIndex >= tempHandCards.length || tempHandCards[targetSlotIndex] !== null) {
        console.error("Invalid targetSlotIndex for calculateHandPotential, trying first empty");
        const firstEmpty = tempHandCards.findIndex(c => c === null);
        if (firstEmpty !== -1) {
            tempHandCards[firstEmpty] = cardToPlace;
        } else {
            return 0; // Cannot place card
        }
    } else {
        tempHandCards[targetSlotIndex] = cardToPlace;
    }

    const actualCards = tempHandCards.filter(c => c !== null) as Card[];
    const n = actualCards.length;

    if (n === 0) return 0;

    const ranks: { [rank: string]: number } = {};
    const suits: { [suit: string]: number } = {};
    let rankValuesNum: number[] = [];

    actualCards.forEach(card => {
        ranks[card.rank] = (ranks[card.rank] || 0) + 1;
        suits[card.suit] = (suits[card.suit] || 0) + 1;
        rankValuesNum.push(getRankValue(card.rank));
    });
    rankValuesNum.sort((a, b) => b - a);

    let score = 0;

    // 1. Made Hand (5 cards)
    if (n === 5) {
        const evaluation = evaluateHand(actualCards);
        if (evaluation) {
            const rankBaseScores: { [key in PokerHandRank]?: number } = {
                [PokerHandRank.HIGH_CARD]: 10,
                [PokerHandRank.ONE_PAIR]: 100,
                [PokerHandRank.TWO_PAIR]: 300,
                [PokerHandRank.THREE_OF_A_KIND]: 600,
                [PokerHandRank.STRAIGHT]: 1000,
                [PokerHandRank.FLUSH]: 1200,
                [PokerHandRank.FULL_HOUSE]: 1500,
                [PokerHandRank.FOUR_OF_A_KIND]: 2500,
                [PokerHandRank.STRAIGHT_FLUSH]: 5000,
                // RoyalFlush is a type of StraightFlush, handled by evaluateHand
            };
            score = rankBaseScores[evaluation.rank] || 0;
            evaluation.values.forEach(v => score += getRankValue(v)); // Add kicker values
            return score;
        }
    }

    // 2. Potential for Flush
    const maxSuitCount = Math.max(0, ...Object.values(suits));
    if (maxSuitCount === 4) score += 700; // Four to a flush
    else if (maxSuitCount === 3 && n <= 4) score += 200; // Three to a flush

    // 3. Potential for Straight
    const uniqueSortedRanks = [...new Set(rankValuesNum)].sort((a, b) => a - b);
    let straightPotentialScore = 0;

    const checkStraightDraws = (ranksToCheck: number[]): number => {
        let tempStraightScore = 0;
        if (ranksToCheck.length >= 4) {
            for (let i = 0; i <= ranksToCheck.length - 4; i++) {
                const slice = ranksToCheck.slice(i, i + 4);
                if (slice[3] - slice[0] === 3) { // Open-ended: e.g., 5,6,7,8
                    tempStraightScore = Math.max(tempStraightScore, 650); // 4 to open-ended
                } else if (slice[3] - slice[0] === 4 && slice.length === 4) { // Gutshot: e.g., 5,6,7,9 (ensure it's exactly 4 cards forming the sequence with one gap)
                    if ((slice[1] - slice[0] === 1 && slice[2] - slice[1] === 1 && slice[3] - slice[2] === 2) || // 6,7,8,10
                        (slice[1] - slice[0] === 1 && slice[2] - slice[1] === 2 && slice[3] - slice[2] === 1) || // 6,7,9,10
                        (slice[1] - slice[0] === 2 && slice[2] - slice[1] === 1 && slice[3] - slice[2] === 1)    // 6,8,9,10
                       ) {
                         tempStraightScore = Math.max(tempStraightScore, 300); // 4 to gutshot
                    }
                }
            }
        }
        if (ranksToCheck.length >= 3) {
            for (let i = 0; i <= ranksToCheck.length - 3; i++) {
                const slice = ranksToCheck.slice(i, i + 3);
                if (slice[2] - slice[0] === 2) { // e.g., 5,6,7 (double gutshot / 3 to open-ended)
                    tempStraightScore = Math.max(tempStraightScore, 150); 
                } else if (slice[2] - slice[0] === 3 && slice.length === 3) { // e.g., 5,6,8 or 5,7,8 (3 to gutshot)
                     if ((slice[1]-slice[0] === 1 && slice[2]-slice[1] === 2) || (slice[1]-slice[0] === 2 && slice[2]-slice[1] === 1)){
                        tempStraightScore = Math.max(tempStraightScore, 120);
                     }
                }
            }
        }
        return tempStraightScore;
    };

    straightPotentialScore = checkStraightDraws(uniqueSortedRanks);
    if (uniqueSortedRanks.includes(14)) { // Ace present
        const lowStraightRanks = uniqueSortedRanks.map(r => r === 14 ? 1 : r).filter((value, index, self) => self.indexOf(value) === index).sort((a,b)=>a-b);
        straightPotentialScore = Math.max(straightPotentialScore, checkStraightDraws(lowStraightRanks));
    }
    score += straightPotentialScore;

    // 4. Pairs, Trips, Quads (as components, not full made hands unless n=5)
    let pairVal = 0;
    let twoPairVal = 0;
    let tripsVal = 0;
    let quadsVal = 0;

    const rankCounts = Object.entries(ranks);
    const pairs = rankCounts.filter(([_, count]) => count === 2);
    const trips = rankCounts.filter(([_, count]) => count === 3);
    const quads = rankCounts.filter(([_, count]) => count === 4);

    if (quads.length > 0) {
        quadsVal = 800 + getRankValue(quads[0][0] as Rank) * 4;
    } else if (trips.length > 0) {
        tripsVal = 400 + getRankValue(trips[0][0] as Rank) * 3;
        if (pairs.length > 0 && n >= 4) { // Potential for Full House if one more card makes it
             tripsVal += 150; // Bonus for trips + pair
        }
    } else if (pairs.length >= 2) {
        const sortedPairs = pairs.sort((a,b) => getRankValue(b[0] as Rank) - getRankValue(a[0] as Rank));
        twoPairVal = 200 + getRankValue(sortedPairs[0][0] as Rank) * 2 + getRankValue(sortedPairs[1][0] as Rank);
    } else if (pairs.length === 1) {
        pairVal = 50 + getRankValue(pairs[0][0] as Rank) * 2;
    }
    
    score += Math.max(quadsVal, tripsVal, twoPairVal, pairVal);

    // 5. High card values as a small kicker, if no major draws/made hands yet
    if (score < 20 && n > 0 && n < 5) {
        actualCards.forEach(c => score += getRankValue(c.rank as Rank) * 0.1); // very small addition
    }
    
    // Bonus if the cardToPlace specifically improved the hand
    const newCardRank = cardToPlace.rank;
    const newCardSuit = cardToPlace.suit;

    if (ranks[newCardRank] > 1) { 
        score += 10 * ranks[newCardRank]; 
    }
    if (suits[newCardSuit] > 1 && ranks[newCardRank] === 1) { 
        score += 5 * suits[newCardSuit];
    }
    
    return Math.round(score);
};

const initializePlayer = (id: string): Player => ({
  id,
  hands: Array(5).fill(null).map(() => ({ cards: Array(5).fill(null) } as Hand)),
});

interface UseGameLogicProps {
  isOnlineMultiplayer?: boolean;
  onGoHome?: () => void; // Callback to navigate to home
}

const useGameLogic = ({ isOnlineMultiplayer = false, onGoHome }: UseGameLogicProps) => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const gameStateRef = useRef<GameState | null>(null); // Ref for current gameState
  // const onGoHomeRef = useRef(onGoHome); // Ref for onGoHome callback - REMOVED
  const [playerId, setPlayerId] = useState<string | null>(null); // For online multiplayer
  const playerIdRef = useRef<string | null>(null); // Ref to hold current playerId
  const [heldCard, setHeldCard] = useState<Card | null>(null); // Card drawn by player, waiting to be placed
  const [error, setError] = useState<string | null>(null); // For displaying errors to the user
  const [gameResults, setGameResults] = useState<string | null>(null); // To store overall game winner message
  
  // Keep playerIdRef updated
  useEffect(() => {
    playerIdRef.current = playerId;
  }, [playerId]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Update onGoHomeRef when onGoHome prop changes - REMOVED
  // useEffect(() => {
  //   onGoHomeRef.current = onGoHome;
  // }, [onGoHome]);

  // Initialize socket connection for online multiplayer
  useEffect(() => {
    if (isOnlineMultiplayer) {
      const newSocket = io(POKER_SERVER_URL);
      setSocket(newSocket);

      newSocket.on('connect', () => {
        console.log('Connected to server with id:', newSocket.id);
        if (newSocket.id) {
          setPlayerId(newSocket.id); // Set player ID from socket
          // Automatically try to find a match once connected and ID is set
          console.log('Socket connected, attempting to find match with ID:', newSocket.id);
          newSocket.emit('findMatch');
        } else {
          console.warn('Socket connected but ID is undefined. Cannot find match yet.');
        }
      });

      newSocket.on('gameStateUpdate', (rawUpdatedGameState: GameState) => {
        const updatedGameState = JSON.parse(JSON.stringify(rawUpdatedGameState)); // Deep clone to allow modification
        const currentSocketId = newSocket.id; // Use the live socket ID from the current connection

        // console.log(`[gameStateUpdate] currentSocketId: ${currentSocketId}, rawGameState received:`, rawUpdatedGameState);

        if (currentSocketId) { // Ensure currentSocketId is available
          // console.log(`[gameStateUpdate] Processing players. My ID: ${currentSocketId}`);
          updatedGameState.players.forEach((p: Player, playerIndex: number) => { // Explicitly type 'p' as Player
            // console.log(`[gameStateUpdate] Player ${playerIndex} ID: ${p.id}`);
            p.hands.forEach((hand: Hand, handIndex: number) => {
              // Check if the 5th card slot exists and has a card
              if (hand.cards.length > 4 && hand.cards[4]) { 
                const originalCard = hand.cards[4]!;
                // console.log(`[gameStateUpdate] Player ${p.id}, Hand ${handIndex}, 5th card original hidden: ${originalCard.hidden}`);
                if (p.id === currentSocketId) { // Compare against the live socket ID
                  // This is the current client's player. Their 5th card should be visible.
                  hand.cards[4] = { ...originalCard, hidden: false };
                  // console.log(`[gameStateUpdate] Player ${p.id} (ME) - 5th card set to hidden: false`);
                } else {
                  // This is an opponent. Their 5th card should be hidden.
                  hand.cards[4] = { ...originalCard, hidden: true };
                  // console.log(`[gameStateUpdate] Player ${p.id} (OPPONENT) - 5th card set to hidden: true`);
                }
              }
            });
          });
        }

        setGameState(updatedGameState);
        // If game state update includes results, update gameResults
        if (updatedGameState.gamePhase === 'gameOver' && updatedGameState.winnerMessage) {
            let finalMsg = updatedGameState.winnerMessage; // Default to server's message
            let clientCalculatedResult = false;
            const currentPId = playerIdRef.current; // Use ref for current playerId

            // For online games, try to derive result from individualHandWinners for accuracy
            if (isOnlineMultiplayer && currentPId && updatedGameState.players?.length === 2 && updatedGameState.individualHandWinners?.length === 5) {
                const opponent = updatedGameState.players.find((p: Player) => p.id !== currentPId);
                if (opponent) {
                    let myHandsWon = 0;
                    let opponentHandsWon = 0;
                    updatedGameState.individualHandWinners.forEach((winnerId: string | null) => {
                        if (winnerId === currentPId) myHandsWon++;
                        else if (winnerId === opponent.id) opponentHandsWon++;
                    });

                    if (myHandsWon > opponentHandsWon) finalMsg = `YOU WON (${myHandsWon} - ${opponentHandsWon})`;
                    else if (opponentHandsWon > myHandsWon) finalMsg = `YOU LOST (${myHandsWon} - ${opponentHandsWon})`;
                    else finalMsg = `IT'S A TIE (${myHandsWon} - ${opponentHandsWon})`;
                    clientCalculatedResult = true;
                }
            }

            // If client-side calculation wasn't performed (e.g., missing data) or it's not an online game setup for this,
            // fall back to parsing the server's original message for online games.
            if (!clientCalculatedResult && isOnlineMultiplayer && currentPId && updatedGameState.players?.length === 2) {
                const serverMessageToParse = updatedGameState.winnerMessage; // Ensure we parse the original server message
                const winRegex = /^(?:Game Over! )?([\w-]+) wins the game \((\d+) to (\d+)\)!$/;
                const tieRegex = /^(?:Game Over! )?It's a tie overall! \((\d+) to (\d+)\)$/;
                const winMatch = serverMessageToParse.match(winRegex);
                const tieMatch = serverMessageToParse.match(tieRegex);

                if (winMatch) {
                    const winnerIdFromServer = winMatch[1];
                    const scoreWinner = parseInt(winMatch[2]);
                    const scoreLoser = parseInt(winMatch[3]);
                    if (winnerIdFromServer === currentPId) finalMsg = `YOU WON (${scoreWinner} - ${scoreLoser})`;
                    else finalMsg = `YOU LOST (${scoreLoser} - ${scoreWinner})`;
                } else if (tieMatch) {
                    const score1 = parseInt(tieMatch[1]);
                    const score2 = parseInt(tieMatch[2]);
                    const myPlayerIndex = updatedGameState.players.findIndex((p: Player) => p.id === currentPId);
                    if (myPlayerIndex === 0) finalMsg = `IT'S A TIE (${score1} - ${score2})`;
                    else if (myPlayerIndex === 1) finalMsg = `IT'S A TIE (${score2} - ${score1})`;
                    else finalMsg = `IT'S A TIE (${score1} - ${score2})`; // Fallback tie
                }
                // If no regex match, finalMsg remains the original updatedGameState.winnerMessage from the initial assignment
            }
            // Note: For !isOnlineMultiplayer, gameResults is set in a different useEffect hook dedicated to local game evaluation.
            setGameResults(finalMsg);
        }
        if (updatedGameState.heldCard !== undefined) { // Server might send current held card
            setHeldCard(updatedGameState.heldCard);
        }
      });
      
      // newSocket.on('assignPlayerId', (id: string) => { // This seems redundant if socket.id is used on connect
      //   console.log('Assigned player ID by server:', id);
      //   if (!playerId) setPlayerId(id); // Only set if not already set, to avoid loops if server sends it multiple times
      // });

      newSocket.on('gameStart', (initialGameState: GameState) => {
        console.log('Game starting with state:', initialGameState);
        setGameState(initialGameState);
        setGameResults(null);
        setError(null);
        setHeldCard(null);
      });
      
      newSocket.on('error', (message: string) => {
        console.error('Socket Error:', message);
        setError(message);
      });
      
      newSocket.on('playerDrewCard', ({card}: {card: Card}) => {
        setHeldCard(card);
        setError(null);
      });

      newSocket.on('opponentDisconnected', (message: string) => {
        const disconnectMessage = message || 'Your opponent has disconnected. Game over.';
        console.log('Opponent disconnected:', disconnectMessage);
        
        // Set game state to gameOver and update gameResults
        setGameState(prev => {
          if (prev && prev.gamePhase !== 'gameOver') {
            return { ...prev, gamePhase: 'gameOver', winnerMessage: disconnectMessage };
          }
          return prev;
        });
        setGameResults(disconnectMessage);
        
        // Clear the separate error state if we are showing the message in gameResults
        setError(null);
      });

      newSocket.on('kickedDueToTimeout', ({ message }: { gameId: string, playerId: string, message: string }) => {
        console.log('Kicked due to timeout:', message);
        setGameState(prev => {
          if (prev && prev.gamePhase !== 'gameOver') {
            return { ...prev, gamePhase: 'gameOver', winnerMessage: message };
          }
          return prev;
        });
        setGameResults(message);
        setError(null);
        // The socket will also disconnect, triggering the 'disconnect' handler.
      });

      // The 'turnTimeout' event is no longer used as players are kicked on timeout.
      // The 'kickedDueToTimeout' or 'opponentDisconnected' events will handle this.
      // newSocket.on('turnTimeout', ({ gameId, playerId: timedOutPlayerId }: { gameId: string, playerId: string }) => {
      //   if (gameStateRef.current?.id === gameId && playerIdRef.current === timedOutPlayerId) {
      //     console.log(`Player ${timedOutPlayerId} timed out. Navigating home.`);
      //     if (onGoHome) {
      //       onGoHome();
      //     }
      //   }
      // });

      return () => {
        console.log('Disconnecting socket effect cleanup due to isOnlineMultiplayer change or unmount.');
        newSocket.disconnect();
      };
    }
  }, [isOnlineMultiplayer, onGoHome]); // onGoHome added back to dependencies


  const initializeLocalGame = useCallback(() => {
    let p1 = initializePlayer('player1');
    let ai = initializePlayer('ai');
    let deck = shuffleDeck(createDeck());

    // Deal 1 card to each of the 5 hands for both players
    const dealInitialCards = (player: Player, currentDeck: Card[]): { updatedPlayer: Player, updatedDeck: Card[] } => {
      const updatedPlayerHands = player.hands.map(hand => {
        const cardToDeal = currentDeck.pop();
        return cardToDeal ? { ...hand, cards: [cardToDeal, null, null, null, null] } : hand;
      });
      return { updatedPlayer: { ...player, hands: updatedPlayerHands }, updatedDeck: currentDeck };
    };

    const p1Result = dealInitialCards(p1, deck);
    p1 = p1Result.updatedPlayer;
    deck = p1Result.updatedDeck;

    const aiResult = dealInitialCards(ai, deck);
    ai = aiResult.updatedPlayer;
    deck = aiResult.updatedDeck;

    setGameState({
      id: `local_${Date.now()}`,
      deck: deck,
      players: [p1, ai],
      currentPlayerId: 'player1', 
      gamePhase: 'setup', // Will be changed to 'playing' by startGame
      turnNumber: 0,
      placementRuleActive: true, 
    });
    setGameResults(null);
    setError(null);
    setHeldCard(null);
  }, []);

  const startGame = useCallback(() => {
    if (isOnlineMultiplayer && socket) {
      // Reset game state to show loading/searching UI before emitting findMatch
      setGameState(null); 
      setGameResults(null);
      setError(null);
      setHeldCard(null);
      // It's important that findMatch is emitted after the state reset has had a chance to propagate
      // or that the UI relies on a different loading indicator if findMatch is immediate.
      // For simplicity here, we'll emit immediately. The UI should ideally handle a "searching" state
      // based on a combination of `isOnlineMultiplayer` and `!gameState`.
      socket.emit('leaveGameOrQueue'); // Tell the server to clean up any old session
      socket.emit('findMatch'); 
      console.log("Attempting to find new online match after requesting to leave previous game/queue...");
    } else if (!isOnlineMultiplayer) {
      initializeLocalGame(); // This sets up the initial state including players
      // Then, transition to 'playing' phase
      setGameState(prev => {
        if (prev && prev.players && prev.players.length > 0) {
          return { ...prev, gamePhase: 'playing', currentPlayerId: prev.players[0].id };
        }
        // If prev is null (e.g. after a reset) or players aren't set up by initializeLocalGame (should not happen)
        // We might need to call initializeLocalGame first if it wasn't guaranteed to run.
        // However, initializeLocalGame is called right before this, so prev should be populated.
        return prev; 
      });
    }
  }, [isOnlineMultiplayer, socket, initializeLocalGame]);


  const drawCard = useCallback(() => {
    setError(null);
    if (!gameState || gameState.gamePhase !== 'playing' || heldCard) {
      if (heldCard) setError("You must place the card you are holding first.");
      return;
    }
    if (gameState.deck.length === 0) {
      setError("Deck is empty.");
      return;
    }

    if (isOnlineMultiplayer && socket && playerId) {
      socket.emit('drawCard', { gameId: gameState.id, playerId });
    } else if (!isOnlineMultiplayer) {
      setGameState(prev => {
        if (!prev || prev.deck.length === 0) return prev;
        const newDeck = [...prev.deck];
        const drawn = newDeck.pop();
        if (!drawn) return prev;
        setHeldCard(drawn);
        console.log(`${prev.currentPlayerId} drew ${drawn.id}`);
        return { ...prev, deck: newDeck };
      });
    }
  }, [gameState, socket, playerId, isOnlineMultiplayer, heldCard]);

  const canPlaceCardInHand = (player: Player, handIndex: number, targetSlot: number): boolean => {
    if (targetSlot < 0 || targetSlot > 4) return false;
    const cardCounts = player.hands.map(h => h.cards.filter(c => c !== null).length);
    const cardsInTargetHandCurrently = cardCounts[handIndex];
    if (cardsInTargetHandCurrently !== targetSlot) {
      console.error("Mismatch between targetSlot and actual empty slot count in hand.");
      return false; 
    }
    const numCardsTargetHandWillHave = cardsInTargetHandCurrently + 1;
    if (numCardsTargetHandWillHave === 3) {
      return player.hands.every(h => h.cards.filter(c => c !== null).length >= 2);
    }
    if (numCardsTargetHandWillHave === 4) {
      return player.hands.every(h => h.cards.filter(c => c !== null).length >= 3);
    }
    if (numCardsTargetHandWillHave === 5) {
      return player.hands.every(h => h.cards.filter(c => c !== null).length >= 4);
    }
    return true;
  };

  const placeCard = useCallback((handIndex: number) => {
    setError(null);
    if (!gameState || gameState.gamePhase !== 'playing' || !gameState.currentPlayerId || !heldCard) {
      if (!heldCard) setError("You must draw a card first.");
      return;
    }
    
    const playerIndex = gameState.players.findIndex(p => p.id === gameState.currentPlayerId);
    if (playerIndex === -1) return;

    const player = gameState.players[playerIndex];
    const targetHand = player.hands[handIndex];
    if (!targetHand) {
      setError("Invalid hand index.");
      return;
    }

    const firstEmptySlot = targetHand.cards.findIndex(c => c === null);
    if (firstEmptySlot === -1) {
      setError("This hand is already full.");
      return;
    }

    if (!canPlaceCardInHand(player, handIndex, firstEmptySlot)) {
      // setError("Placement restriction: Cannot place card in this hand yet. Ensure other hands meet minimum card counts."); // Removed error setting
      return; // Simply return if placement is not allowed
    }

    if (isOnlineMultiplayer && socket && playerId) {
      socket.emit('placeCard', { gameId: gameState.id, playerId, handIndex, card: heldCard });
      // setHeldCard(null); // Server will update heldCard via gameStateUpdate
    } else if (!isOnlineMultiplayer) {
      setGameState(prev => {
        if (!prev || !heldCard) return prev; // heldCard check for type safety
        const newPlayers = JSON.parse(JSON.stringify(prev.players));
        const currentPlayerToUpdate = newPlayers[playerIndex];
        const handToUpdate = currentPlayerToUpdate.hands[handIndex];
        
        handToUpdate.cards[firstEmptySlot] = { ...heldCard };
        // For the 5th card (index 4), apply specific hiding rules for local mode.
        if (firstEmptySlot === 4) { 
          // Check if the card is being placed in the AI's hand (opponent).
          if (currentPlayerToUpdate.id === 'ai') { 
            handToUpdate.cards[firstEmptySlot]!.hidden = true; // AI's 5th card is hidden.
          } else {
            // Player's 5th card should be visible.
            handToUpdate.cards[firstEmptySlot]!.hidden = false; // Explicitly set to not hidden.
          }
        }
        setHeldCard(null);

        const allHandsFull = newPlayers.every((p: Player) => 
          p.hands.every(h => h.cards.filter(c => c !== null).length === 5)
        );

        if (allHandsFull) {
          return {
            ...prev,
            players: newPlayers,
            gamePhase: 'evaluation', 
            currentPlayerId: null,
          };
        }

        const nextPlayerIndex = (playerIndex + 1) % prev.players.length;
        return { 
          ...prev, 
          players: newPlayers, 
          currentPlayerId: prev.players[nextPlayerIndex].id,
          turnNumber: prev.turnNumber + 1,
        };
      });
    }
  }, [gameState, socket, playerId, isOnlineMultiplayer, heldCard]);


  // AI Logic
  const makeAiMove = useCallback(() => {
    if (!gameState || !heldCard || gameState.currentPlayerId !== 'ai' || isOnlineMultiplayer) {
      return;
    }

    const aiPlayerIndex = gameState.players.findIndex(p => p.id === 'ai');
    if (aiPlayerIndex === -1) {
        console.error("AI Error: AI player not found in game state.");
        return;
    }
    const aiPlayer = gameState.players[aiPlayerIndex];

    let bestHandIndex = -1;
    let bestPotentialScore = -Infinity; // Use -Infinity for proper comparison

    console.log(`AI (${gameState.currentPlayerId}) is holding ${heldCard.id} and considering placements:`);

    for (let i = 0; i < 5; i++) {
      const hand = aiPlayer.hands[i];
      const firstEmptySlot = hand.cards.findIndex(c => c === null);

      if (firstEmptySlot !== -1) { // If hand is not full
        if (canPlaceCardInHand(aiPlayer, i, firstEmptySlot)) {
          const currentPotentialScore = calculateHandPotential(hand.cards, heldCard, firstEmptySlot);
          console.log(`AI: Hand ${i}, Slot ${firstEmptySlot}. Potential Score: ${currentPotentialScore}`);

          if (currentPotentialScore > bestPotentialScore) {
            bestPotentialScore = currentPotentialScore;
            bestHandIndex = i;
          }
        } else {
          console.log(`AI: Hand ${i}, Slot ${firstEmptySlot}. Cannot place due to placement rules.`);
        }
      } else {
        console.log(`AI: Hand ${i} is full.`);
      }
    }

    if (bestHandIndex !== -1) {
      console.log(`AI CHOICE: Placing ${heldCard.id} in hand ${bestHandIndex} (Score: ${bestPotentialScore})`);
      placeCard(bestHandIndex);
    } else {
      // Fallback: If no move found a score > -Infinity or no hand was placeable.
      // This means either all placeable hands scored -Infinity (error in calculateHandPotential)
      // or no hand satisfied canPlaceCardInHand.
      console.warn("AI: No strategically optimal move found with positive score, attempting emergency fallback.");
      let emergencyFallbackIndex = -1;
      for (let i = 0; i < 5; i++) {
          const hand = aiPlayer.hands[i];
          const firstEmptySlot = hand.cards.findIndex(c => c === null);
          if (firstEmptySlot !== -1 && canPlaceCardInHand(aiPlayer, i, firstEmptySlot)) {
              emergencyFallbackIndex = i; // Pick the first valid hand
              break; 
          }
      }

      if (emergencyFallbackIndex !== -1) {
          console.log(`AI CHOICE (Fallback): Placing ${heldCard.id} in hand ${emergencyFallbackIndex}`);
          placeCard(emergencyFallbackIndex);
      } else {
         setError("AI critical error: Could not find any valid move. This indicates a core logic issue with canPlaceCardInHand or game state.");
         console.error("AI Error: No valid hand found for placement even with emergency fallback. All hands full or restricted.");
      }
    }
  }, [gameState, heldCard, isOnlineMultiplayer, placeCard, setError]);


  // Effect to trigger AI move
  useEffect(() => {
    if (!isOnlineMultiplayer && gameState?.currentPlayerId === 'ai' && gameState.gamePhase === 'playing') {
      if (heldCard) {
        // AI needs to place the card it's holding
        setTimeout(() => makeAiMove(), 1000); // Simulate AI thinking time
      } else {
        // AI needs to draw a card
        setTimeout(() => drawCard(), 500); 
      }
    }
  }, [gameState?.currentPlayerId, gameState?.gamePhase, heldCard, isOnlineMultiplayer, drawCard, makeAiMove]);


  useEffect(() => {
    if (gameState?.gamePhase === 'evaluation' && !isOnlineMultiplayer) {
        const playersWithRevealedCards = gameState.players.map(player => ({
          ...player,
          hands: player.hands.map(hand => ({
            ...hand,
            cards: hand.cards.map(card => card ? { ...card, hidden: false } : null)
          }))
        }));

        const handEvalResults: { p1Wins: number; p2Wins: number; individualWinners: (string | null)[] } = {
          p1Wins: 0,
          p2Wins: 0,
          individualWinners: Array(5).fill(null),
        };

        const evaluatedPlayerHands = playersWithRevealedCards.map(player => ({
            ...player,
            hands: player.hands.map(h => ({
                ...h,
                evaluation: evaluateHand(h.cards)
            }))
        }));

        for (let i = 0; i < 5; i++) {
          const evalP1 = evaluatedPlayerHands[0].hands[i].evaluation;
          const evalP2 = evaluatedPlayerHands[1].hands[i].evaluation;

          if (evalP1 && evalP2) {
            const comparison = compareEvaluatedHands(evalP1, evalP2);
            if (comparison > 0) {
              handEvalResults.p1Wins++;
              handEvalResults.individualWinners[i] = evaluatedPlayerHands[0].id;
            } else if (comparison < 0) {
              handEvalResults.p2Wins++;
              handEvalResults.individualWinners[i] = evaluatedPlayerHands[1].id;
            } else {
              handEvalResults.individualWinners[i] = 'Tie';
            }
          } else if (evalP1) {
            handEvalResults.p1Wins++;
            handEvalResults.individualWinners[i] = evaluatedPlayerHands[0].id;
          } else if (evalP2) {
            handEvalResults.p2Wins++;
            handEvalResults.individualWinners[i] = evaluatedPlayerHands[1].id;
          }
        }
        
        let overallWinnerMsg = "";
        const p1Wins = handEvalResults.p1Wins;
        const p2Wins = handEvalResults.p2Wins;
        // In local games, evaluatedPlayerHands[0] is 'player1' (human) and evaluatedPlayerHands[1] is 'ai'.
        // The message should be from the perspective of 'player1' (YOU).

        if (p1Wins > p2Wins) {
          // Player 1 (YOU) won
          overallWinnerMsg = `YOU WON (${p1Wins} - ${p2Wins})`;
        } else if (p2Wins > p1Wins) {
          // Player 2 (AI) won, so YOU lost. Scores are p1 (your score) vs p2 (AI score)
          overallWinnerMsg = `YOU LOST (${p1Wins} - ${p2Wins})`;
        } else {
          // Tie
          overallWinnerMsg = `IT'S A TIE (${p1Wins} - ${p2Wins})`;
        }
        setGameResults(overallWinnerMsg);
        console.log("Individual hand winners:", handEvalResults.individualWinners);

        setGameState(prev => prev ? {
          ...prev,
          players: evaluatedPlayerHands, 
          gamePhase: 'gameOver',
          winnerMessage: overallWinnerMsg, // Store winner message
          individualHandWinners: handEvalResults.individualWinners, // Store individual winners
        } : null);
    } else if (gameState?.gamePhase === 'evaluation' && isOnlineMultiplayer && socket && playerIdRef.current === gameState.players[0].id) {
        // For online games, P1 (or a designated player/server) triggers evaluation.
        // Server will perform evaluation and broadcast results.
        socket.emit('evaluateGame', { gameId: gameState.id });
    }
  }, [gameState?.gamePhase, isOnlineMultiplayer, socket, gameState?.players, gameState?.id]); // playerId (state) removed, ref is used


  useEffect(() => {
    if (!isOnlineMultiplayer && !gameState) {
      startGame(); 
    }
  }, [isOnlineMultiplayer, gameState, startGame]); 

  const cancelMatchmaking = useCallback(() => {
    if (socket && isOnlineMultiplayer && !gameState) { // Check if currently in matchmaking state
      console.log(`Player ${playerId} cancelling matchmaking`);
      socket.emit('cancel_matchmaking', { playerId });
      // Optionally, could also call a function here to navigate back to the main menu
      // For now, this just tells the server. The UI in GameTable will need to react.
      // To give immediate feedback, we can set an error or a specific status.
      // However, the simplest is to rely on App.tsx's onGoHome for navigation.
      // This hook doesn't have direct access to that, so GameTable will handle UI change.
    }
  }, [socket, isOnlineMultiplayer, gameState, playerId]);


  return { 
    gameState, 
    startGame, 
    drawCard, 
    placeCard, 
    heldCard, 
    playerId, 
    socket, 
    error, 
    setError, 
    gameResults,
    cancelMatchmaking
  };
};

export default useGameLogic;

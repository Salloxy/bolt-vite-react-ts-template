// server/index.ts
import express from 'express';
import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { GameState, Player, Card, Hand, EvaluatedHand, SnsCard, SnsBuild, SnsRank, SnsSuit } from '../src/types/index.js'; // Assuming types can be shared
import { createDeck, shuffleDeck } from '../src/lib/utils.js'; // Assuming utils can be shared
import { evaluateHand, compareEvaluatedHands } from '../src/lib/pokerEvaluator.js'; // Assuming evaluator can be shared
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();

// ES Module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pokerServer = http.createServer(app);
const pokerIo = new SocketIOServer(pokerServer, {
  cors: {
    origin: "*", // Allow all origins for Glitch simplicity
    methods: ["GET", "POST"]
  }
});

const setAndSeizeServer = http.createServer(app);
const setAndSeizeIo = new SocketIOServer(setAndSeizeServer, {
  cors: {
    origin: "*", // Allow all origins for Glitch simplicity
    methods: ["GET", "POST"]
  }
});

const POKER_PORT = process.env.POKER_PORT || 3000;
const SNS_PORT = process.env.SNS_PORT || 3001;

interface RoomPlayerInfo {
  socketId: string;
  playerNumber: 1 | 2;
}

interface GameRoom {
  id: string;
  players: RoomPlayerInfo[];
  gameState: GameState;
  turnTimerId?: NodeJS.Timeout; // Timer for the current player's turn
  turnTimerDuration: number; // Duration of the turn in ms
}

const rooms = new Map<string, GameRoom>(); // For Brazilian Poker
const matchmakingQueue: Socket[] = []; // For Brazilian Poker

interface SnsGameRoom {
  id: string;
  players: RoomPlayerInfo[];
  snsGameState: SnsGameState;
  turnTimerId?: NodeJS.Timeout;
  turnTimerDuration: number;
}

interface SnsPlayerState {
  id: string;
  hand: SnsCard[];
  collectedCards: SnsCard[];
  mustCapture: boolean;
  lastBuildValue: number | null;
  justMadeBuild: boolean;
}

interface SnsGameState {
  id: string;
  deck: SnsCard[];
  players: SnsPlayerState[];
  middleCards: (SnsCard | SnsBuild)[];
  currentPlayerId: string;
  gamePhase: 'loading' | 'playing' | 'gameOver';
  lastCapturePlayerId: string | null;
  gameEnded: boolean;
  gameResult: { winner: 'player' | 'ai' | 'draw' | null; playerScore: number; aiScore: number } | null;
  turnStartTime?: number; // Timestamp when the current turn started
  turnTimerEndsAt?: number; // Timestamp when the current turn timer ends
}

const snsRooms = new Map<string, SnsGameRoom>(); // For Set & Seize
const matchmakingQueueSns: Socket[] = []; // For Set & Seize

const getRankValue = (rank: SnsRank): number => {
  switch (rank) {
    case 'A': return 14; // Ace can also be 1, handled in getCardPossibleValues
    case 'K': return 13;
    case 'Q': return 12;
    case 'J': return 11;
    case 'T': return 10;
    default: return parseInt(rank);
  }
};

const getCardPossibleValues = (card: SnsCard): number[] => {
  const rankValue = getRankValue(card.rank);
  let possibleValues: number[];
  if (card.rank === 'A') {
    possibleValues = [1, rankValue]; // Ace can be 1 or 14
  } else {
    possibleValues = [rankValue];
  }
  return possibleValues;
};

const findAllSubsetsSummingToTarget = (
  targetSum: number,
  cards: SnsCard[],
): SnsCard[][] => {
  const results: SnsCard[][] = [];

  const find = (
    startIndex: number,
    currentSubset: SnsCard[],
    currentSubsetValues: number[]
  ) => {
    const currentSum = currentSubsetValues.reduce((acc, val) => acc + val, 0);

    if (currentSum === targetSum) {
      if (currentSubset.length > 0) {
        results.push([...currentSubset]);
      }
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
        currentSubsetValues.pop();
        currentSubset.pop();
      }
    }
  };

  find(0, [], []);
  return results;
};

const findMultipleDisjointBuilds = (
  targetSum: number,
  cardsPool: SnsCard[],
  minBuilds: number,
  currentPartition: SnsCard[][],
  usedIndices: boolean[]
): SnsCard[][] | null => {
  if (usedIndices.every(u => u)) {
    if (currentPartition.length >= minBuilds) {
      return currentPartition;
    }
    return null;
  }

  let firstUnusedIndex = -1;
  for (let i = 0; i < usedIndices.length; i++) {
    if (!usedIndices[i]) {
      firstUnusedIndex = i;
      break;
    }
  }

  if (firstUnusedIndex === -1) {
    return null;
  }

  const availableCardsForSubset = cardsPool.filter((_, idx) => !usedIndices[idx]);
  const possibleSubsets = findAllSubsetsSummingToTarget(targetSum, availableCardsForSubset);

  for (const subset of possibleSubsets) {
    const nextUsedIndices = [...usedIndices];
    let canUseSubset = true;
    for (const sCard of subset) {
      const originalIndex = cardsPool.findIndex(c => c.id === sCard.id);
      if (originalIndex === -1 || nextUsedIndices[originalIndex]) {
        canUseSubset = false;
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

const canAllCardsBePartitioned = (
  targetSum: number,
  cards: SnsCard[],
  currentUsedIndices: boolean[]
): boolean => {
  if (currentUsedIndices.every(u => u)) {
    return true;
  }

  let firstUnusedIndex = -1;
  for (let i = 0; i < currentUsedIndices.length; i++) {
    if (!currentUsedIndices[i]) {
      firstUnusedIndex = i;
      break;
    }
  }

  if (firstUnusedIndex === -1) {
    return false;
  }

  const findSubsetAndRecurse = (
    startIndexForSubset: number,
    currentSubsetSum: number,
    currentSubsetIndices: number[],
    tempUsedIndices: boolean[]
  ): boolean => {
    if (currentSubsetSum === targetSum) {
      const nextOverallUsedIndices = [...currentUsedIndices];
      currentSubsetIndices.forEach(idx => nextOverallUsedIndices[idx] = true);

      return canAllCardsBePartitioned(targetSum, cards, nextOverallUsedIndices);
    }
    if (currentSubsetSum > targetSum || startIndexForSubset >= cards.length) {
      return false;
    }
    for (let i = startIndexForSubset; i < cards.length; i++) {
      if (!tempUsedIndices[i]) {
        const card = cards[i];
        const possibleValues = getCardPossibleValues(card);

        for (const val of possibleValues) {
          currentSubsetIndices.push(i);
          tempUsedIndices[i] = true;

          if (findSubsetAndRecurse(i + 1, currentSubsetSum + val, currentSubsetIndices, tempUsedIndices)) {
            return true;
          }

          currentSubsetIndices.pop();
          tempUsedIndices[i] = false;
        }
      }
    }
    return false;
  };

  const initialTempUsedIndices = [...currentUsedIndices];
  return findSubsetAndRecurse(firstUnusedIndex, 0, [], initialTempUsedIndices);
};

const createSnsDeck = (): SnsCard[] => {
  const suits: SnsSuit[] = ['H', 'D', 'C', 'S'];
  const ranks: SnsRank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
  const deck: SnsCard[] = [];

  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({
        rank,
        suit,
        value: getRankValue(rank),
        id: `${rank}${suit}`,
        isAce: rank === 'A'
      });
    }
  }
  return deck;
};

const shuffleSnsDeck = (deck: SnsCard[]): SnsCard[] => {
  let currentIndex = deck.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [deck[currentIndex], deck[randomIndex]] = [
      deck[randomIndex], deck[currentIndex]];
  }
  return deck;
};

const initializePlayerForSnsServer = (id: string): SnsPlayerState => ({
  id,
  hand: [],
  collectedCards: [],
  mustCapture: false,
  lastBuildValue: null,
  justMadeBuild: false,
});

const createNewSetAndSeizeGame = (player1Socket: Socket, player2Socket: Socket): SnsGameRoom => {
  const roomId = `sns_game_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  let serverDeck = shuffleSnsDeck(createSnsDeck());
  const initialPlayer1Hand: SnsCard[] = [];
  const initialPlayer2Hand: SnsCard[] = [];
  const initialMiddleCards: SnsCard[] = [];

  for (let i = 0; i < 4; i++) {
    if (serverDeck.length > 0) initialPlayer1Hand.push(serverDeck.pop()!);
    if (serverDeck.length > 0) initialPlayer2Hand.push(serverDeck.pop()!);
  }

  for (let i = 0; i < 4; i++) {
    if (serverDeck.length > 0) initialMiddleCards.push(serverDeck.pop()!);
  }

  console.log('[createNewSetAndSeizeGame] Player 1 Hand before state creation:', initialPlayer1Hand.map(c => c.id));
  console.log('[createNewSetAndSeizeGame] Player 2 Hand before state creation:', initialPlayer2Hand.map(c => c.id));
  const player1State = { ...initializePlayerForSnsServer(player1Socket.id), hand: initialPlayer1Hand };
  const player2State = { ...initializePlayerForSnsServer(player2Socket.id), hand: initialPlayer2Hand };

  const initialSnsGameState: SnsGameState = {
    id: roomId,
    deck: serverDeck,
    players: [player1State, player2State],
    middleCards: initialMiddleCards,
    currentPlayerId: player1Socket.id,
    gamePhase: 'playing',
    lastCapturePlayerId: null,
    gameEnded: false,
    gameResult: null,
  };

  const room: SnsGameRoom = {
    id: roomId,
    players: [
      { socketId: player1Socket.id, playerNumber: 1 },
      { socketId: player2Socket.id, playerNumber: 2 }
    ],
    snsGameState: initialSnsGameState,
    turnTimerDuration: 30000,
  };

  snsRooms.set(roomId, room);
  player1Socket.join(roomId);
  player2Socket.join(roomId);

  console.log(`Set & Seize game room ${roomId} created for ${player1Socket.id} and ${player2Socket.id}`);
  return room;
};

const initializePlayerForServer = (id: string): Player => ({
  id,
  hands: Array(5).fill(null).map(() => ({ cards: Array(5).fill(null) } as Hand)),
});

const createNewGame = (player1Socket: Socket, player2Socket: Socket): GameRoom => {
  const roomId = `game_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  let player1ServerObj = initializePlayerForServer(player1Socket.id);
  let player2ServerObj = initializePlayerForServer(player2Socket.id);
  let serverDeck = shuffleDeck(createDeck());

  // Helper function to deal initial cards on server
  const dealInitialCardsServer = (player: Player, currentDeck: Card[]): { updatedPlayer: Player, updatedDeck: Card[] } => {
    const updatedPlayerHands = player.hands.map((hand: Hand) => {
      const cardToDeal = currentDeck.pop();
      // Ensure cards dealt initially are not hidden
      const dealtCard = cardToDeal ? { ...cardToDeal, hidden: false } : null;
      return dealtCard ? { ...hand, cards: [dealtCard, null, null, null, null] } : hand;
    });
    return { updatedPlayer: { ...player, hands: updatedPlayerHands }, updatedDeck: currentDeck };
  };

  const p1Result = dealInitialCardsServer(player1ServerObj, serverDeck);
  player1ServerObj = p1Result.updatedPlayer;
  serverDeck = p1Result.updatedDeck;
  const p2Result = dealInitialCardsServer(player2ServerObj, serverDeck);
  player2ServerObj = p2Result.updatedPlayer;
  serverDeck = p2Result.updatedDeck;

  const initialGameState: GameState = {
    id: roomId,
    deck: serverDeck,
    players: [player1ServerObj, player2ServerObj],
    currentPlayerId: player1Socket.id, // Player 1 (first to connect to match) starts
    gamePhase: 'playing', // Start directly in playing phase after initial deal
    turnNumber: 0,
    placementRuleActive: true,
    heldCard: null,
  };

  const room: GameRoom = {
    id: roomId,
    players: [
      { socketId: player1Socket.id, playerNumber: 1 },
      { socketId: player2Socket.id, playerNumber: 2 }
    ],
    gameState: initialGameState,
    turnTimerDuration: 30000, // 30 seconds
  };

  rooms.set(roomId, room);
  player1Socket.join(roomId);
  player2Socket.join(roomId);

  console.log(`Game room ${roomId} created for ${player1Socket.id} and ${player2Socket.id}`);
  return room;
};

// Serve static files from the Vite build output directory
// __dirname here is /opt/render/project/dist/server/server
// We need to go up three levels to /opt/render/project/ and then into /dist
app.use(express.static(path.join(__dirname, '../../../dist')));

// SPA Fallback: For any GET request that doesn't match a static file or API route,
// serve the index.html file. This is crucial for client-side routing.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../dist', 'index.html'));
});

const clearTurnTimer = (room: GameRoom) => {
  if (room.turnTimerId) {
    console.log(`[clearTurnTimer] Clearing timer for room ${room.id}, player ${room.gameState.currentPlayerId}`);
    clearTimeout(room.turnTimerId);
    delete room.turnTimerId;
  } else {
    console.log(`[clearTurnTimer] No active timer found for room ${room.id}`);
  }
  delete room.gameState.turnStartTime;
  delete room.gameState.turnTimerEndsAt;
};

const startTurnTimer = (room: GameRoom) => {
  clearTurnTimer(room); // Clear any existing timer first

  if (room.gameState.gamePhase !== 'playing' || !room.gameState.currentPlayerId) {
    return; // Don't start timer if game is not in playing phase or no current player
  }

  const currentPlayerSocketId = room.gameState.currentPlayerId;
  room.gameState.turnStartTime = Date.now();
  room.gameState.turnTimerEndsAt = Date.now() + room.turnTimerDuration;

  console.log(`Starting turn timer (${room.turnTimerDuration / 1000}s) for player ${currentPlayerSocketId} in room ${room.id}`);

  room.turnTimerId = setTimeout(() => {
    if (!rooms.has(room.id) || room.gameState.currentPlayerId !== currentPlayerSocketId) {
      console.log(`[startTurnTimer] Timer callback for room ${room.id} aborted: room no longer exists or current player changed.`);
      return;
    }
    console.log(`[startTurnTimer] Turn timer expired for player ${currentPlayerSocketId} in room ${room.id}`);

    const timedOutPlayerSocket = pokerIo.sockets.sockets.get(currentPlayerSocketId);
    if (timedOutPlayerSocket) {
      timedOutPlayerSocket.emit('kickedDueToTimeout', { gameId: room.id, playerId: currentPlayerSocketId, message: 'You were kicked for inactivity.' });
      timedOutPlayerSocket.disconnect(true); // Disconnect the timed-out player
    }

    const otherPlayer = room.players.find((p: RoomPlayerInfo) => p.socketId !== currentPlayerSocketId);
    if (otherPlayer) {
      pokerIo.to(otherPlayer.socketId).emit('opponentDisconnected', 'Your opponent was kicked for inactivity. Game over.');
    }

    clearTurnTimer(room);
    rooms.delete(room.id);
    console.log(`Brazilian Poker Room ${room.id} closed due to player timeout.`);

  }, room.turnTimerDuration);

  pokerIo.to(room.id).emit('gameStateUpdate', room.gameState);
};

pokerIo.on('connection', (socket) => {
  console.log('A user connected to Brazilian Poker:', socket.id);

  socket.on('findMatch', () => {
    console.log(`Player ${socket.id} is looking for a Brazilian Poker match.`);

    // --- BEGIN MODIFICATION: Proactively clean up player's old sessions ---
    // Remove from queue if present
    const queueIndex = matchmakingQueue.findIndex((s: Socket) => s.id === socket.id);
    if (queueIndex !== -1) {
      matchmakingQueue.splice(queueIndex, 1);
      console.log(`Player ${socket.id} removed from matchmaking queue before new findMatch.`);
    }

    // Remove from any existing room
    for (const [roomId, room] of rooms.entries()) {
      const playerInRoom = room.players.find((p: RoomPlayerInfo) => p.socketId === socket.id);
      if (playerInRoom) {
        console.log(`Player ${socket.id} was in room ${roomId}. Cleaning up before new findMatch.`);
        clearTurnTimer(room); // Clear any active timer for that room
        
        // Notify other player in that old room, if any, that their opponent left for a new game
        const otherPlayer = room.players.find((p: RoomPlayerInfo) => p.socketId !== socket.id);
        if (otherPlayer && pokerIo.sockets.sockets.get(otherPlayer.socketId)) {
          pokerIo.to(otherPlayer.socketId).emit('opponentDisconnected', 'Your opponent left to find a new game.');
        }
        rooms.delete(roomId);
        console.log(`Room ${roomId} closed because player ${socket.id} started a new match search.`);
        // No need to break here, though a player should only be in one room.
      }
    }
    // --- END MODIFICATION ---

    // Ensure player is not already in queue or a game (this check might seem redundant now, but good for sanity)
    // Note: The previous cleanup should handle most cases. This check remains as a safeguard.
    if (matchmakingQueue.find((s: Socket) => s.id === socket.id) || Array.from(rooms.values()).find((r: GameRoom) => r.players.some((p: RoomPlayerInfo) => p.socketId === socket.id))) {
      console.warn(`Player ${socket.id} still found in queue/game after cleanup attempt. Emitting error.`);
      socket.emit('error', 'Already in queue or game. Cleanup might have failed.');
      return;
    }

    matchmakingQueue.push(socket);

    if (matchmakingQueue.length >= 2) {
      const player1 = matchmakingQueue.shift()!;
      const player2 = matchmakingQueue.shift()!;

      const room = createNewGame(player1, player2);

      // Notify players about the game start
      pokerIo.to(room.id).emit('gameStart', room.gameState);
      startTurnTimer(room);
    } else {
      socket.emit('message', 'Waiting for another player...');
    }
  });
});

const clearSnsTurnTimer = (room: SnsGameRoom) => {
  if (room.turnTimerId) {
    console.log(`[clearSnsTurnTimer] Clearing timer for room ${room.id}, player ${room.snsGameState.currentPlayerId}`);
    clearTimeout(room.turnTimerId);
    delete room.turnTimerId;
  } else {
    console.log(`[clearSnsTurnTimer] No active timer found for room ${room.id}`);
  }
  delete room.snsGameState.turnStartTime;
  delete room.snsGameState.turnTimerEndsAt;
};

const startSnsTurnTimer = (room: SnsGameRoom) => {
  clearSnsTurnTimer(room); // Clear any existing timer first

  if (room.snsGameState.gamePhase !== 'playing' || !room.snsGameState.currentPlayerId) {
    return; // Don't start timer if game is not in playing phase or no current player
  }

  const currentPlayerSocketId = room.snsGameState.currentPlayerId;
  room.snsGameState.turnStartTime = Date.now();
  room.snsGameState.turnTimerEndsAt = Date.now() + room.turnTimerDuration;

  console.log(`Starting Set & Seize turn timer (${room.turnTimerDuration / 1000}s) for player ${currentPlayerSocketId} in room ${room.id}`);

  room.turnTimerId = setTimeout(() => {
    if (!snsRooms.has(room.id) || room.snsGameState.currentPlayerId !== currentPlayerSocketId) {
      console.log(`[startSnsTurnTimer] Timer callback for room ${room.id} aborted: room no longer exists or current player changed.`);
      return;
    }
    console.log(`[startSnsTurnTimer] Set & Seize Turn timer expired for player ${currentPlayerSocketId} in room ${room.id}. Kicking player.`);

    const timedOutPlayerSocket = setAndSeizeIo.sockets.sockets.get(currentPlayerSocketId);
    if (timedOutPlayerSocket) {
      timedOutPlayerSocket.emit('snsKickedDueToTimeout', { gameId: room.id, playerId: currentPlayerSocketId, message: 'You were kicked for inactivity.' });
      timedOutPlayerSocket.disconnect(true);
    }

    const otherPlayer = room.players.find((p: RoomPlayerInfo) => p.socketId !== currentPlayerSocketId);
    if (otherPlayer) {
      setAndSeizeIo.to(otherPlayer.socketId).emit('snsOpponentDisconnected', 'Your opponent was kicked for inactivity. Game over.');
    }

    clearSnsTurnTimer(room);
    snsRooms.delete(room.id);
    console.log(`Set & Seize Room ${room.id} closed due to player timeout.`);

  }, room.turnTimerDuration);
  const gameStateToSendUpdate = JSON.parse(JSON.stringify(room.snsGameState));
  console.log(`[startSnsTurnTimer] Emitting snsGameStateUpdate for room ${room.id}. Player hands:`, gameStateToSendUpdate.players.map(p => ({ id: p.id, handSize: p.hand.length, hand: p.hand.map(c => c.id) })));
  setAndSeizeIo.to(room.id).emit('snsGameStateUpdate', gameStateToSendUpdate);
};

const calculateSetAndSeizeScores = (room: SnsGameRoom) => {
  console.log(`Calculating Set & Seize scores for game ${room.id}`);
  const calculatePlayerPoints = (collectedCards: SnsCard[]): number => {
    let points = 0;
    collectedCards.forEach(card => {
      if (card.rank === 'A') {
        points += 1;
      }
      if (card.rank === '2' && card.suit === 'S') {
        points += 1;
      }
      if (card.rank === 'T' && card.suit === 'D') {
        points += 2;
      }
    });
    return points;
  };

  const player1State = room.snsGameState.players[0];
  const player2State = room.snsGameState.players[1];

  let player1Score = calculatePlayerPoints(player1State.collectedCards);
  let player2Score = calculatePlayerPoints(player2State.collectedCards);

  const player1Spades = player1State.collectedCards.filter(card => card.suit === 'S').length;
  const player2Spades = player2State.collectedCards.filter(card => card.suit === 'S').length;

  if (player1Spades > player2Spades) {
    player1Score += 1;
  } else if (player2Spades > player1Spades) {
    player2Score += 1;
  }

  const player1TotalCards = player1State.collectedCards.length;
  const player2TotalCards = player2State.collectedCards.length;

  if (player1TotalCards > player2TotalCards) {
    player1Score += 3;
  } else if (player2TotalCards > player1TotalCards) {
    player2Score += 3;
  }

  let winner: 'player' | 'ai' | 'draw' | null = null;
  if (player1Score > player2Score) {
    winner = 'player';
  } else if (player2Score > player1Score) {
    winner = 'ai';
  } else {
    winner = 'draw';
  }

  room.snsGameState.gameResult = {
    winner,
    playerScore: player1Score,
    aiScore: player2Score,
  };

  console.log(`Set & Seize Game Over! Player 1 Score: ${player1Score}, Player 2 Score: ${player2Score}. Winner: ${winner}`);
};

const handleGameEvaluation = (room: GameRoom) => {
  clearTurnTimer(room);
  console.log(`Evaluating game ${room.id}`);
  const playersWithRevealedCards = room.gameState.players.map((player: Player) => ({
    ...player,
    hands: player.hands.map((hand: Hand) => ({
      ...hand,
      cards: hand.cards.map((card: Card | null) => card ? { ...card, hidden: false } : null)
    }))
  }));

  const handEvalResults: { p1Wins: number; p2Wins: number; individualWinners: (string | null)[] } = {
    p1Wins: 0,
    p2Wins: 0,
    individualWinners: Array(5).fill(null),
  };

  type PlayerWithEvaluatedHands = Player & { hands: (Hand & { evaluation?: EvaluatedHand | null })[] };

  const finalPlayerStates: PlayerWithEvaluatedHands[] = playersWithRevealedCards.map((p: Player): PlayerWithEvaluatedHands => ({
    ...p,
    hands: p.hands.map((h: Hand) => ({ ...h, evaluation: evaluateHand(h.cards) }))
  }));


  for (let i = 0; i < 5; i++) {
    const evalP1 = finalPlayerStates[0].hands[i].evaluation;
    const evalP2 = finalPlayerStates[1].hands[i].evaluation;

    if (evalP1 && evalP2) {
      const comparison = compareEvaluatedHands(evalP1, evalP2);
      if (comparison > 0) {
        handEvalResults.p1Wins++;
        handEvalResults.individualWinners[i] = finalPlayerStates[0].id;
      } else if (comparison < 0) {
        handEvalResults.p2Wins++;
        handEvalResults.individualWinners[i] = finalPlayerStates[1].id;
      } else {
        handEvalResults.individualWinners[i] = 'Tie';
      }
    } else if (evalP1) { handEvalResults.p1Wins++; handEvalResults.individualWinners[i] = finalPlayerStates[0].id; }
    else if (evalP2) { handEvalResults.p2Wins++; handEvalResults.individualWinners[i] = finalPlayerStates[1].id; }
  }

  let overallWinnerMsg = "Game Over! ";
  if (handEvalResults.p1Wins > handEvalResults.p2Wins) {
    overallWinnerMsg += `${finalPlayerStates[0].id} wins the game (${handEvalResults.p1Wins} to ${handEvalResults.p2Wins})!`;
  } else if (handEvalResults.p2Wins > handEvalResults.p1Wins) {
    overallWinnerMsg += `${finalPlayerStates[1].id} wins the game (${handEvalResults.p2Wins} to ${handEvalResults.p1Wins})!`;
  } else {
    overallWinnerMsg += `It's a tie overall! (${handEvalResults.p1Wins} to ${handEvalResults.p2Wins})`;
  }

  room.gameState.players = finalPlayerStates;
  room.gameState.gamePhase = 'gameOver';
  room.gameState.winnerMessage = overallWinnerMsg;
  room.gameState.individualHandWinners = handEvalResults.individualWinners;

  pokerIo.to(room.id).emit('gameStateUpdate', room.gameState);
  console.log(`Game ${room.id} ended. Winner: ${overallWinnerMsg}.`);

  setTimeout(() => {
    if (rooms.has(room.id)) {
      rooms.delete(room.id);
      console.log(`[handleGameEvaluation] Room ${room.id} closed after game over.`);
    } else {
      console.log(`[handleGameEvaluation] Room ${room.id} already deleted, no action needed.`);
    }
  }, 5000);
};

const canPlaceCardInHandServer = (player: Player, handIndex: number, targetSlot: number): boolean => {
  if (targetSlot < 0 || targetSlot > 4) return false;
  const cardCounts = player.hands.map((h: Hand) => h.cards.filter((c: Card | null) => c !== null).length);
  const cardsInTargetHandCurrently = cardCounts[handIndex];

  if (cardsInTargetHandCurrently !== targetSlot) {
    console.error(`Server validation: Mismatch between targetSlot (${targetSlot}) and actual empty slot count (${cardsInTargetHandCurrently}) in hand ${handIndex} for player ${player.id}.`);
    return false;
  }
  const numCardsTargetHandWillHave = cardsInTargetHandCurrently + 1;

  if (numCardsTargetHandWillHave === 3) {
    return player.hands.every((h: Hand) => h.cards.filter((c: Card | null) => c !== null).length >= 2);
  }
  if (numCardsTargetHandWillHave === 4) {
    return player.hands.every((h: Hand) => h.cards.filter((c: Card | null) => c !== null).length >= 3);
  }
  if (numCardsTargetHandWillHave === 5) {
    return player.hands.every((h: Hand) => h.cards.filter((c: Card | null) => c !== null).length >= 4);
  }
  return true;
};
// });


pokerIo.on('disconnect', (socket) => {
  console.log('User disconnected from Brazilian Poker:', socket.id);
  const queueIndex = matchmakingQueue.findIndex((s: Socket) => s.id === socket.id);
  if (queueIndex !== -1) {
    matchmakingQueue.splice(queueIndex, 1);
    console.log(`Player ${socket.id} removed from Brazilian Poker matchmaking queue.`);
  }

  for (const [roomId, room] of rooms.entries()) {
    const playerInRoom = room.players.find((p: RoomPlayerInfo) => p.socketId === socket.id);
    if (playerInRoom) {
      console.log(`[pokerIo disconnect] Player ${socket.id} disconnected from Brazilian Poker room ${roomId}. Rooms before delete: ${Array.from(rooms.keys())}`);
      clearTurnTimer(room);

      const otherPlayer = room.players.find((p: RoomPlayerInfo) => p.socketId !== socket.id);
      if (otherPlayer) {
        pokerIo.to(otherPlayer.socketId).emit('opponentDisconnected', 'Your opponent has disconnected. Game over.');
      }
      rooms.delete(roomId);
      console.log(`[pokerIo disconnect] Brazilian Poker Room ${roomId} closed due to disconnect. Rooms after delete: ${Array.from(rooms.keys())}`);
      break;
    }
  }
});

setAndSeizeIo.on('connection', (socket) => {
  console.log('A user connected to Set & Seize:', socket.id);

  socket.on('findSetAndSeizeMatch', () => {
    console.log(`Player ${socket.id} is looking for a Set & Seize match.`);

    // Proactively clean up player's old sessions for Set & Seize
    const queueIndex = matchmakingQueueSns.findIndex((s: Socket) => s.id === socket.id);
    if (queueIndex !== -1) {
      matchmakingQueueSns.splice(queueIndex, 1);
      console.log(`Player ${socket.id} removed from Set & Seize matchmaking queue before new findSetAndSeizeMatch.`);
    }

    for (const [roomId, room] of snsRooms.entries()) {
      const playerInRoom = room.players.find((p: RoomPlayerInfo) => p.socketId === socket.id);
      if (playerInRoom) {
        console.log(`Player ${socket.id} was in Set & Seize room ${roomId}. Cleaning up before new findSetAndSeizeMatch.`);
        clearSnsTurnTimer(room);
        const otherPlayer = room.players.find((p: RoomPlayerInfo) => p.socketId !== socket.id);
        if (otherPlayer && setAndSeizeIo.sockets.sockets.get(otherPlayer.socketId)) {
          setAndSeizeIo.to(otherPlayer.socketId).emit('snsOpponentDisconnected', 'Your opponent left to find a new game.');
        }
        snsRooms.delete(roomId);
        console.log(`Set & Seize Room ${roomId} closed because player ${socket.id} started a new match search.`);
      }
    }

    if (matchmakingQueueSns.find((s: Socket) => s.id === socket.id) || Array.from(snsRooms.values()).find((r: SnsGameRoom) => r.players.some((p: RoomPlayerInfo) => p.socketId === socket.id))) {
      console.warn(`Player ${socket.id} still found in Set & Seize queue/game after cleanup attempt. Emitting error.`);
      socket.emit('error', 'Already in queue or game. Cleanup might have failed.');
      return;
    }

    matchmakingQueueSns.push(socket);

    if (matchmakingQueueSns.length >= 2) {
      const player1 = matchmakingQueueSns.shift()!;
      const player2 = matchmakingQueueSns.shift()!;

      const room = createNewSetAndSeizeGame(player1, player2);

      const gameStateToSendStart = JSON.parse(JSON.stringify(room.snsGameState)); // Deep clone
      console.log(`[findSetAndSeizeMatch] Emitting snsGameStart for room ${room.id}. Player hands:`, gameStateToSendStart.players.map(p => ({ id: p.id, handSize: p.hand.length, hand: p.hand.map(c => c.id) })));
      setAndSeizeIo.to(room.id).emit('snsGameStart', gameStateToSendStart);
      startSnsTurnTimer(room);
    } else {
      socket.emit('snsMessage', 'Waiting for another player for Set & Seize...');
    }
  });

  socket.on('snsPlayCard', ({ gameId, playerId, cardToPlay, actionType, targetCard, buildType, selectedMiddleItems }: {
    gameId: string;
    playerId: string;
    cardToPlay: SnsCard;
    actionType: 'drop' | 'capture' | 'build';
    targetCard?: SnsCard;
    buildType?: 'soft-build' | 'hard-build';
    selectedMiddleItems?: (SnsCard | SnsBuild)[];
  }) => {
    const room = snsRooms.get(gameId);
    if (!room || room.snsGameState.currentPlayerId !== playerId) {
      socket.emit('snsError', 'Invalid action or not your turn.');
      return;
    }

    const currentPlayerState = room.snsGameState.players.find(p => p.id === playerId);
    if (!currentPlayerState) {
      socket.emit('snsError', 'Player state not found.');
      return;
    }

    // Helper to flatten selected items (cards or builds) into individual cards
    const getIndividualCardsFromSelection = (items: (SnsCard | SnsBuild)[]): SnsCard[] => {
      return items.flatMap(item => 'cards' in item ? item.cards : item);
    };

    // Enforce "Must Capture" rule
    if (currentPlayerState.mustCapture) {
      if (actionType === 'capture') {
        // Allowed to capture
        console.log(`${playerId} is fulfilling 'Must Capture' rule with a capture.`);
      } else if (actionType === 'build' && targetCard && currentPlayerState.lastBuildValue !== null) {
        const newBuildValue = getRankValue(targetCard.rank);
        if (newBuildValue === currentPlayerState.lastBuildValue) {
          // Exception: Allowed to build if the new build value matches the last build value
          console.log(`${playerId} is fulfilling 'Must Capture' exception by building same value (${newBuildValue}).`);
        } else {
          console.log(`Invalid move: ${playerId} must capture or build same value (${currentPlayerState.lastBuildValue}) after a build. Tried to build ${newBuildValue}.`);
          socket.emit('snsError', `Must capture or build same value (${currentPlayerState.lastBuildValue})`);
          return;
        }
      } else {
        console.log(`Invalid move: ${playerId} must capture after a build. Tried to ${actionType}.`);
        socket.emit('snsError', 'Must capture after a build.');
        return;
      }
    }

    // Remove card from player's hand
    const cardIndexInHand = currentPlayerState.hand.findIndex(c => c.id === cardToPlay.id);
    if (cardIndexInHand === -1) {
      socket.emit('snsError', 'Card not found in hand.');
      return;
    }
    currentPlayerState.hand.splice(cardIndexInHand, 1);

    clearSnsTurnTimer(room); // Player made an action, clear their current turn timer

    if (actionType === 'drop') {
      room.snsGameState.middleCards.push(cardToPlay);
      console.log(`${playerId} drops ${cardToPlay.rank}${cardToPlay.suit}`);
      currentPlayerState.mustCapture = false;
      currentPlayerState.lastBuildValue = null;
      currentPlayerState.justMadeBuild = false;
    } else if (actionType === 'capture') {
      if (!selectedMiddleItems || selectedMiddleItems.length === 0) {
        socket.emit('snsError', 'No middle cards selected for capture.');
        return;
      }

      const middleCardsToCapture = getIndividualCardsFromSelection(selectedMiddleItems);
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
        const allGroupMembers = room.snsGameState.middleCards.filter(
          (mItem): mItem is SnsBuild =>
            'isHard' in mItem && mItem.isHard && mItem.hardBuildGroupId === groupId
        );
        const allMembersSelected = allGroupMembers.every(member =>
          selectedIndividualHardBuilds.has(member.id)
        );
        if (!allMembersSelected) {
          socket.emit('snsError', "Invalid capture: Partial hard build selected.");
          return;
        }
      }

      const handCardPossibleValues = getCardPossibleValues(cardToPlay);
      let isValidCapture = false;
      for (const handValue of handCardPossibleValues) {
        const initialUsedIndices = new Array(middleCardsToCapture.length).fill(false);
        if (canAllCardsBePartitioned(handValue, middleCardsToCapture, initialUsedIndices)) {
          isValidCapture = true;
          break;
        }
      }

      if (!isValidCapture) {
        socket.emit('snsError', "Invalid capture: Selected middle cards do not sum up to the played card's value.");
        return;
      }

      console.log(`${playerId} captures with ${cardToPlay.rank}${cardToPlay.suit} and target cards:`, selectedMiddleItems.map(i => i.id));

      currentPlayerState.collectedCards.push(cardToPlay, ...middleCardsToCapture);
      room.snsGameState.middleCards = room.snsGameState.middleCards.filter(item => !selectedMiddleItems.some(selectedItem => selectedItem.id === item.id));
      room.snsGameState.lastCapturePlayerId = playerId;
      currentPlayerState.mustCapture = false;
      currentPlayerState.lastBuildValue = null;
      currentPlayerState.justMadeBuild = false;

      // If a capture happened, the mustCapture rule ends for the *other* player if they had it.
      const otherPlayerState = room.snsGameState.players.find(p => p.id !== playerId);
      if (otherPlayerState) {
        otherPlayerState.mustCapture = false;
        otherPlayerState.lastBuildValue = null;
        otherPlayerState.justMadeBuild = false;
      }

    } else if (actionType === 'build' && targetCard) {
      if (!selectedMiddleItems || selectedMiddleItems.length === 0) {
        socket.emit('snsError', 'No middle cards selected for build.');
        return;
      }

      const middleCardsToBuild = getIndividualCardsFromSelection(selectedMiddleItems);
      const targetValue = getRankValue(targetCard.rank);

      if (buildType === 'soft-build') {
        const isBuildingOnHardBuildForSoft = selectedMiddleItems.some(item => 'isHard' in item && item.isHard);
        if (isBuildingOnHardBuildForSoft) {
          socket.emit('snsError', "Invalid soft build: Cannot soft build on a hard build.");
          return;
        }

        const handCardPossibleValues = getCardPossibleValues(cardToPlay);
        let isValidSoftBuild = false;
        for (const handValue of handCardPossibleValues) {
          const requiredSumFromMiddle = targetValue - handValue;
          if (requiredSumFromMiddle < 0) continue;

          const possibleMiddleSubsets = findAllSubsetsSummingToTarget(requiredSumFromMiddle, middleCardsToBuild);

          for (const subset of possibleMiddleSubsets) {
            if (subset.length === middleCardsToBuild.length &&
                subset.every(sCard => middleCardsToBuild.some(mCard => mCard.id === sCard.id))) {
              isValidSoftBuild = true;
              break;
            }
          }
          if (isValidSoftBuild) break;
        }

        if (!isValidSoftBuild) {
          socket.emit('snsError', "Invalid soft build: Selected cards do not sum up to the target value.");
          return;
        }
        console.log(`${playerId} performs a soft build with ${cardToPlay.rank}${cardToPlay.suit} onto`, selectedMiddleItems.map(i => i.id), `to target ${targetCard.rank}${targetCard.suit}`);

        const newBuild: SnsBuild = {
          id: `BUILD-${targetCard.id}-${Date.now()}`,
          cards: [cardToPlay, ...middleCardsToBuild],
          totalValue: targetValue,
          ownerId: playerId,
          isHard: false,
        };

        room.snsGameState.middleCards = room.snsGameState.middleCards.filter(item => !selectedMiddleItems.some(selectedItem => selectedItem.id === item.id));
        room.snsGameState.middleCards.push(newBuild);

        currentPlayerState.mustCapture = true;
        currentPlayerState.lastBuildValue = newBuild.totalValue;
        currentPlayerState.justMadeBuild = true;

      } else if (buildType === 'hard-build') {
        const selectedHardBuilds = selectedMiddleItems.filter((item): item is SnsBuild => 'isHard' in item && item.isHard);
        if (selectedHardBuilds.length > 0) {
          const allHardBuildsMatchTarget = selectedHardBuilds.every(build => build.totalValue === targetValue);
          if (!allHardBuildsMatchTarget) {
            socket.emit('snsError', "Invalid hard build: When building on existing hard builds, the new build's value must match the existing hard build's value.");
            return;
          }
        }

        const allPotentialBuildCards = [cardToPlay, ...middleCardsToBuild];
        const initialUsedIndices = new Array(allPotentialBuildCards.length).fill(false);
        const validHardBuilds = findMultipleDisjointBuilds(
          targetValue,
          allPotentialBuildCards,
          2,
          [],
          initialUsedIndices
        );

        if (!validHardBuilds) {
          socket.emit('snsError', "Invalid hard build: Selected cards do not form multiple builds for the target value.");
          return;
        }
        console.log(`${playerId} performs a hard build with ${cardToPlay.rank}${cardToPlay.suit} and selected cards:`, selectedMiddleItems.map(i => i.id), `to target ${targetCard.rank}${targetCard.suit}`);

        const opponentPlayerState = room.snsGameState.players.find(p => p.id !== playerId);
        if (opponentPlayerState) {
          selectedMiddleItems.forEach(item => {
            if ('isHard' in item && item.isHard && item.ownerId === opponentPlayerState.id) {
              console.log(`Opponent's (${opponentPlayerState.id}) hard build (${item.id}) was stack built. Resetting their mustCapture state.`);
              opponentPlayerState.mustCapture = false;
              opponentPlayerState.lastBuildValue = null;
              opponentPlayerState.justMadeBuild = false;
            }
          });
        }

        const hardBuildGroupId = `HARDBUILDGROUP-${Date.now()}`;
        const newBuilds: SnsBuild[] = validHardBuilds.map((buildCards, index) => ({
          id: `HARDBUILD-${targetCard.id}-${Date.now()}-${index}`,
          cards: buildCards,
          totalValue: targetValue,
          ownerId: playerId,
          isHard: true,
          hardBuildGroupId: hardBuildGroupId,
        }));

        const allCardsInNewBuilds = new Set<string>();
        newBuilds.forEach(build => {
          build.cards.forEach(card => allCardsInNewBuilds.add(card.id));
        });

        room.snsGameState.middleCards = room.snsGameState.middleCards.filter(item => {
          if ('id' in item && allCardsInNewBuilds.has(item.id)) {
            return false;
          }
          if ('cards' in item && selectedMiddleItems.some(selectedItem => selectedItem.id === item.id)) {
            return false;
          }
          return true;
        });

        room.snsGameState.middleCards.push(...newBuilds);

        currentPlayerState.mustCapture = true;
        currentPlayerState.lastBuildValue = targetValue;
        currentPlayerState.justMadeBuild = true;
      }
    }

    // Check if player's hand is empty, if so, deal new hands or end game
    if (currentPlayerState.hand.length === 0) {
      if (room.snsGameState.deck.length > 0) {
        // Deal 4 new cards to each player
        for (let i = 0; i < 4; i++) {
          const p1 = room.snsGameState.players[0];
          const p2 = room.snsGameState.players[1];
          if (room.snsGameState.deck.length > 0) p1.hand.push(room.snsGameState.deck.pop()!);
          if (room.snsGameState.deck.length > 0) p2.hand.push(room.snsGameState.deck.pop()!);
        }
        console.log(`Dealt new hands in room ${gameId}. Player 1 hand size: ${room.snsGameState.players[0].hand.length}, Player 2 hand size: ${room.snsGameState.players[1].hand.length}`);
      } else {
        // Game over logic: Deck is empty and no more cards to deal
        console.log('Set & Seize Deck is empty. Game Over!');
        room.snsGameState.gamePhase = 'gameOver';
        room.snsGameState.gameEnded = true;

        // Last player who captured gets middle cards
        if (room.snsGameState.lastCapturePlayerId) {
          const remainingMiddleCards = getIndividualCardsFromSelection(room.snsGameState.middleCards);
          const lastCollector = room.snsGameState.players.find(p => p.id === room.snsGameState.lastCapturePlayerId);
          if (lastCollector) {
            lastCollector.collectedCards.push(...remainingMiddleCards);
            console.log(`${lastCollector.id} collected remaining middle cards:`, remainingMiddleCards.map(c => c.id));
          }
          room.snsGameState.middleCards = []; // Clear middle cards
        }
        calculateSetAndSeizeScores(room); // Calculate scores when the game ends
        clearSnsTurnTimer(room); // Game is over, no more turns
      }
    }

    // Switch to next player if game is not over
    if (room.snsGameState.gamePhase === 'playing') {
      const currentPlayerIndex = room.players.findIndex((p: RoomPlayerInfo) => p.socketId === playerId);
      const nextPlayerIndex = (currentPlayerIndex + 1) % room.players.length;
      room.snsGameState.currentPlayerId = room.players[nextPlayerIndex].socketId;
      startSnsTurnTimer(room); // Start timer for the next player
    }

    const gameStateToSendPlayCard = JSON.parse(JSON.stringify(room.snsGameState)); // Deep clone
    console.log(`[snsPlayCard] Emitting snsGameStateUpdate for room ${gameId} after play. Player hands:`, gameStateToSendPlayCard.players.map(p => ({ id: p.id, handSize: p.hand.length, hand: p.hand.map(c => c.id) })));
    setAndSeizeIo.to(gameId).emit('snsGameStateUpdate', gameStateToSendPlayCard);
    console.log(`Player ${playerId} in room ${gameId} played card.`);
  });

  // Client sends its selected middle cards to the server for validation
  socket.on('snsSelectMiddleCard', ({ gameId, playerId, selectedItems }: { gameId: string, playerId: string, selectedItems: (SnsCard | SnsBuild)[] }) => {
    const room = snsRooms.get(gameId);
    if (!room || room.snsGameState.currentPlayerId !== playerId) {
      socket.emit('snsError', 'Invalid action or not your turn.');
      return;
    }
    // Store selected items on the server-side for validation during playCard
    const currentPlayerState = room.snsGameState.players.find(p => p.id === playerId);
    if (currentPlayerState) {
      // For now, we don't need to store this on the server's gameState,
      // as the client will send it with snsPlayCard.
      // However, if we wanted server to enforce selections, we'd store it here.
    }
  });

  // Client sends its selected player card to the server for validation
  socket.on('snsSelectPlayerCard', ({ gameId, playerId, card }: { gameId: string, playerId: string, card: SnsCard | null }) => {
    const room = snsRooms.get(gameId);
    if (!room || room.snsGameState.currentPlayerId !== playerId) {
      socket.emit('snsError', 'Invalid action or not your turn.');
      return;
    }
    // Similar to middle card selection, this is primarily for client-side state.
    // The actual card played will be sent with snsPlayCard.
  });
});

setAndSeizeIo.on('disconnect', (socket) => {
  console.log(`[setAndSeizeIo disconnect] User disconnected from Set & Seize: ${socket.id}. snsRooms before cleanup: ${Array.from(snsRooms.keys())}`);
  const snsQueueIndex = matchmakingQueueSns.findIndex((s: Socket) => s.id === socket.id);
  if (snsQueueIndex !== -1) {
    matchmakingQueueSns.splice(snsQueueIndex, 1);
    console.log(`[setAndSeizeIo disconnect] Player ${socket.id} removed from Set & Seize matchmaking queue.`);
  }

  for (const [roomId, room] of snsRooms.entries()) {
    const playerInRoom = room.players.find((p: RoomPlayerInfo) => p.socketId === socket.id);
    if (playerInRoom) {
      console.log(`[setAndSeizeIo disconnect] Player ${socket.id} disconnected from Set & Seize room ${roomId}.`);
      clearSnsTurnTimer(room);

      const otherPlayer = room.players.find((p: RoomPlayerInfo) => p.socketId !== socket.id);
      if (otherPlayer) {
        setAndSeizeIo.to(otherPlayer.socketId).emit('snsOpponentDisconnected', 'Your opponent has disconnected. Game over.');
      }
      snsRooms.delete(roomId);
      console.log(`[setAndSeizeIo disconnect] Set & Seize Room ${roomId} closed due to disconnect. snsRooms after delete: ${Array.from(snsRooms.keys())}`);
      break;
    }
  }
});

setAndSeizeServer.listen(SNS_PORT, () => {
  console.log(`Set & Seize Server listening on port ${SNS_PORT}`);
});

pokerServer.listen(POKER_PORT, () => {
  console.log(`Brazilian Poker Server listening on port ${POKER_PORT}`);
});

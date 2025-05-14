// server/index.ts
import express from 'express';
import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { GameState, Player, Card, Hand, EvaluatedHand } from '../src/types/index.js'; // Assuming types can be shared
import { createDeck, shuffleDeck } from '../src/lib/utils.js'; // Assuming utils can be shared
import { evaluateHand, compareEvaluatedHands } from '../src/lib/pokerEvaluator.js'; // Assuming evaluator can be shared
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();

// ES Module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "*", // Allow all origins for Glitch simplicity
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

const REMATCH_WINDOW_MS = 10000; // 10 seconds for rematch window

interface RoomPlayerInfo {
  socketId: string;
  playerNumber: 1 | 2;
}

interface GameRoom {
  id: string;
  players: RoomPlayerInfo[];
  gameState: GameState;
  rematchInfo?: {
    requests: { [socketId: string]: boolean }; // Tracks which player(s) requested a rematch
    agreedCount: number;
    offerTimestamp: number; // When the 10s window started
    timerId?: NodeJS.Timeout; // Server-side timer for cleanup
  };
  turnTimerId?: NodeJS.Timeout; // Timer for the current player's turn
  turnTimerDuration: number; // Duration of the turn in ms
}

const rooms = new Map<string, GameRoom>();
const matchmakingQueue: Socket[] = [];

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

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  const clearTurnTimer = (room: GameRoom) => {
    if (room.turnTimerId) {
      clearTimeout(room.turnTimerId);
      delete room.turnTimerId;
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
        // Room might have been deleted or player changed due to other actions
        return;
      }
      console.log(`Turn timer expired for player ${currentPlayerSocketId} in room ${room.id}`);

      const timedOutPlayerSocket = io.sockets.sockets.get(currentPlayerSocketId);
      if (timedOutPlayerSocket) {
        timedOutPlayerSocket.emit('turnTimeout', { gameId: room.id, playerId: currentPlayerSocketId });
        // Client will handle redirect to homepage. Server just moves to next player.
      }

      // Switch to next player
      const currentPlayerIndex = room.players.findIndex((p: RoomPlayerInfo) => p.socketId === currentPlayerSocketId);
      const nextPlayerIndex = (currentPlayerIndex + 1) % room.players.length;
      room.gameState.currentPlayerId = room.players[nextPlayerIndex].socketId;
      room.gameState.turnNumber++; // Increment turn number
      room.gameState.heldCard = null; // Ensure no card is held by the new current player initially

      console.log(`Switched to player ${room.gameState.currentPlayerId} due to timeout in room ${room.id}`);

      startTurnTimer(room); // Start timer for the new player

      io.to(room.id).emit('gameStateUpdate', room.gameState);

    }, room.turnTimerDuration);

    // Broadcast the updated game state so clients know about the timer
    io.to(room.id).emit('gameStateUpdate', room.gameState);
  };

  const clearRoomRematchTimer = (room: GameRoom) => {
    if (room.rematchInfo?.timerId) {
      clearTimeout(room.rematchInfo.timerId);
      delete room.rematchInfo.timerId;
    }
  };

  socket.on('findMatch', () => {
    console.log(`Player ${socket.id} is looking for a match.`);
    // Ensure player is not already in queue or a game
    if (matchmakingQueue.find((s: Socket) => s.id === socket.id) || Array.from(rooms.values()).find((r: GameRoom) => r.players.some((p: RoomPlayerInfo) => p.socketId === socket.id))) {
      socket.emit('error', 'Already in queue or game.');
      return;
    }

    matchmakingQueue.push(socket);

    if (matchmakingQueue.length >= 2) {
      const player1 = matchmakingQueue.shift()!;
      const player2 = matchmakingQueue.shift()!;

      const room = createNewGame(player1, player2);

      // Notify players about the game start
      io.to(room.id).emit('gameStart', room.gameState);
      startTurnTimer(room); // Start timer for the first player
      // player1.emit('assignPlayerId', player1.id); // Client already uses socket.id
      // player2.emit('assignPlayerId', player2.id);
    } else {
      socket.emit('message', 'Waiting for another player...');
    }
  });

  socket.on('drawCard', ({ gameId, playerId }: { gameId: string, playerId: string }) => {
    const room = rooms.get(gameId);
    if (!room || room.gameState.currentPlayerId !== playerId || room.gameState.heldCard) {
      socket.emit('error', 'Invalid action or not your turn or card already held.');
      return;
    }
    if (room.gameState.deck.length === 0) {
        socket.emit('error', 'Deck is empty.');
        return;
    }
    // clearTurnTimer(room); // Pause timer while card is held <-- REMOVED THIS LINE

    const drawnCard = room.gameState.deck.pop()!;
    room.gameState.heldCard = drawnCard;

    // Notify only the current player about the card they drew
    socket.emit('playerDrewCard', { card: drawnCard });
    // Broadcast updated game state (deck change, heldCard status for current player)
    // For simplicity, we can send the whole state, or specific updates.
    // To hide heldCard from opponent, we need to send tailored states.

    // Send full state to current player
    socket.emit('gameStateUpdate', room.gameState);
    // Send state to opponent, masking current player's held card
    const opponentSocketId = room.players.find((p: RoomPlayerInfo) => p.socketId !== playerId)?.socketId;
    if (opponentSocketId) {
        const opponentGameState = JSON.parse(JSON.stringify(room.gameState));
        if (opponentGameState.currentPlayerId === playerId) {
            opponentGameState.heldCard = null; // Mask for opponent
        }
        io.to(opponentSocketId).emit('gameStateUpdate', opponentGameState);
    }
    console.log(`Player ${playerId} in room ${gameId} drew ${drawnCard.id}`);
  });

  socket.on('placeCard', ({ gameId, playerId, handIndex, card }: { gameId: string, playerId: string, handIndex: number, card: Card }) => {
    const room = rooms.get(gameId);
    if (!room || room.gameState.currentPlayerId !== playerId || !room.gameState.heldCard || room.gameState.heldCard.id !== card.id) {
      socket.emit('error', 'Invalid action, not your turn, or card mismatch.');
      return;
    }
    clearTurnTimer(room); // Player made an action, clear their current turn timer

    const playerState = room.gameState.players.find((p: Player) => p.id === playerId);
    if (!playerState) return;

    const targetHand = playerState.hands[handIndex];
    if (!targetHand) {
        socket.emit('error', "Invalid hand index."); return;
    }
    const firstEmptySlot = targetHand.cards.findIndex((c: Card | null) => c === null);

    if (firstEmptySlot === -1) {
        socket.emit('error', "Hand is full."); return;
    }

    // Server-side validation of placement
    if (!canPlaceCardInHandServer(playerState, handIndex, firstEmptySlot)) {
      socket.emit('error', "Placement restriction: Cannot place card in this hand yet.");
      return;
    }

    targetHand.cards[firstEmptySlot] = card;
    if (firstEmptySlot === 4) {
      targetHand.cards[firstEmptySlot]!.hidden = true;
    }
    room.gameState.heldCard = null;

    // Check for game end
    const allHandsFull = room.gameState.players.every((p: Player) =>
      p.hands.every((h: Hand) => h.cards.filter((c: Card | null) => c !== null).length === 5)
    );

    if (allHandsFull) {
      room.gameState.gamePhase = 'evaluation';
      clearTurnTimer(room); // Game is over, no more turns
    } else {
      const currentPlayerIndex = room.players.findIndex((p: RoomPlayerInfo) => p.socketId === playerId);
      room.gameState.currentPlayerId = room.players[(currentPlayerIndex + 1) % room.players.length].socketId;
      room.gameState.turnNumber++;
      startTurnTimer(room); // Start timer for the next player
    }

    io.to(gameId).emit('gameStateUpdate', room.gameState); // This will now include timer info if a new turn started
    console.log(`Player ${playerId} in room ${gameId} placed ${card.id} in hand ${handIndex}`);

    if (room.gameState.gamePhase === 'evaluation') {
        // Trigger evaluation directly or emit an event for it
        handleGameEvaluation(room);
    }
  });

  const handleGameEvaluation = (room: GameRoom) => {
    clearTurnTimer(room); // Ensure no turn timer is running during evaluation/game over
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

      // Define a type for player with evaluated hands
      type PlayerWithEvaluatedHands = Player & { hands: (Hand & { evaluation?: EvaluatedHand | null })[] };

      const finalPlayerStates: PlayerWithEvaluatedHands[] = playersWithRevealedCards.map((p: Player): PlayerWithEvaluatedHands => ({
          ...p,
          hands: p.hands.map((h: Hand) => ({...h, evaluation: evaluateHand(h.cards)}))
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
        } else if (evalP1) { handEvalResults.p1Wins++; handEvalResults.individualWinners[i] = finalPlayerStates[0].id;}
          else if (evalP2) { handEvalResults.p2Wins++; handEvalResults.individualWinners[i] = finalPlayerStates[1].id;}
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
      room.gameState.rematchState = 'can_offer'; // Game just ended, rematch can be offered
      room.gameState.rematchAgreedCount = 0;    // No one has agreed yet

      // Initialize rematch info on the server-side room object
      room.rematchInfo = {
        requests: {},
        agreedCount: 0,
        offerTimestamp: Date.now(),
      };

      io.to(room.id).emit('gameStateUpdate', room.gameState); // Send final game state with rematch info
      console.log(`Game ${room.id} ended. Winner: ${overallWinnerMsg}. Rematch window open.`);

      // Set a server-side timer to handle rematch window timeout
      clearRoomRematchTimer(room); // Clear any existing timer for this room
      room.rematchInfo.timerId = setTimeout(() => {
        if (rooms.has(room.id) && room.rematchInfo && room.rematchInfo.agreedCount < 2) {
          console.log(`Rematch window for room ${room.id} timed out on server.`);
          io.to(room.id).emit('rematch_offer_expired', { gameId: room.id });

          // Update gameState to reflect timeout
          room.gameState.rematchState = 'offer_timed_out';
          room.gameState.rematchAgreedCount = 0;
          io.to(room.id).emit('gameStateUpdate', room.gameState); // Notify clients

          delete room.rematchInfo; // Clean up rematch specific info

          // Decide on further room cleanup, e.g., delete after another short delay
          setTimeout(() => {
            if (rooms.has(room.id) && !room.rematchInfo) { // Only delete if no new rematch process started
                rooms.delete(room.id);
                console.log(`Room ${room.id} closed after rematch timeout.`);
            }
          }, 5000); // Short delay before closing room fully
        }
      }, REMATCH_WINDOW_MS + 1000); // Give a little buffer
  };

// Server-side equivalent of canPlaceCardInHand from useGameLogic
const canPlaceCardInHandServer = (player: Player, handIndex: number, targetSlot: number): boolean => {
  if (targetSlot < 0 || targetSlot > 4) return false;
  const cardCounts = player.hands.map((h: Hand) => h.cards.filter((c: Card | null) => c !== null).length);
  const cardsInTargetHandCurrently = cardCounts[handIndex];

  if (cardsInTargetHandCurrently !== targetSlot) {
    // This implies we are not filling the next available slot sequentially.
    // This check is crucial on the server.
    console.error(`Server validation: Mismatch between targetSlot (${targetSlot}) and actual empty slot count (${cardsInTargetHandCurrently}) in hand ${handIndex} for player ${player.id}.`);
    return false;
  }
  const numCardsTargetHandWillHave = cardsInTargetHandCurrently + 1;

  if (numCardsTargetHandWillHave === 3) { // Placing the 3rd card
    return player.hands.every((h: Hand) => h.cards.filter((c: Card | null) => c !== null).length >= 2);
  }
  if (numCardsTargetHandWillHave === 4) { // Placing the 4th card
    return player.hands.every((h: Hand) => h.cards.filter((c: Card | null) => c !== null).length >= 3);
  }
  if (numCardsTargetHandWillHave === 5) { // Placing the 5th card
    return player.hands.every((h: Hand) => h.cards.filter((c: Card | null) => c !== null).length >= 4);
  }
  return true;
};

  // This was in useGameLogic, server should handle it if game is online
  // socket.on('evaluateGame', ({ gameId }: { gameId: string }) => {
  //   const room = rooms.get(gameId);
  //   if (room) {
  //     handleGameEvaluation(room);
  //   }
  // });


  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Remove from queue if present
    const queueIndex = matchmakingQueue.findIndex((s: Socket) => s.id === socket.id);
    if (queueIndex !== -1) {
      matchmakingQueue.splice(queueIndex, 1);
      console.log(`Player ${socket.id} removed from matchmaking queue.`);
    }

    // Handle disconnects from active games
    for (const [roomId, room] of rooms.entries()) {
      const playerInRoom = room.players.find((p: RoomPlayerInfo) => p.socketId === socket.id);
      if (playerInRoom) {
        console.log(`Player ${socket.id} disconnected from room ${roomId}.`);
        clearTurnTimer(room); // Clear turn timer if active
        clearRoomRematchTimer(room); // Clear rematch timer if active

        // Notify other player
        const otherPlayer = room.players.find((p: RoomPlayerInfo) => p.socketId !== socket.id);
        if (otherPlayer) {
          io.to(otherPlayer.socketId).emit('opponentDisconnected', 'Your opponent has disconnected. Game over.');
           // If a rematch was in progress, notify the other player it's cancelled due to disconnect
          if (room.rematchInfo && room.rematchInfo.agreedCount > 0) {
            io.to(otherPlayer.socketId).emit('rematch_cancelled', { byPlayerId: socket.id });
          }
        }
        // Clean up room
        rooms.delete(roomId);
        console.log(`Room ${roomId} closed due to disconnect.`);
        break;
      }
    }
  });

  socket.on('request_rematch', ({ gameId, requestingPlayerId }: { gameId: string, requestingPlayerId: string }) => {
    const room = rooms.get(gameId);
    if (!room || room.gameState.gamePhase !== 'gameOver') {
      socket.emit('error', 'Game not found or not over.');
      return;
    }
    if (!room.rematchInfo) { // Rematch window might have closed or not initialized
        socket.emit('error', 'Rematch not available for this game.');
        // Optionally send an offer_timed_out if appropriate
        // socket.emit('rematch_offer_expired', { gameId });
        return;
    }

    if (Date.now() - room.rematchInfo.offerTimestamp > REMATCH_WINDOW_MS) {
      io.to(room.id).emit('rematch_offer_expired', { gameId });
      room.gameState.rematchState = 'offer_timed_out';
      room.gameState.rematchAgreedCount = 0;
      io.to(room.id).emit('gameStateUpdate', room.gameState);
      clearRoomRematchTimer(room);
      delete room.rematchInfo;
      return;
    }

    if (!room.rematchInfo.requests[requestingPlayerId]) {
      room.rematchInfo.requests[requestingPlayerId] = true;
      room.rematchInfo.agreedCount++;
      room.gameState.rematchAgreedCount = room.rematchInfo.agreedCount; // Update gameState field
    }

    console.log(`Player ${requestingPlayerId} requested rematch for game ${gameId}. Agreed: ${room.rematchInfo.agreedCount}`);

    if (room.rematchInfo.agreedCount === 1) {
      // First player to agree. Notify the other player they received an offer.
      const otherPlayerSocketId = room.players.find((p: RoomPlayerInfo) => p.socketId !== requestingPlayerId)?.socketId;
      if (otherPlayerSocketId) {
        io.to(otherPlayerSocketId).emit('rematch_offer_received', {
          fromPlayerId: requestingPlayerId,
          agreedCount: room.rematchInfo.agreedCount
        });
      }
      // Notify the requester that their offer is sent (client already does this optimistically)
      // We can send a status update to confirm.
      socket.emit('rematch_status_update', {
          gameId,
          agreedCount: room.rematchInfo.agreedCount,
          newRematchState: 'offer_sent' // For the requester
      });
    } else if (room.rematchInfo.agreedCount === 2) {
      console.log(`Both players in room ${gameId} agreed to a rematch.`);
      clearRoomRematchTimer(room); // Stop the timeout timer

      const player1Sock = io.sockets.sockets.get(room.players[0].socketId);
      const player2Sock = io.sockets.sockets.get(room.players[1].socketId);

      if (player1Sock && player2Sock) {
        io.to(gameId).emit('rematch_accepted', { gameId }); // Notify clients rematch is fully accepted

        const oldRoomId = room.id;
        rooms.delete(oldRoomId); // Delete the old room
        console.log(`Old room ${oldRoomId} deleted for rematch.`);

        const newRoom = createNewGame(player1Sock, player2Sock);
        io.to(newRoom.id).emit('gameStart', newRoom.gameState);
        startTurnTimer(newRoom); // Start timer for the new game
      } else {
        console.error('Sockets for rematch not found. Players might have disconnected.');
        // If one disconnected, the disconnect handler should clean up.
        // If both somehow disconnected right at this moment, this branch might be hit.
        if (room) rooms.delete(room.id); // Clean up the room if it still exists
      }
    }
  });

  socket.on('cancel_rematch_request', ({ gameId, cancellingPlayerId }: { gameId: string, cancellingPlayerId: string }) => {
    const room = rooms.get(gameId);
    if (!room || !room.rematchInfo || !room.rematchInfo.requests[cancellingPlayerId]) {
      return;
    }

    room.rematchInfo.requests[cancellingPlayerId] = false;
    room.rematchInfo.agreedCount--;
    room.gameState.rematchAgreedCount = room.rematchInfo.agreedCount;

    // Notify self of cancellation success
    socket.emit('rematch_cancelled', { byPlayerId: cancellingPlayerId });
    socket.emit('rematch_status_update', { gameId, agreedCount: room.rematchInfo.agreedCount, newRematchState: 'cancelled_by_self' });


    // Notify other player
    const otherPlayerSocketId = room.players.find((p: RoomPlayerInfo) => p.socketId !== cancellingPlayerId)?.socketId;
    if (otherPlayerSocketId) {
      io.to(otherPlayerSocketId).emit('rematch_cancelled', { byPlayerId: cancellingPlayerId });
      // Other player might revert to 'can_offer' or 'none' depending on server logic / client interpretation
      io.to(otherPlayerSocketId).emit('rematch_status_update', { gameId, agreedCount: room.rematchInfo.agreedCount, newRematchState: 'can_offer' }); // Or 'none'
    }
    console.log(`Player ${cancellingPlayerId} cancelled rematch for game ${gameId}. Agreed: ${room.rematchInfo.agreedCount}`);
  });

  socket.on('decline_rematch', ({ gameId, decliningPlayerId }: { gameId: string, decliningPlayerId: string }) => {
    const room = rooms.get(gameId);
    if (!room || !room.rematchInfo) {
      return;
    }
    clearRoomRematchTimer(room); // Stop rematch timeout

    console.log(`Player ${decliningPlayerId} declined rematch for game ${gameId}`);
    room.gameState.rematchAgreedCount = 0; // Reset agreed count

    // Notify both players of the decline
    room.players.forEach((pInfo: RoomPlayerInfo) => {
        const targetSock = io.sockets.sockets.get(pInfo.socketId);
        if (targetSock) {
            targetSock.emit('rematch_declined', { byPlayerId: decliningPlayerId });
            targetSock.emit('rematch_status_update', {
                gameId,
                agreedCount: 0,
                newRematchState: pInfo.socketId === decliningPlayerId ? 'declined_by_self' : 'declined_by_opponent'
            });
        }
    });

    delete room.rematchInfo; // Rematch process ended
    // Room can be cleaned up after a short delay
    setTimeout(() => {
        if(rooms.has(gameId) && !rooms.get(gameId)?.rematchInfo) { // ensure no new rematch started
            rooms.delete(gameId);
            console.log(`Room ${gameId} closed after rematch declined.`);
        }
    }, 5000);
  });

  socket.on('rematch_timeout', ({ gameId }: { gameId: string }) => {
    const room = rooms.get(gameId);
    if (room && room.rematchInfo && room.rematchInfo.offerTimestamp) {
      // This event is client-reported, server has its own authoritative timer.
      // We can log it, but server's timer in handleGameEvaluation is the source of truth for cleanup.
      console.log(`Client reported rematch timeout for game ${gameId}. Server timer is authoritative.`);
      // If server timer hasn't fired, this client report might be early or redundant.
      // Server will emit 'rematch_offer_expired' when its own timer fires.
    }
  });

});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

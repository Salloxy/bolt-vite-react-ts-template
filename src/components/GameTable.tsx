// src/components/GameTable.tsx
import React, { useEffect, useState } from 'react';
import useGameLogic from '../hooks/useGameLogic';
import { Card, Player, Hand } from '../types';
import CardDisplay from './CardDisplay'; // Import the new CardDisplay component
import Menu from './Menu'; // Import the Menu component

interface GameTableProps {
  isOnline: boolean;
  onGoHome: () => void;
  onRestartGame: () => void;
}

const GameTable: React.FC<GameTableProps> = ({ isOnline, onGoHome, onRestartGame }) => {
  const { 
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
    cancelMatchmaking // Destructure cancelMatchmaking
  } = useGameLogic({ isOnlineMultiplayer: isOnline, onGoHome });
  const [stackOffsetPx, setStackOffsetPx] = useState(16); // Default to 1rem (16px)
  const [turnTimeRemaining, setTurnTimeRemaining] = useState<number | null>(null);

  // Moved useEffect for turn timer to the top level
  useEffect(() => {
    let timerInterval: NodeJS.Timeout | null = null;
    // Check for gameState inside the effect
    // Condition simplified to run timer if game is playing and timer data exists, regardless of whose turn.
    if (gameState && gameState.turnTimerEndsAt && gameState.gamePhase === 'playing') {
      const calculateRemaining = () => {
        const now = Date.now();
        const endsAt = gameState.turnTimerEndsAt!;
        const remainingSeconds = Math.max(0, Math.round((endsAt - now) / 1000)); // Changed Math.floor to Math.round
        setTurnTimeRemaining(remainingSeconds);
        if (remainingSeconds <= 0) {
          if (timerInterval) clearInterval(timerInterval);
        }
      };
      calculateRemaining();
      timerInterval = setInterval(calculateRemaining, 1000);
    } else {
      setTurnTimeRemaining(null);
    }
    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [gameState]); // Dependencies updated: relies on gameState changes.

  useEffect(() => {
    const updateOffset = () => {
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16; // Fallback to 16px
        
        const offsetRemString = getComputedStyle(document.documentElement).getPropertyValue('--card-stack-offset').trim();
        if (offsetRemString.endsWith('rem')) {
          const offsetRem = parseFloat(offsetRemString);
          setStackOffsetPx(offsetRem * rootFontSize);
        } else if (offsetRemString.endsWith('px')) {
          setStackOffsetPx(parseFloat(offsetRemString));
        } else {
          setStackOffsetPx(1 * rootFontSize); // Default to 1rem
        }
      }
    };

    updateOffset(); // Initial set
    window.addEventListener('resize', updateOffset);
    return () => window.removeEventListener('resize', updateOffset);
  }, []);


  if (!gameState) {
    // If online, show connection/matchmaking status.
    // If local AI, game starts automatically via useGameLogic, so this state might be brief or skipped.
    return (
      <div className="container mx-auto p-4 text-center">
        <h1 className="text-2xl font-bold mb-6" style={{ fontSize: 'var(--text-3xl-responsive)' }}>Brazilian Poker</h1>
        {isOnline ? (
          <>
            {!socket?.connected && <p className="text-red-500 mt-4" style={{ fontSize: 'var(--text-base-responsive)' }}>Connecting to server...</p>}
            {socket?.connected && !playerId && <p className="text-yellow-500 mt-4" style={{ fontSize: 'var(--text-base-responsive)' }}>Waiting for player ID...</p>}
            {socket?.connected && playerId && (
              <>
                <p className="text-green-500 mt-4" style={{ fontSize: 'var(--text-base-responsive)' }}>Connected. Searching for opponent...</p>
                <button 
                  onClick={() => {
                    cancelMatchmaking();
                    onGoHome(); // Go back to home screen after cancelling
                  }}
                  className="mt-4 bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded text-sm"
                >
                  Cancel Search
                </button>
              </>
            )}
          </>
        ) : (
          // For local AI games, this is a loading state before auto-start
          <p className="text-yellow-500 mt-4" style={{ fontSize: 'var(--text-base-responsive)' }}>Loading AI Game...</p>
        )}
      </div>
    );
  }

  const clientPlayerId = isOnline ? playerId : 'player1'; // This is fine, derived from props/state
  const selfPlayer = gameState.players.find(p => p.id === clientPlayerId);
  const opponentPlayer = gameState.players.find(p => p.id !== clientPlayerId);
  const isMyTurn = gameState.currentPlayerId === clientPlayerId; // This is also fine

  // The turn timer useEffect was moved above the `if (!gameState)` block.

  let turnPlayerDisplayName = '';

  if (isOnline && gameState.players.length === 2 && playerId) {
    const player1ActualId = gameState.players[0].id;
    const player2ActualId = gameState.players[1].id;

    // Determine turnPlayerDisplayName for online games
    if (gameState.currentPlayerId === player1ActualId) {
      turnPlayerDisplayName = 'Player 1';
    } else if (gameState.currentPlayerId === player2ActualId) {
      turnPlayerDisplayName = 'Player 2';
    }
  } else if (!isOnline) {
    // Determine turnPlayerDisplayName for local games
    if (gameState.currentPlayerId === 'player1') {
        turnPlayerDisplayName = 'Player 1';
    } else if (gameState.currentPlayerId === 'ai') {
        turnPlayerDisplayName = 'AI';
    }
  }

  const isOpponentTurn = !isMyTurn;
  const isLateGameDraw = gameState.turnNumber >= 31;
  const shouldHideOpponentHeldCard = isOpponentTurn && isLateGameDraw;

  const renderPlayerHands = (player?: Player, isOpponent: boolean = false) => {
    if (!player) return <div className="flex justify-evenly p-2 h-48"> {/* Placeholder height */}</div>;
    return (
      <div className={`player-hands-area flex justify-evenly items-center p-1 ${isOpponent ? 'mb-2' : 'mt-2'}`}>
        {player.hands.map((hand, handIdx) => (
          <div key={`${player.id}-hand-${handIdx}`} className="hand relative flex flex-col items-center w-[5.5rem]">
            <div className="relative hand-stack-container-dimensions">
              {Array(5).fill(null).map((_, slotIndex) => {
                const cardInSlot = hand.cards[slotIndex];
                const isActuallyHidden = cardInSlot?.hidden === true && gameState.gamePhase !== 'gameOver' && gameState.gamePhase !== 'evaluation';
                
                const cardDisplayOffset = slotIndex * stackOffsetPx;
                const zIndex = slotIndex; 
                
                if (cardInSlot) {
                  return (
                    <div
                      key={`card-${player.id}-${handIdx}-${slotIndex}`}
                      className="absolute"
                      style={{ top: `${cardDisplayOffset}px`, left: 0, zIndex: zIndex }}
                    >
                      <CardDisplay
                        card={cardInSlot}
                        isHidden={isActuallyHidden}
                      />
                    </div>
                  );
                } else {
                  const firstEmptyVisualSlotIndex = hand.cards.findIndex(c => c === null);
                  if (slotIndex === firstEmptyVisualSlotIndex) {
                    return (
                      <div
                      key={`empty-${player.id}-${handIdx}-${slotIndex}`}
                      className="absolute"
                      style={{ top: `${cardDisplayOffset}px`, zIndex: 0 }} 
                    >
                      <CardDisplay card={null} />
                      </div>
                    );
                  }
                  return null;
                }
              })}
              {(() => {
                const actualPlacementIndex = hand.cards.findIndex(c => c === null);
                if (isMyTurn && heldCard && !isOpponent && actualPlacementIndex !== -1) {
                  const placementButtonTopPosition = actualPlacementIndex * stackOffsetPx;
                  return (
                    <button
                        onClick={() => { setError(null); placeCard(handIdx); }}
                        className="absolute card-dimensions bg-transparent rounded-lg focus:outline-none z-10"
                        style={{ top: `${placementButtonTopPosition}px` }}
                        aria-label={`Place card in Hand ${handIdx + 1} at slot ${actualPlacementIndex + 1}`}
                    >
                    </button>
                  );
                }
                return null;
              })()}
            </div>
            {hand.evaluation && (gameState.gamePhase === 'gameOver' || gameState.gamePhase === 'evaluation') && (
              <>
                <p className="text-xs mt-1 text-center w-full truncate" title={hand.evaluation.description}>{hand.evaluation.description}</p>
                {gameState.individualHandWinners && gameState.individualHandWinners[handIdx] != null && (
                  <p className={`text-xs font-bold text-center w-full ${
                    gameState.individualHandWinners[handIdx] === 'Tie' ? 'text-yellow-300' :
                    (gameState.individualHandWinners[handIdx] === player.id) ? 'text-green-300' : 'text-red-300'
                  }`}>
                    {gameState.individualHandWinners[handIdx] === 'Tie' ? 'TIE' :
                     (gameState.individualHandWinners[handIdx] === player.id) ? 'WIN' : 'LOSS'}
                  </p>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div
      className="relative flex flex-col h-full game-table-background text-white items-center p-1" // Changed background, Removed justify-between, adjusted padding
      style={{ maxWidth: '26.875rem' }}
    >
      <Menu onGoHome={onGoHome} onRestartGame={onRestartGame} />
      
      {/* Opponent Area - give it a class for potential specific styling if needed */}
      <div className="w-full player-area opponent-area my-1"> {/* Added my-1 for some spacing */}
        <h2 className="font-semibold text-center mb-1" style={{ fontSize: 'var(--text-xl-responsive)' }}>
          {isOnline ? "OPPONENT" : "OPPONENT (AI)"}
        </h2>
        {renderPlayerHands(opponentPlayer, true)}
      </div>

      {/* Middle Area: Game Info / Game Over Display - This will be the flexible part */}
      <div className="game-info-area w-full flex-grow flex flex-col items-center justify-center space-y-0.5 overflow-y-auto py-1"> {/* Added flex-grow, justify-center, overflow-y-auto, py-1 */}
        {error && <p className="text-red-300 bg-red-800 p-1 rounded text-center my-1" style={{ fontSize: 'var(--text-base-responsive)' }}>{error}</p>}

        {gameState.gamePhase === 'gameOver' && gameResults ? (
          <>
            <p className="mb-2 text-center font-bold" style={{ fontSize: 'var(--text-base-responsive)' }}>
              {gameResults}
            </p>
            {isOnline && gameState.gamePhase === 'gameOver' && (
              <div className="mt-2 space-y-2 text-center">
                <button
                  onClick={startGame} // This will now reset state and find a new match
                  className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2 px-4 rounded-xl shadow-lg border-2 border-yellow-700 hover:border-yellow-800 transition duration-150 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-opacity-50"
                  style={{ fontSize: 'var(--text-base-responsive)' }}
                >
                  Find New Online Match
                </button>
              </div>
            )}
            {!isOnline && ( // "Play Again vs AI" button for local games
                <button
                    onClick={startGame}
                    className="mt-2 bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2 px-4 rounded-xl shadow-lg border-2 border-yellow-700 hover:border-yellow-800 transition duration-150 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-opacity-50"
                    style={{ fontSize: 'var(--text-base-responsive)' }}
                >
                    Play Again vs AI
                </button>
            )}
          </>
        ) : (
          <>
            <p className="text-center" style={{ fontSize: 'var(--text-base-responsive)' }}>
              Turn: {isMyTurn ? "Your Turn" : "Opponent's Turn"}
              {turnTimeRemaining !== null && gameState.gamePhase === 'playing' && (
                <span className="ml-2 font-bold text-yellow-300">({turnTimeRemaining}s)</span>
              )}
            </p>
            <div className="flex justify-around items-start w-full max-w-xs">
                <div className="deck-area flex flex-col items-center">
                    <p className="text-xs mb-0" style={{ fontSize: 'var(--text-sm-responsive)' }}>Deck ({gameState.deck.length})</p> {/* Reduced mb-0.5 to mb-0 */}
                    <CardDisplay card={null} isHidden={true} />
                    <div className="mt-0.5 w-full flex justify-center items-center"> {/* Reduced mt-1 to mt-0.5 */}
                      {(isMyTurn && !heldCard && gameState.gamePhase === 'playing') ? (
                         <button 
                            onClick={() => { setError(null); drawCard(); }}
                            className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-1.5 px-3 rounded-lg shadow-md border border-yellow-700 hover:border-yellow-800 transition duration-150 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-1 focus:ring-yellow-400 focus:ring-opacity-50 text-xs"
                            style={{ fontSize: 'var(--text-sm-responsive)' }}
                            disabled={gameState.deck.length === 0}
                        >
                            Draw Card
                        </button>
                      ) : (
                        <div
                          className="font-bold py-1.5 px-3 rounded text-xs invisible"
                          style={{ fontSize: 'var(--text-sm-responsive)' }}
                          aria-hidden="true"
                        >
                          Draw Card
                        </div>
                      )}
                    </div>
                </div>

                <div className="held-card-area flex flex-col items-center">
                    <p className="text-xs mb-0" style={{ fontSize: 'var(--text-sm-responsive)' }}> {/* Reduced mb-0.5 to mb-0 */}
                      {heldCard ? "Holding:" : <>&nbsp;</>}
                    </p>
                    {heldCard ? (
                      <CardDisplay
                        card={heldCard}
                        isHidden={shouldHideOpponentHeldCard}
                      />
                    ) : (
                      <div className="card-dimensions"></div>
                    )}
                    <div className="mt-0.5 w-full flex justify-center items-center"> {/* Reduced mt-1 to mt-0.5 */}
                      <div
                        className="font-bold py-1 px-2 rounded text-xs invisible"
                        style={{ fontSize: 'var(--text-sm-responsive)' }}
                        aria-hidden="true"
                      >
                        &nbsp;
                      </div>
                    </div>
                </div>
            </div>
          </>
        )}
      </div>

      {/* Your Area - give it a class */}
      <div className="w-full player-area self-area my-1"> {/* Added my-1 for some spacing */}
        <h2 className="font-semibold text-center mb-1" style={{ fontSize: 'var(--text-xl-responsive)' }}>
          YOU
        </h2>
        {renderPlayerHands(selfPlayer, false)}
      </div>
    </div>
  );
};

export default GameTable;

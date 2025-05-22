import React from 'react';
import useSetAndSeizeGameLogic from '../hooks/useSetAndSeizeGameLogic';
import CardDisplay from './CardDisplay'; // Import the CardDisplay component
import Menu from './Menu'; // Import the Menu component
import { SnsCard, SnsBuild } from '../types'; // Import SnsCard and SnsBuild

interface SetAndSeizeGameTableProps {
  isOnline: boolean;
  onGoHome: () => void;
  onRestartGame: () => void;
}

const SetAndSeizeGameTable: React.FC<SetAndSeizeGameTableProps> = ({
  isOnline,
  onGoHome,
  onRestartGame,
}) => {
  const {
    clientPlayerId, // Destructure the new clientPlayerId
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
    cancelMatchmaking, // Destructure cancelMatchmaking
  } = useSetAndSeizeGameLogic({ isOnline });

  // Correctly identify self and opponent in online mode using clientPlayerId
  const selfId = isOnline ? clientPlayerId : 'player';
  const playerSelf = players.find(p => p.id === selfId);
  const playerOpponent = isOnline ? players.find(p => p.id !== selfId) : players.find(p => p.id === 'ai');

  const playerHand = playerSelf?.hand || [];
  const playerCollected = playerSelf?.collectedCards || [];
  const aiHand = playerOpponent?.hand || []; // For display purposes, though AI hand is hidden
  const aiCollected = playerOpponent?.collectedCards || [];
  const currentPlayer = currentPlayerId === selfId ? 'player' : 'ai'; // 'player' for self, 'ai' for opponent/AI
  const aiMustCapture = playerOpponent?.mustCapture || false;
  const hasPlayedCardThisTurn = false; // This is now managed server-side for online play, or not directly used for AI offline.

  const [turnTimeLeft, setTurnTimeLeft] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (isOnline && turnTimerEndsAt && gamePhase === 'playing') {
      const interval = setInterval(() => {
        const timeLeft = Math.max(0, Math.ceil((turnTimerEndsAt - Date.now()) / 1000));
        setTurnTimeLeft(timeLeft);
        if (timeLeft === 0) {
          clearInterval(interval);
        }
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setTurnTimeLeft(null);
    }
  }, [isOnline, turnTimerEndsAt, gamePhase]);

  const [captureMode, setCaptureMode] = React.useState<boolean>(false); // New state for capture mode
  const [showBuildOptions, setShowBuildOptions] = React.useState<boolean>(false); // New state for build options
  const [buildMode, setBuildMode] = React.useState<boolean>(false); // New state for build mode
  const [buildType, setBuildType] = React.useState<'soft-build' | 'hard-build' | null>(null); // New state for build type
  const [selectedTargetCard, setSelectedTargetCard] = React.useState<SnsCard | null>(null); // New state for the target card in hand

  // Group middle cards for rendering, especially for hard builds
  const renderableMiddleItems = React.useMemo(() => {
    const groupedItems: (SnsCard | SnsBuild | SnsBuild[])[] = [];
    const hardBuildGroups: { [groupId: string]: SnsBuild[] } = {};
    const processedBuildIds = new Set<string>();

    middleCards.forEach((item: SnsCard | SnsBuild) => {
      if ('isHard' in item && item.isHard && item.hardBuildGroupId) {
        if (!processedBuildIds.has(item.id)) {
          if (!hardBuildGroups[item.hardBuildGroupId]) {
            hardBuildGroups[item.hardBuildGroupId] = [];
          }
          hardBuildGroups[item.hardBuildGroupId].push(item);
          processedBuildIds.add(item.id);
        }
      } else {
        groupedItems.push(item); // Add single cards and soft builds directly
      }
    });

    // Add grouped hard builds to the renderable items
    Object.values(hardBuildGroups).forEach(group => {
      if (group.length > 1) { // Only group if there are multiple builds in the hard build
        groupedItems.push(group);
      } else if (group.length === 1) { // If a hard build somehow ended up alone in a group, treat it as a single build
        groupedItems.push(group[0]);
      }
    });

    return groupedItems;
  }, [middleCards]);

  const handleHandCardClick = (card: SnsCard) => {
    if (currentPlayer === 'player' && !hasPlayedCardThisTurn) {
      if (buildMode && selectedPlayerCard && !selectedTargetCard) {
        // If in build mode, a card to drop is selected, and no target card is selected yet
        setSelectedTargetCard(card);
      } else {
        // Normal card selection or initial card for build
        setSelectedPlayerCard(card); // Use selectedPlayerCard from hook
        setSelectedMiddleCards([]); // Clear any previously selected middle cards
        setCaptureMode(false); // Reset capture mode
        setShowBuildOptions(false); // Reset build options visibility
        setBuildMode(false); // Reset build mode
        setBuildType(null); // Reset build type
        setSelectedTargetCard(null); // Reset target card
      }
    }
  };

  const handleDrop = () => {
    if (selectedPlayerCard) { // Use selectedPlayerCard from hook
      playCard(selectedPlayerCard, 'drop'); // Use selectedPlayerCard from hook
    }
  };

  const handleInitiateCapture = () => {
    setCaptureMode(true); // Enter capture mode
    setSelectedMiddleCards([]); // Clear any previous middle selections
  };

  const handleConfirmCapture = () => {
    if (selectedPlayerCard && checkValidCapture(selectedPlayerCard, selectedMiddleCards)) { // Use selectedPlayerCard from hook
      playCard(selectedPlayerCard, 'capture'); // Use selectedPlayerCard from hook
    }
  };

  const handleCancel = () => {
    setSelectedPlayerCard(null); // Use selectedPlayerCard from hook
    setSelectedMiddleCards([]);
    setCaptureMode(false);
    setShowBuildOptions(false);
    setBuildMode(false);
    setBuildType(null);
    setSelectedTargetCard(null);
  };

  const handleCardOptionSelect = (option: 'soft-build' | 'hard-build') => {
    console.log(`Selected option for card ${selectedPlayerCard?.rank}${selectedPlayerCard?.suit}: ${option}`); // Use selectedPlayerCard from hook
    setBuildMode(true);
    setBuildType(option);
    setShowBuildOptions(false); // Hide soft/hard build buttons
    setSelectedMiddleCards([]); // Clear middle selections for new build
  };

  return (
    <div
      className="relative flex flex-col h-full game-table-background text-white items-center p-1"
      style={{ maxWidth: '26.875rem' }}
    >
      <Menu onGoHome={onGoHome} onRestartGame={onRestartGame} />

{isOnline && gamePhase === 'loading' && !isGameInitialized && (
        <div className="absolute inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center text-white text-center p-4 z-50">
          <h2 className="text-4xl font-bold mb-4">Finding Match...</h2>
          {messages.map((msg, idx) => <p key={`msg-${idx}`} className="text-lg">{msg}</p>)}
          {errors.map((err, idx) => <p key={`err-${idx}`} className="text-red-500 text-lg">{err}</p>)}
          <p className="text-xl mt-4">Please wait for another player to join.</p>
          <button
            onClick={() => {
              cancelMatchmaking();
              onGoHome(); // Go back to home screen after cancelling
            }}
            className="mt-8 bg-gray-700 hover:bg-gray-800 text-white font-semibold py-2 px-4 rounded-lg text-sm shadow-md transition duration-150 ease-in-out"
          >
            Cancel Search
          </button>
        </div>
      )}

      {/* Main game content - only render if not in loading phase for online games, or if offline */}
      {(!isOnline || (isOnline && gamePhase !== 'loading' && isGameInitialized)) && (
        <>
      {/* Top Area: AI Hand (hidden) and AI Collected */}
      <div className="w-full player-area opponent-area my-1">
        <h3 className="text-xl font-semibold mb-2 text-center">{isOnline ? 'Opponent Hand' : 'AI Hand'}</h3>
        <div className="flex justify-center space-x-1">
          {aiHand.map((card: SnsCard, index: number) => (
            <CardDisplay key={index} card={card} isHidden={true} isHandCard={true} />
          ))}
        </div>
        <div className="flex flex-col items-center mt-2">
          <h3 className="text-xl font-semibold mb-2">{isOnline ? 'Opponent Collected' : 'AI Collected'} ({aiCollected.length} cards)</h3>
          <div className="flex flex-wrap justify-center">
            {/* Removed display of collected AI cards */}
          </div>
        </div>
      </div>

      {/* Middle Area: Table Cards */}
      <div className="game-info-area w-full flex-grow flex flex-col items-center justify-center space-y-0.5 overflow-y-auto py-1">
        <h3 className="text-2xl font-bold mb-4">Middle Cards</h3>
        <div className="flex flex-wrap justify-center min-h-[90px] border border-gray-600 rounded p-2 bg-gray-700">
          {renderableMiddleItems.length > 0 ? (
            renderableMiddleItems.map((item, index) => {
              if (Array.isArray(item)) { // This is a hard build group
                const hardBuildGroup = item as SnsBuild[];
                return (
                  <div key={`hard-build-group-${hardBuildGroup[0].hardBuildGroupId}`}
                       className="flex border-4 border-yellow-500 rounded-lg p-1 m-1">
                    {hardBuildGroup.map(build => (
                      <button
                        key={build.id}
                        onClick={() => (captureMode || (buildMode && selectedTargetCard)) && toggleMiddleCardSelection(build)}
                        className={`hover:scale-105 transition-transform ${selectedMiddleCards.some((c: SnsCard | SnsBuild) => c.id === build.id) ? 'border-4 border-blue-500' : ''}`}
                        disabled={!(captureMode || (buildMode && selectedTargetCard))}
                      >
                        <div className="flex flex-col items-center relative" style={{ height: '150px', width: '100px' }}>
                          {build.cards.map((cardInPile, pileIndex) => (
                            <div
                              key={cardInPile.id}
                              className="absolute"
                              style={{
                                top: `${pileIndex * 30}px`,
                                zIndex: pileIndex,
                              }}
                            >
                              <CardDisplay card={cardInPile} />
                            </div>
                          ))}
                          <div className="absolute text-xs bg-black bg-opacity-50 text-white px-1 rounded"
                               style={{ bottom: '-15px', zIndex: build.cards.length + 1 }}>
                            {build.totalValue}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                );
              } else { // It's a single SnsCard or a soft SnsBuild
                const singleItem = item as SnsCard | SnsBuild;
                return (
                  <button
                    key={singleItem.id}
                    onClick={() => (captureMode || (buildMode && selectedTargetCard)) && toggleMiddleCardSelection(singleItem)}
                    className={`hover:scale-105 transition-transform ${selectedMiddleCards.some((c: SnsCard | SnsBuild) => c.id === singleItem.id) ? 'border-4 border-blue-500' : ''}`}
                    disabled={!(captureMode || (buildMode && selectedTargetCard))}
                  >
                    {'cards' in singleItem ? ( // It's an SnsBuild (soft build)
                      <div className="flex flex-col items-center relative" style={{ height: '150px', width: '100px' }}>
                        {singleItem.cards.map((cardInPile, pileIndex) => (
                          <div
                            key={cardInPile.id}
                            className="absolute"
                            style={{
                              top: `${pileIndex * 30}px`,
                              zIndex: pileIndex,
                            }}
                          >
                            <CardDisplay card={cardInPile} />
                          </div>
                        ))}
                        <div className="absolute text-xs bg-black bg-opacity-50 text-white px-1 rounded"
                             style={{ bottom: '-15px', zIndex: singleItem.cards.length + 1 }}>
                          {singleItem.totalValue}
                        </div>
                      </div>
                    ) : (
                      <CardDisplay card={singleItem} /> // It's a single SnsCard
                    )}
                  </button>
                );
              }
            })
          ) : (
            <p className="text-gray-400">No cards in the middle.</p>
          )}
        </div>
        <p className="text-lg mt-2">Cards in Deck: {deckSize}</p> {/* Display deck size */}
        <p className="text-lg mt-2">Current Player: {currentPlayerId === selfId ? 'You' : (isOnline ? 'Opponent' : 'AI')}</p>
        {isOnline && turnTimeLeft !== null && (
          <p className="text-lg mt-1">Time Left: {turnTimeLeft}s</p>
        )}
        {playerSelf && currentPlayerId === playerSelf.id && playerMustCapture && <p className="text-red-400 font-bold">MUST CAPTURE!</p>}
        {playerOpponent && currentPlayerId === playerOpponent.id && aiMustCapture && <p className="text-red-400 font-bold">MUST CAPTURE!</p>}
        {/* The loading overlay is already handled by the logic at line 157 */}

        {/* Action Buttons */}
        {selectedPlayerCard && !captureMode && !buildMode && !showBuildOptions && ( // Initial options: Drop, Capture, Build, Cancel
          <div className="mt-4 flex space-x-4">
            <button
              onClick={handleDrop}
              className="px-4 py-2 bg-green-600 rounded hover:bg-green-700 disabled:opacity-50"
              disabled={currentPlayerId !== selfId}
            >
              Drop
            </button>
            <button
              onClick={handleInitiateCapture}
              className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
              disabled={currentPlayerId !== selfId}
            >
              Capture
            </button>
            <button
              onClick={() => setShowBuildOptions(true)}
              className="px-4 py-2 bg-purple-600 rounded hover:bg-purple-700 disabled:opacity-50"
              disabled={currentPlayerId !== selfId}
            >
              Build
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-600 rounded hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        )}

        {selectedPlayerCard && showBuildOptions && ( // Show Soft/Hard Build options
          <div className="mt-4 flex space-x-4">
            <button
              onClick={() => handleCardOptionSelect('soft-build')}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
              disabled={currentPlayerId !== selfId}
            >
              Soft Build
            </button>
            <button
              onClick={() => handleCardOptionSelect('hard-build')}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
              disabled={currentPlayerId !== selfId}
            >
              Hard Build
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-600 rounded hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        )}

        {selectedPlayerCard && buildMode && !selectedTargetCard && ( // Prompt to select target card
          <div className="mt-4 flex flex-col items-center space-y-2">
            <p className="text-lg font-bold text-yellow-400">Select a TARGET card from your hand.</p>
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-600 rounded hover:bg-gray-700"
            >
              Cancel Build
            </button>
          </div>
        )}

        {selectedPlayerCard && buildMode && selectedTargetCard && ( // Build mode: select middle cards
          <div className="mt-4 flex flex-col items-center space-y-2">
            <p className="text-lg font-bold text-yellow-400">
              Target Value: {selectedTargetCard.rank === 'T' ? '10' : selectedTargetCard.rank}
            </p>
            <div className="flex space-x-4">
            <button
              onClick={() => {
                if (selectedPlayerCard && selectedTargetCard && buildType) { // Use selectedPlayerCard from hook
                  playCard(selectedPlayerCard, 'build', selectedTargetCard, buildType); // Use selectedPlayerCard from hook
                }
              }}
              className="px-4 py-2 bg-purple-600 rounded hover:bg-purple-700 disabled:opacity-50"
              disabled={
                currentPlayerId !== selfId ||
                selectedMiddleCards.length === 0 ||
                (buildType === 'soft-build' && (!selectedPlayerCard || !selectedTargetCard || !checkValidSoftBuild(selectedPlayerCard, selectedTargetCard, selectedMiddleCards))) ||
                (buildType === 'hard-build' && (!selectedPlayerCard || !selectedTargetCard || !checkValidHardBuild(selectedPlayerCard, selectedTargetCard, selectedMiddleCards)))
              }
            >
              Confirm Build
            </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-gray-600 rounded hover:bg-gray-700"
              >
                Cancel Build
              </button>
            </div>
          </div>
        )}

        {selectedPlayerCard && captureMode && ( // Show confirm/cancel in capture mode
          <div className="mt-4 flex space-x-4">
            <button
              onClick={handleConfirmCapture}
              className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
              disabled={
                currentPlayerId !== selfId ||
                !checkValidCapture(selectedPlayerCard, selectedMiddleCards)
              }
            >
              Confirm Capture
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-600 rounded hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Bottom Area: Player Hand and Player Collected */}
      <div className="w-full player-area self-area my-1">
        <h3 className="text-xl font-semibold mb-2 text-center">Your Hand</h3>
        <div className="flex justify-center space-x-1">
          {playerHand.length > 0 ? (
            playerHand.map((card: SnsCard, index: number) => (
                <button
                  key={index}
                  onClick={() => handleHandCardClick(card)}
                  className={`hover:scale-105 transition-transform ${selectedPlayerCard?.id === card.id ? 'border-4 border-yellow-500' : ''}`}
                  disabled={currentPlayerId !== selfId}
                >
                  <CardDisplay card={card} isHandCard={true} />
                </button>
            ))
          ) : (
            <p className="text-gray-400">Your hand is empty.</p>
          )}
        </div>
        <div className="flex flex-col items-center mt-2">
          <h3 className="text-xl font-semibold mb-2">Your Collected ({playerCollected.length} cards)</h3>
          <div className="flex flex-wrap justify-center">
            {/* Removed display of collected player cards */}
          </div>
        </div>
      </div>

      {gameEnded && gameResult && (
        <div className="absolute inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center text-white text-center p-4">
          {gameResult?.winner === 'player' && <h2 className="text-4xl font-bold mb-4">YOU WIN!</h2>}
          {gameResult?.winner === 'ai' && <h2 className="text-4xl font-bold mb-4">OPPONENT WINS!</h2>}
          {gameResult?.winner === 'draw' && <h2 className="text-4xl font-bold mb-4">IT'S A DRAW!</h2>}
          {gameResult?.winner === null && messages.length > 0 && <h2 className="text-4xl font-bold mb-4">{messages[messages.length - 1]}</h2>}
          {gameResult && gameResult.winner !== null && (
            <>
              <p className="text-2xl mb-2">Your Score: {gameResult.playerScore}</p>
              <p className="text-2xl mb-4">Opponent Score: {gameResult.aiScore}</p>
            </>
          )}
          {messages.map((msg, idx) => <p key={`msg-${idx}`} className="text-lg">{msg}</p>)}
          {errors.map((err, idx) => <p key={`err-${idx}`} className="text-red-500 text-lg">{err}</p>)}
          <button
            onClick={resetGame}
            className="mt-6 px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2 px-4 rounded-xl shadow-lg border-2 border-yellow-700 hover:border-yellow-800 transition duration-150 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-opacity-50"
          >
            Play Again
          </button>
          <button
            onClick={onGoHome}
            className="mt-4 bg-gray-700 hover:bg-gray-800 text-white font-semibold py-2 px-4 rounded-lg text-sm shadow-md transition duration-150 ease-in-out"
          >
            Back to Menu
          </button>
        </div>
      )}
        </>
      )}
    </div>
  );
};

export default SetAndSeizeGameTable;

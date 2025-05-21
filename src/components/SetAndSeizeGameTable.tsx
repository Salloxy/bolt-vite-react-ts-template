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
    playerHand,
    aiHand, // For display purposes, though AI hand is hidden
    middleCards,
    playerCollected,
    aiCollected,
    currentPlayer,
    mustCapture,
    selectedMiddleCards, // Destructure new state
    setSelectedMiddleCards, // Destructure the setter for selectedMiddleCards
    initializeGame,
    playCard,
    toggleMiddleCardSelection, // Destructure new function
    hasPlayedCardThisTurn,
    checkValidCapture, // Destructure checkValidCapture
    checkValidSoftBuild, // Destructure checkValidSoftBuild
    checkValidHardBuild, // Destructure checkValidHardBuild
  } = useSetAndSeizeGameLogic({ isOnline });

  const [selectedHandCard, setSelectedHandCard] = React.useState<SnsCard | null>(null);
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

    middleCards.forEach(item => {
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
      if (buildMode && selectedHandCard && !selectedTargetCard) {
        // If in build mode, a card to drop is selected, and no target card is selected yet
        setSelectedTargetCard(card);
      } else {
        // Normal card selection or initial card for build
        setSelectedHandCard(card);
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
    if (selectedHandCard) {
      playCard(selectedHandCard, 'drop');
      setSelectedHandCard(null);
      setSelectedMiddleCards([]);
      setCaptureMode(false);
    }
  };

  const handleInitiateCapture = () => {
    setCaptureMode(true); // Enter capture mode
    setSelectedMiddleCards([]); // Clear any previous middle selections
  };

  const handleConfirmCapture = () => {
    if (selectedHandCard && checkValidCapture(selectedHandCard, selectedMiddleCards)) {
      playCard(selectedHandCard, 'capture');
      setSelectedHandCard(null);
      setSelectedMiddleCards([]);
      setCaptureMode(false);
    }
  };

  const handleCancel = () => {
    setSelectedHandCard(null);
    setSelectedMiddleCards([]);
    setCaptureMode(false);
    setShowBuildOptions(false);
    setBuildMode(false);
    setBuildType(null);
    setSelectedTargetCard(null);
  };

  const handleCardOptionSelect = (option: 'soft-build' | 'hard-build') => {
    console.log(`Selected option for card ${selectedHandCard?.rank}${selectedHandCard?.suit}: ${option}`);
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

      {/* Top Area: AI Hand (hidden) and AI Collected */}
      <div className="w-full player-area opponent-area my-1">
        <h3 className="text-xl font-semibold mb-2 text-center">AI Hand ({aiHand.length} cards)</h3>
        <div className="flex justify-center space-x-1">
          {aiHand.map((card, index) => (
            <CardDisplay key={index} card={card} isHidden={true} isHandCard={true} />
          ))}
        </div>
        <div className="flex flex-col items-center mt-2">
          <h3 className="text-xl font-semibold mb-2">AI Collected ({aiCollected.length} cards)</h3>
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
                        className={`hover:scale-105 transition-transform ${selectedMiddleCards.some(c => c.id === build.id) ? 'border-4 border-blue-500' : ''}`}
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
                    className={`hover:scale-105 transition-transform ${selectedMiddleCards.some(c => c.id === singleItem.id) ? 'border-4 border-blue-500' : ''}`}
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
        <p className="text-lg mt-2">Current Player: {currentPlayer === 'player' ? 'You' : 'AI'}</p>
        {mustCapture && <p className="text-red-400 font-bold">MUST CAPTURE!</p>}

        {/* Action Buttons */}
        {selectedHandCard && !captureMode && !buildMode && !showBuildOptions && ( // Initial options: Drop, Capture, Build, Cancel
          <div className="mt-4 flex space-x-4">
            <button
              onClick={handleDrop}
              className="px-4 py-2 bg-green-600 rounded hover:bg-green-700 disabled:opacity-50"
              disabled={currentPlayer !== 'player' || hasPlayedCardThisTurn}
            >
              Drop
            </button>
            <button
              onClick={handleInitiateCapture}
              className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
              disabled={currentPlayer !== 'player' || hasPlayedCardThisTurn}
            >
              Capture
            </button>
            <button
              onClick={() => setShowBuildOptions(true)}
              className="px-4 py-2 bg-purple-600 rounded hover:bg-purple-700 disabled:opacity-50"
              disabled={currentPlayer !== 'player' || hasPlayedCardThisTurn}
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

        {selectedHandCard && showBuildOptions && ( // Show Soft/Hard Build options
          <div className="mt-4 flex space-x-4">
            <button
              onClick={() => handleCardOptionSelect('soft-build')}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
              disabled={currentPlayer !== 'player' || hasPlayedCardThisTurn}
            >
              Soft Build
            </button>
            <button
              onClick={() => handleCardOptionSelect('hard-build')}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
              disabled={currentPlayer !== 'player' || hasPlayedCardThisTurn}
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

        {selectedHandCard && buildMode && !selectedTargetCard && ( // Prompt to select target card
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

        {selectedHandCard && buildMode && selectedTargetCard && ( // Build mode: select middle cards
          <div className="mt-4 flex flex-col items-center space-y-2">
            <p className="text-lg font-bold text-yellow-400">
              Target Value: {selectedTargetCard.rank === 'T' ? '10' : selectedTargetCard.rank}
            </p>
            <div className="flex space-x-4">
            <button
              onClick={() => {
                if (selectedHandCard && selectedTargetCard && buildType) {
                  playCard(selectedHandCard, 'build', selectedTargetCard, buildType);
                  setSelectedHandCard(null);
                  setSelectedMiddleCards([]);
                  setCaptureMode(false);
                  setShowBuildOptions(false);
                  setBuildMode(false);
                  setBuildType(null);
                  setSelectedTargetCard(null);
                }
              }}
              className="px-4 py-2 bg-purple-600 rounded hover:bg-purple-700 disabled:opacity-50"
              disabled={
                currentPlayer !== 'player' ||
                hasPlayedCardThisTurn ||
                selectedMiddleCards.length === 0 ||
                (buildType === 'soft-build' && (!selectedHandCard || !selectedTargetCard || !checkValidSoftBuild(selectedHandCard, selectedTargetCard, selectedMiddleCards))) ||
                (buildType === 'hard-build' && (!selectedHandCard || !selectedTargetCard || !checkValidHardBuild(selectedHandCard, selectedTargetCard, selectedMiddleCards)))
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

        {selectedHandCard && captureMode && ( // Show confirm/cancel in capture mode
          <div className="mt-4 flex space-x-4">
            <button
              onClick={handleConfirmCapture}
              className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
              disabled={
                currentPlayer !== 'player' ||
                hasPlayedCardThisTurn ||
                !checkValidCapture(selectedHandCard, selectedMiddleCards)
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
            playerHand.map((card, index) => (
                <button
                  key={index}
                  onClick={() => handleHandCardClick(card)}
                  className={`hover:scale-105 transition-transform ${selectedHandCard?.id === card.id ? 'border-4 border-yellow-500' : ''}`}
                  disabled={currentPlayer !== 'player' || hasPlayedCardThisTurn}
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
    </div>
  );
};

export default SetAndSeizeGameTable;

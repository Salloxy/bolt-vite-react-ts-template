import React from 'react';
import useSetAndSeizeGameLogic from '../hooks/useSetAndSeizeGameLogic';
import CardDisplay from './CardDisplay'; // Import the CardDisplay component
import Menu from './Menu'; // Import the Menu component
import { SnsCard } from '../types'; // Assuming SnsCard type is in types/index.ts

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
  } = useSetAndSeizeGameLogic({ isOnline });

  const [selectedHandCard, setSelectedHandCard] = React.useState<SnsCard | null>(null);
  const [captureMode, setCaptureMode] = React.useState<boolean>(false); // New state for capture mode

  const handleHandCardClick = (card: SnsCard) => {
    if (currentPlayer === 'player' && !hasPlayedCardThisTurn) {
      setSelectedHandCard(card);
      setSelectedMiddleCards([]); // Clear any previously selected middle cards
      setCaptureMode(false); // Reset capture mode when a new hand card is selected
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
          {middleCards.length > 0 ? (
            middleCards.map((card, index) => (
              <button
                key={index}
                onClick={() => captureMode && toggleMiddleCardSelection(card)} // Only allow selection in capture mode
                className={`hover:scale-105 transition-transform ${selectedMiddleCards.some(c => c.id === card.id) ? 'border-4 border-blue-500' : ''}`}
                disabled={!captureMode} // Disable selection if not in capture mode
              >
                <CardDisplay card={card} />
              </button>
            ))
          ) : (
            <p className="text-gray-400">No cards in the middle.</p>
          )}
        </div>
        <p className="text-lg mt-2">Current Player: {currentPlayer === 'player' ? 'You' : 'AI'}</p>
        {mustCapture && <p className="text-red-400 font-bold">MUST CAPTURE!</p>}

        {/* Action Buttons */}
        {selectedHandCard && !captureMode && ( // Show initial options
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
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-600 rounded hover:bg-gray-700"
            >
              Cancel
            </button>
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

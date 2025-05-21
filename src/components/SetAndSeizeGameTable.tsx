import React from 'react';
import useSetAndSeizeGameLogic from '../hooks/useSetAndSeizeGameLogic';
import CardDisplay from './CardDisplay'; // Import the CardDisplay component
import Menu from './Menu'; // Import the Menu component
import { Card } from '../types'; // Assuming Card type is in types/index.ts

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
    initializeGame,
    playCard,
    hasPlayedCardThisTurn, // Destructure the new state
  } = useSetAndSeizeGameLogic({ isOnline });

  return (
    <div
      className="relative flex flex-col h-full game-table-background text-white items-center p-1" // Changed background, Removed justify-between, adjusted padding
      style={{ maxWidth: '26.875rem' }} // Max width to match Brazilian Poker GameTable
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
            {aiCollected.slice(0, 5).map((card, index) => (
              <CardDisplay key={index} card={card} isSmall={true} />
            ))}
            {aiCollected.length > 5 && <span className="text-sm ml-2">+{aiCollected.length - 5} more</span>}
          </div>
        </div>
      </div>

      {/* Middle Area: Table Cards */}
      <div className="game-info-area w-full flex-grow flex flex-col items-center justify-center space-y-0.5 overflow-y-auto py-1">
        <h3 className="text-2xl font-bold mb-4">Middle Cards</h3>
        <div className="flex flex-wrap justify-center min-h-[90px] border border-gray-600 rounded p-2 bg-gray-700">
          {middleCards.length > 0 ? (
            middleCards.map((card, index) => (
              <CardDisplay key={index} card={card} />
            ))
          ) : (
            <p className="text-gray-400">No cards in the middle.</p>
          )}
        </div>
        <p className="text-lg mt-2">Current Player: {currentPlayer === 'player' ? 'You' : 'AI'}</p>
        {mustCapture && <p className="text-red-400 font-bold">MUST CAPTURE!</p>}
      </div>

      {/* Bottom Area: Player Hand and Player Collected */}
      <div className="w-full player-area self-area my-1">
        <h3 className="text-xl font-semibold mb-2 text-center">Your Hand</h3>
        <div className="flex justify-center space-x-1">
          {playerHand.length > 0 ? (
            playerHand.map((card, index) => (
                <button
                  key={index}
                  onClick={() => playCard(card, 'drop')} // Default to 'drop' action for now
                  className="hover:scale-105 transition-transform"
                  disabled={currentPlayer !== 'player' || hasPlayedCardThisTurn} // Disable if not player's turn or card already played
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
            {playerCollected.slice(0, 5).map((card, index) => (
              <CardDisplay key={index} card={card} isSmall={true} />
            ))}
            {playerCollected.length > 5 && <span className="text-sm ml-2">+{playerCollected.length - 5} more</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetAndSeizeGameTable;

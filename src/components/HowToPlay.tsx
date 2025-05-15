import React from 'react';

// Re-adding onNavigateBack prop
interface HowToPlayProps {
  onNavigateBack: () => void;
}

const HowToPlay: React.FC<HowToPlayProps> = ({ onNavigateBack }) => {
  return (
    // Adjusted vertical padding: pt-12 (3rem) for top, pb-12 (3rem) for bottom.
    // px-4 for side padding.
    <div className="text-white max-w-2xl mx-auto px-4 pt-12 pb-12"> 
      <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-center">How to Play Brazilian Poker</h1>
      
      <div className="space-y-4 text-base sm:text-lg"> {/* Adjusted spacing and base font for content */}
        <p className="text-lg sm:text-xl font-semibold">Objective:</p> {/* Ensure consistent heading sizes */}
        <p>Be the player who wins the majority of five individual Poker hands against your opponent.</p>

        <p className="text-lg sm:text-xl font-semibold mt-4">Setup:</p> {/* Ensure consistent heading sizes */}
        <ul className="list-disc list-inside ml-4 space-y-1">
          <li>Each player has five empty hands to build.</li>
          <li>At the start, one card is dealt face-up into each of your five hands.</li>
        </ul>

        <p className="text-lg sm:text-xl font-semibold mt-4">Gameplay:</p> {/* Ensure consistent heading sizes */}
        <ol className="list-decimal list-inside ml-4 space-y-2">
          <li><strong>Draw a Card:</strong> On your turn, draw one card from the deck.</li>
          <li><strong>Place the Card:</strong> Place the drawn card into one of your five hands. Cards are added to the next available empty slot in that hand.</li>
          <li><strong>Placement Rules:</strong>
            <ul className="list-disc list-inside ml-6 text-base">
              <li>To place the <strong>3rd card</strong> in any hand, all your other hands must have at least 2 cards.</li>
              <li>To place the <strong>4th card</strong> in any hand, all your other hands must have at least 3 cards.</li>
              <li>To place the <strong>5th card</strong> in any hand, all your other hands must have at least 4 cards.</li>
            </ul>
          </li>
          <li><strong>Hidden Card:</strong> Your opponent's 5th card in each of their hands will be hidden until the end of the game. Your 5th cards are visible to you.</li>
          <li><strong>Turns Continue:</strong> Players alternate turns drawing and placing cards.</li>
        </ol>

        <p className="text-lg sm:text-xl font-semibold mt-4">Winning the Game:</p> {/* Ensure consistent heading sizes */}
        <ul className="list-disc list-inside ml-4 space-y-1">
          <li>The game ends when all five hands for both players are complete (each hand has 5 cards).</li>
          <li>Each of your five hands is compared against your opponent's corresponding hand (e.g., your Hand 1 vs. their Hand 1).</li>
          <li>Standard Poker hand rankings (Pair, Two Pair, Straight, Flush, etc.) determine the winner of each individual hand matchup.</li>
          <li>The player who wins more of the five hand matchups wins the overall game! (e.g., winning 3 out of 5 hands).</li>
        </ul>
        
        <p className="mt-6 text-center font-medium">Good luck, and build the best hands!</p>
      </div>

      {/* Button is part of this component again, with margin to separate from content */}
      <div className="mt-10 text-center"> 
        <button
          onClick={onNavigateBack}
          className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-6 rounded-xl text-lg shadow-lg border-2 border-amber-800 hover:border-amber-900 transition duration-150 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-opacity-50"
        >
          Back to Menu
        </button>
      </div>
    </div>
  );
};

export default HowToPlay;

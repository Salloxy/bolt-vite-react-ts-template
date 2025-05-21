import React from 'react';

// Re-adding onNavigateBack prop
type GameName = 'brazilianPoker' | 'setAndSeize';

interface HowToPlayProps {
  gameName: GameName;
  onNavigateBack: () => void;
}

const gameRules: Record<GameName, { title: string; content: JSX.Element }> = {
  brazilianPoker: {
    title: 'How to Play Brazilian Poker',
    content: (
      <>
        <p className="text-lg sm:text-xl font-semibold">Objective:</p>
        <p>Be the player who wins the majority of five individual Poker hands against your opponent.</p>

        <p className="text-lg sm:text-xl font-semibold mt-4">Setup:</p>
        <ul className="list-disc list-inside ml-4 space-y-1">
          <li>Each player has five empty hands to build.</li>
          <li>At the start, one card is dealt face-up into each of your five hands.</li>
        </ul>

        <p className="text-lg sm:text-xl font-semibold mt-4">Gameplay:</p>
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

        <p className="text-lg sm:text-xl font-semibold mt-4">Winning the Game:</p>
        <ul className="list-disc list-inside ml-4 space-y-1">
          <li>The game ends when all five hands for both players are complete (each hand has 5 cards).</li>
          <li>Each of your five hands is compared against your opponent's corresponding hand (e.g., your Hand 1 vs. their Hand 1).</li>
          <li>Standard Poker hand rankings (Pair, Two Pair, Straight, Flush, etc.) determine the winner of each individual hand matchup.</li>
          <li>The player who wins more of the five hand matchups wins the overall game! (e.g., winning 3 out of 5 hands).</li>
        </ul>
        
        <p className="mt-6 text-center font-medium">Good luck, and build the best hands!</p>
      </>
    ),
  },
  setAndSeize: {
    title: 'How to Play: Set & Seize',
    content: (
      <>
        <p className="text-lg sm:text-xl font-semibold">Objective</p>
        <p>Score the most points by capturing key cards and collecting the most cards and spades using smart plays, builds, and timing.</p>

        <p className="text-lg sm:text-xl font-semibold mt-4">Setup</p>
        <ul className="list-disc list-inside ml-4 space-y-1">
          <li>Use a standard 52-card deck.</li>
          <li>Deal 4 cards face-down to each player.</li>
          <li>Deal 4 cards face-up to the middle of the table.</li>
        </ul>

        <p className="text-lg sm:text-xl font-semibold mt-4">Card Values</p>
        <ul className="list-disc list-inside ml-4 space-y-1">
          <li>2 through 10: Face value</li>
          <li>Jack (J): 11</li>
          <li>Queen (Q): 12</li>
          <li>King (K): 13</li>
          <li>Ace (A): either 1 or 14 (you choose when you play it)</li>
        </ul>

        <p className="text-lg sm:text-xl font-semibold mt-4">Gameplay</p>
        <p>Players take turns. Player 1 starts the first round.</p>
        <p>Each player must play exactly 1 card per turn.</p>

        <p className="text-lg sm:text-xl font-semibold mt-4">On Your Turn, You Can:</p>
        <ol className="list-decimal list-inside ml-4 space-y-2">
          <li><strong>Capture</strong>
            <ul className="list-disc list-inside ml-6 text-base">
              <li>Play a card whose value equals the sum of one or more cards in the middle.</li>
              <li>You capture all valid combinations that sum to your played card's value.</li>
              <li>You also take your played card into your collected pile.</li>
              <li>Example:
                <ul className="list-disc list-inside ml-6 text-base">
                  <li>You play an 8</li>
                  <li>Middle cards: 2, 3, 5, 6</li>
                  <li>Valid sets: 2+6 = 8, 3+5 = 8</li>
                  <li>You capture all four cards (2, 3, 5, 6) with your 8</li>
                </ul>
              </li>
            </ul>
          </li>
          <li><strong>Build</strong>
            <p>Instead of capturing, you may "build" toward a card value for future capture. You can build only if you have a card in your hand that matches the build’s total.</p>
            <h3 className="text-md sm:text-lg font-semibold mt-2">A. Soft Build</h3>
            <ul className="list-disc list-inside ml-6 text-base">
              <li>Combine your played card with one or more cards from the middle to create a new total.</li>
              <li>This build is not protected and can be built upon by your opponent.</li>
            </ul>
            <h3 className="text-md sm:text-lg font-semibold mt-2">B. Hard Build</h3>
            <ul className="list-disc list-inside ml-6 text-base">
              <li>A protected build that cannot be modified further.</li>
              <li>You can create a hard build in two ways:
                <ul className="list-disc list-inside ml-6 text-base">
                  <li>From the middle: Add a card of the same total value from the middle.</li>
                  <li>From your hand: Add a card of the same total value from your hand.</li>
                </ul>
              </li>
              <li>By combining multiple builds: You may combine two builds of the same value to form a hard build.</li>
              <li>Example: Middle has 5 and 3.
                <ul className="list-disc list-inside ml-6 text-base">
                  <li>You hold two 8s.</li>
                  <li>You play one 8 on top of 5+3 to hard build an 8.</li>
                  <li>You'll capture it next turn with your second 8.</li>
                </ul>
              </li>
            </ul>
            <h3 className="text-md sm:text-lg font-semibold mt-2">Stacking Builds</h3>
            <ul className="list-disc list-inside ml-6 text-base">
              <li>You can build on top of an existing soft build only if it was created by your opponent. Once you create a soft build, you are under the must capture rule and cannot build on it further yourself.</li>
              <li>Add cards (from hand or middle) to increase the build’s value.</li>
              <li>You must have a card in your hand equal to the new total.</li>
              <li>You may only do this if the existing build is not hard.</li>
              <li>Example:
                <ul className="list-disc list-inside ml-6 text-base">
                  <li>Player A built a soft 8 (5 + 3).</li>
                  <li>Player B plays a 4 on top, making the build a 12.</li>
                  <li>Player B must have a Queen (12) in hand to do this.</li>
                </ul>
              </li>
            </ul>
            <h3 className="text-md sm:text-lg font-semibold mt-2">Multiple Builds in a Turn</h3>
            <ul className="list-disc list-inside ml-6 text-base">
              <li>You may also create more than one build in a single turn, as long as each build follows the standard build rules.</li>
              <li>Example: You have an 8 and a 3 in hand. The middle has a 5, 7, and an Ace.
                <ul className="list-disc list-inside ml-6 text-base">
                  <li>You play your 3 on the 5 to create a soft 8.</li>
                  <li>You then use the 7 and Ace from the middle to create another 8.</li>
                  <li>Since two builds of the same value (8) exist, you can combine them into a hard build, even though you did not use an 8 card.</li>
                </ul>
              </li>
            </ul>
            <h3 className="text-md sm:text-lg font-semibold mt-2">Must Capture Rule (Ongoing)</h3>
            <ul className="list-disc list-inside ml-6 text-base">
              <li>Once you initiate a build (even if stacked), you are under a "must capture" obligation on your future turns, meaning you must attempt to capture something (not necessarily your build), until:
                <ul className="list-disc list-inside ml-6 text-base">
                  <li>You successfully capture your build,</li>
                  <li>Or your opponent captures it,</li>
                  <li>Or your opponent stack builds on it.</li>
                </ul>
              </li>
              <li>However, there is one exception: If you are able to create a new soft or hard build of the same value as your existing build, you are allowed to do so instead of capturing.</li>
              <li>Example: You previously made a soft 14 build. On your next turn, if you are able to create another soft 14 or a hard 14 build, you may do so and the must-capture condition remains active.</li>
              <li>During this time, you cannot drop or make unrelated plays — you must attempt a capture or a qualifying same-value build each turn.</li>
            </ul>
          </li>
          <li><strong>Drop</strong>
            <ul className="list-disc list-inside ml-6 text-base">
              <li>You can drop a card to the middle (even if you could have captured or built).</li>
              <li>The dropped card becomes part of the middle.</li>
              <li>You may choose this to manipulate future opportunities or disrupt opponents.</li>
            </ul>
          </li>
        </ol>

        <p className="text-lg sm:text-xl font-semibold mt-4">New Hands</p>
        <ul className="list-disc list-inside ml-4 space-y-1">
          <li>Once both players play all 4 cards:
            <ul className="list-disc list-inside ml-6 text-base">
              <li>Deal 4 new cards to each player (face down)</li>
              <li>Do not add cards to the middle</li>
            </ul>
          </li>
          <li>Repeat until the entire deck is used</li>
        </ul>

        <p className="text-lg sm:text-xl font-semibold mt-4">Final Capture</p>
        <ul className="list-disc list-inside ml-4 space-y-1">
          <li>At the end of the game, if any cards remain in the middle:
            <ul className="list-disc list-inside ml-6 text-base">
              <li>The last player who made a capture gets all remaining middle cards</li>
            </ul>
          </li>
        </ul>

        <p className="text-lg sm:text-xl font-semibold mt-4">Scoring</p>
        <p>After all cards are played, tally the following points:</p>
        <table className="table-auto w-full text-left mt-2 border-collapse">
          <thead>
            <tr>
              <th className="px-4 py-2 border border-gray-600">Scoring Category</th>
              <th className="px-4 py-2 border border-gray-600">Points</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-4 py-2 border border-gray-600">Each Ace (A♠, A♣, A♦, A♥)</td>
              <td className="px-4 py-2 border border-gray-600">1 pt</td>
            </tr>
            <tr>
              <td className="px-4 py-2 border border-gray-600">2 of Spades (2♠)</td>
              <td className="px-4 py-2 border border-gray-600">1 pt</td>
            </tr>
            <tr>
              <td className="px-4 py-2 border border-gray-600">10 of Diamonds (10♦)</td>
              <td className="px-4 py-2 border border-gray-600">2 pts</td>
            </tr>
            <tr>
              <td className="px-4 py-2 border border-gray-600">Player with most Spades collected</td>
              <td className="px-4 py-2 border border-gray-600">1 pt</td>
            </tr>
            <tr>
              <td className="px-4 py-2 border border-gray-600">Player with most total cards</td>
              <td className="px-4 py-2 border border-gray-600">3 pts</td>
            </tr>
            <tr>
              <td className="px-4 py-2 border border-gray-600 font-bold">TOTAL</td>
              <td className="px-4 py-2 border border-gray-600 font-bold">11 pts</td>
            </tr>
          </tbody>
        </table>
        <p className="text-lg sm:text-xl font-semibold mt-4">Tiebreaker Note:</p>
        <ul className="list-disc list-inside ml-4 space-y-1">
          <li>If both players collected 26 cards each, the 3 points for most cards are not awarded</li>
          <li>In this case, only 8 points total are in play</li>
        </ul>

        <p className="text-lg sm:text-xl font-semibold mt-4">Winning</p>
        <ul className="list-disc list-inside ml-4 space-y-1">
          <li>The player with the most points wins</li>
          <li>In case of a tie in points, the game ends in a draw</li>
        </ul>
      </>
    ),
  },
};

const HowToPlay: React.FC<HowToPlayProps> = ({ gameName, onNavigateBack }) => {
  const { title, content } = gameRules[gameName];

  return (
    <div className="text-white max-w-2xl mx-auto px-4 pt-12 pb-12">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-center">{title}</h1>
      
      <div className="space-y-4 text-base sm:text-lg">
        {content}
      </div>

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

// src/App.tsx
import React, { useState, useEffect, useCallback } from 'react'; // Added useCallback
import GameTable from './components/GameTable';
import Menu from './components/Menu'; // Import the Menu component

type GameMode = null | 'ai' | 'online';

// Define the viewport dimensions at which the rem-based fluid layout
// is designed to look perfect without any overall scaling.
const DESIGN_TARGET_WIDTH = 430;  // Adjusted: Minimum width for ideal rem-based layout
const DESIGN_TARGET_HEIGHT = 680; // Adjusted minimum height for ideal rem-based layout
const BASE_ROOT_FONT_SIZE = 16; // Your default root font-size in px

function App() {
  const [gameMode, setGameMode] = useState<GameMode>(null);
  const [gameAreaStyle, setGameAreaStyle] = useState<React.CSSProperties>({});
  const [restartTrigger, setRestartTrigger] = useState(0); // State to trigger GameTable remount

  const goToHome = useCallback(() => {
    setGameMode(null);
  }, []); // setGameMode is stable

  const restartGame = useCallback(() => {
    // To restart GameTable, we change its key, forcing a remount.
    // This ensures useGameLogic is re-initialized.
    setRestartTrigger(prev => prev + 1);
  }, []); // setRestartTrigger is stable

  useEffect(() => {
    const handleResize = () => {
      const currentWidth = window.innerWidth;
      const currentHeight = window.innerHeight;

      let scaleFactor = 1;

      // Calculate scale based on width and height relative to design targets
      const widthScale = currentWidth / DESIGN_TARGET_WIDTH;
      const heightScale = currentHeight / DESIGN_TARGET_HEIGHT;

      // Determine if we are on a "large" screen that should pillarbox (wider and taller than design target)
      const isLargeScreenForPillarbox = currentWidth > DESIGN_TARGET_WIDTH && currentHeight > DESIGN_TARGET_HEIGHT;

      let newGameStyle: React.CSSProperties = { width: '100%', height: '100%' };

      if (isLargeScreenForPillarbox) {
        scaleFactor = heightScale; // Scale root font by height
        // Calculate the width the game area should occupy to maintain its design aspect ratio
        // when scaled to fit the screen height.
        const pillarboxedWidth = DESIGN_TARGET_WIDTH * scaleFactor;
        newGameStyle = {
          width: `${pillarboxedWidth}px`,
          height: `${currentHeight}px`, // It will fill height due to parent
          margin: '0 auto' // Center it
        };
      } else {
        scaleFactor = Math.min(widthScale, heightScale); // Fit content
        // On smaller screens, GameTable's parent div takes w-screen h-screen,
        // and GameTable's internal max-width (26.875rem) will apply.
        // So, no specific style needed here for the wrapper beyond full size.
      }
      
      document.documentElement.style.fontSize = `${BASE_ROOT_FONT_SIZE * scaleFactor}px`;
      setGameAreaStyle(newGameStyle);
    };

    handleResize(); // Initial call
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      // Optionally reset font size on component unmount, though usually not necessary for root
      // document.documentElement.style.fontSize = `${BASE_ROOT_FONT_SIZE}px`;
    };
  }, []);

  if (!gameMode) {
    return (
      // This initial screen should also be responsive.
      // Using flex to center content within the full viewport height.
      <div className="w-screen h-screen flex flex-col items-center justify-center p-4 bg-gray-900 text-white">
        <h1 className="text-5xl font-bold mb-12 text-center">Brazilian Poker</h1>
        <div className="space-y-6 flex flex-col items-center">
          <button
            onClick={() => setGameMode('ai')}
            className="w-64 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg text-xl shadow-lg transition duration-150 ease-in-out transform hover:scale-105"
          >
            Play vs AI
          </button>
          <button
            onClick={() => setGameMode('online')}
            className="w-64 bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-lg text-xl shadow-lg transition duration-150 ease-in-out transform hover:scale-105"
          >
            Play Online
          </button>
        </div>
      </div>
    );
  }

  // The outer div ensures full screen and provides a fallback background.
  // The inner div (gameAreaWrapper) gets dynamic styles for width/centering (pillarboxing)
  // and also uses flex to center GameTable if GameTable is narrower than it.
  return (
    <div className="w-screen h-screen bg-gray-800 text-white"> {/* Removed relative positioning, Menu will be inside GameTable */}
      <div 
        style={gameAreaStyle} 
        className="flex justify-center items-center h-full" // Ensure this wrapper also centers its child and takes full height
      > 
        {/* Use restartTrigger in the key to force remount on restart */}
        {gameMode && (
          <GameTable 
            key={`${gameMode}-${restartTrigger}`} 
            isOnline={gameMode === 'online'} 
            onGoHome={goToHome} 
            onRestartGame={restartGame} 
          />
        )}
      </div>
    </div>
  );
}

export default App;

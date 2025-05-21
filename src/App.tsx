// src/App.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react'; // Added useRef
import GameTable from './components/GameTable';
import HowToPlay from './components/HowToPlay'; // Import the HowToPlay component
import SetAndSeizeGameTable from './components/SetAndSeizeGameTable'; // Import Set & Seize game table
// Menu component is not directly used in App.tsx for rendering views anymore,
// but GameTable might still use it internally or we might add a main menu component later.
// For now, the main menu is directly in App.tsx.

type GameMode = null | 'ai' | 'online';
type SelectedGame = null | 'brazilianPoker' | 'setAndSeize';
type CurrentView = 'gameSelectionMenu' | 'brazilianPokerMenu' | 'game' | 'howToPlay' | 'setAndSeizeMenu'; // Added setAndSeizeMenu

// Define the viewport dimensions at which the rem-based fluid layout
// is designed to look perfect without any overall scaling.
const DESIGN_TARGET_WIDTH = 430;  // Adjusted: Minimum width for ideal rem-based layout
const DESIGN_TARGET_HEIGHT = 680; // Adjusted minimum height for ideal rem-based layout
const BASE_ROOT_FONT_SIZE = 16; // Your default root font-size in px

function App() {
  const [currentView, setCurrentView] = useState<CurrentView>('gameSelectionMenu');
  const [selectedGame, setSelectedGame] = useState<SelectedGame>(null);
  const howToPlayScrollRef = useRef<HTMLDivElement>(null); // Ref for the scrollable container
  const [gameMode, setGameMode] = useState<GameMode>(null);
  const [gameAreaStyle, setGameAreaStyle] = useState<React.CSSProperties>({});
  const [restartTrigger, setRestartTrigger] = useState(0); // State to trigger GameTable remount

  const navigateToGameSelectionMenu = useCallback(() => {
    setCurrentView('gameSelectionMenu');
    setSelectedGame(null);
    setGameMode(null);
  }, []);

  const navigateToBrazilianPokerMenu = useCallback(() => {
    setSelectedGame('brazilianPoker');
    setCurrentView('brazilianPokerMenu');
  }, []);

  const navigateToSetAndSeizeGame = useCallback(() => {
    setSelectedGame('setAndSeize');
    setCurrentView('setAndSeizeMenu'); // This view will render SetAndSeizeGameTable
  }, []);

  const navigateToHowToPlay = useCallback(() => {
    // Assuming "How To Play" is specific to Brazilian Poker for now
    // This might need adjustment if Set & Seize has its own How To Play
    setCurrentView('howToPlay');
  }, []);

  const startGame = useCallback((mode: 'ai' | 'online') => {
    // This function is now specific to starting Brazilian Poker
    if (selectedGame === 'brazilianPoker') {
      setGameMode(mode);
      setCurrentView('game');
    }
    // Add logic for Set & Seize if it also uses 'ai'/'online' modes
  }, [selectedGame]);

  const restartGame = useCallback(() => {
    // To restart GameTable, we change its key, forcing a remount.
    // This ensures useGameLogic is re-initialized.
    setRestartTrigger(prev => prev + 1);
  }, []); // setRestartTrigger is stable

  useEffect(() => {
    // Scroll "How To Play" to top when view changes to it
    if (currentView === 'howToPlay' && howToPlayScrollRef.current) {
      howToPlayScrollRef.current.scrollTop = 0;
    }
  }, [currentView]);

  useEffect(() => {
    const handleResize = () => {
      // If not in game view, perhaps we don't need strict scaling,
      // or apply a different scaling logic. For now, keep it consistent.
      const currentWidth = window.innerWidth;
      const currentHeight = window.innerHeight;

      // Always scale to fit, maintaining aspect ratio (contain)
      const scaleFactor = Math.min(
        currentWidth / DESIGN_TARGET_WIDTH,
        currentHeight / DESIGN_TARGET_HEIGHT
      );

      // Set the root font size based on this scale factor
      document.documentElement.style.fontSize = `${BASE_ROOT_FONT_SIZE * scaleFactor}px`;

      // The game area wrapper will take the scaled dimensions
      const gameAreaWidth = DESIGN_TARGET_WIDTH * scaleFactor;
      const gameAreaHeight = DESIGN_TARGET_HEIGHT * scaleFactor;

      setGameAreaStyle({
        width: `${gameAreaWidth}px`,
        height: `${gameAreaHeight}px`,
        // The parent div in App.tsx's return is already display:flex, justify-center, items-center
        // which will center this gameAreaStyle div.
      });
    };

    handleResize(); // Initial call
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      // Optionally reset font size on component unmount, though usually not necessary for root
      // document.documentElement.style.fontSize = `${BASE_ROOT_FONT_SIZE}px`;
    };
  }, []);

  if (currentView === 'gameSelectionMenu') {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center p-4" style={{ backgroundColor: '#003049' }}>
        <h1
          className="font-extrabold text-cyan-400 tracking-wider mb-12 whitespace-nowrap text-center text-5xl sm:text-6xl md:text-7xl"
          style={{ textShadow: '3px 3px 0px rgba(0,0,0,0.7), 0 0 10px rgba(0,255,255,0.5)' }}
        >
          Game Center
        </h1>
        <div className="space-y-6 flex flex-col items-center">
          <button
            onClick={navigateToBrazilianPokerMenu}
            className="w-96 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-6 px-8 rounded-xl text-3xl shadow-xl border-2 border-emerald-800 hover:border-emerald-900 transition duration-150 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-opacity-50"
          >
            Brazilian Poker
          </button>
          {/*
          <button
            onClick={navigateToSetAndSeizeGame}
            className="w-96 bg-sky-600 hover:bg-sky-700 text-white font-bold py-6 px-8 rounded-xl text-3xl shadow-xl border-2 border-sky-800 hover:border-sky-900 transition duration-150 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-opacity-50"
          >
            Set & Seize
          </button>
          */}
        </div>
      </div>
    );
  }

  if (currentView === 'brazilianPokerMenu') {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center p-4" style={{ backgroundColor: '#003049' }}>
        {/* Game Logo/Title Area */}
        <div className="mb-4 text-center"> {/* Retaining compact margin from previous attempt */}
          {/* Placeholder for a more complex visual logo if desired */}
          {/* Example: <img src="/public/cards/card-back.svg" alt="Card Icon" className="w-24 h-auto mx-auto mb-2 opacity-50" /> */}
          <h1 
            className="text-6xl font-extrabold text-yellow-400 tracking-wider" 
            style={{ textShadow: '3px 3px 0px rgba(0,0,0,0.7), 0 0 10px rgba(255,215,0,0.5)' }} // More prominent shadow, slight glow
          >
            Brazilian Poker
          </h1>
        </div>

        <p className="text-3xl font-semibold mb-4">Welcome!</p>
        <p className="text-xl text-gray-200 mb-6 text-center px-4">Select an option below to start your game.</p> {/* Retaining compact margin */}

        <div className="space-y-3 flex flex-col items-center"> {/* Retaining compact spacing */}
          <button
            onClick={() => startGame('ai')}
            className="w-72 bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-4 px-6 rounded-xl text-2xl shadow-xl border-2 border-yellow-700 hover:border-yellow-800 transition duration-150 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-opacity-50"
          >
            Play vs AI
          </button>
          <button
            onClick={() => startGame('online')}
            className="w-72 bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-4 px-6 rounded-xl text-2xl shadow-xl border-2 border-yellow-700 hover:border-yellow-800 transition duration-150 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-opacity-50"
          >
            Play Online
          </button>
          <button
            onClick={navigateToHowToPlay}
            className="w-72 bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-6 rounded-xl text-xl shadow-lg border-2 border-amber-800 hover:border-amber-900 transition duration-150 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-opacity-50"
          >
            How To Play
          </button>
        </div>

        <p className="mt-6 text-xs text-gray-300 text-center px-6"> {/* Removed absolute positioning, added mt-6 */}
          By pressing "Play vs AI" or "Play Online", I confirm that I have read and accepted the Terms & Conditions and Privacy Policy.
        </p>
        <button
          onClick={navigateToGameSelectionMenu} // Go back to game selection
          className="mt-8 bg-gray-700 hover:bg-gray-800 text-white font-semibold py-2 px-4 rounded-lg text-sm shadow-md transition duration-150 ease-in-out"
        >
          Back to Game Selection
        </button>
      </div>
    );
  }

  if (currentView === 'howToPlay') {
    return (
      // Simple full-screen scrollable container.
      // HowToPlay component will manage all its internal layout and padding.
      <div
        ref={howToPlayScrollRef} // Assign the ref here
        className="w-screen h-screen overflow-y-auto text-white" style={{ backgroundColor: '#003049' }} // Changed background
      >
        <HowToPlay onNavigateBack={navigateToBrazilianPokerMenu} /> {/* Changed to navigate back to Brazilian Poker Menu */}
      </div>
    );
  }

  // currentView === 'game'
  if (currentView === 'game' && gameMode && selectedGame === 'brazilianPoker') { // Ensure it's Brazilian Poker game
    return (
      <div className="w-screen h-screen text-white flex justify-center items-center" style={{ backgroundColor: '#003049' }}> {/* Changed background */}
        <div
          style={gameAreaStyle}
          // This div now has explicit scaled width and height.
        >
          <GameTable
            key={`${gameMode}-${restartTrigger}`}
            isOnline={gameMode === 'online'}
            onGoHome={navigateToBrazilianPokerMenu} // Changed to navigate back to Brazilian Poker Menu
            onRestartGame={restartGame}
          />
        </div>
      </div>
    );
  }

  if (currentView === 'setAndSeizeMenu' && selectedGame === 'setAndSeize') {
    return (
      <div className="w-screen h-screen text-white flex justify-center items-center" style={{ backgroundColor: '#003049' }}> {/* Use consistent background */}
        <div
          style={gameAreaStyle} // Apply the same scaling as Brazilian Poker
        >
          <SetAndSeizeGameTable onGoHome={navigateToGameSelectionMenu} />
        </div>
      </div>
    );
  }

  // Fallback or loading state, though ideally one of the views above should always match.
  return <div className="w-screen h-screen text-white flex justify-center items-center" style={{ backgroundColor: '#003049' }}><p>Loading...</p></div>; {/* Changed background for fallback */}
}

export default App;

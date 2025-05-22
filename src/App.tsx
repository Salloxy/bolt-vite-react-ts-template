// src/App.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react'; // Added useRef
import GameTable from './components/GameTable';
import SetAndSeizeGameTable from './components/SetAndSeizeGameTable';
import HowToPlay from './components/HowToPlay'; // Import the HowToPlay component
// Menu component is not directly used in App.tsx for rendering views anymore,
// but GameTable might still use it internally or we might add a main menu component later.
// For now, the main menu is directly in App.tsx.

type GameMode = null | 'ai' | 'online';
type SelectedGame = null | 'brazilianPoker' | 'setAndSeize';
type CurrentView = 'gameSelectionMenu' | 'brazilianPokerMenu' | 'setAndSeizeMenu' | 'game' | 'howToPlay';

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

  const navigateToSetAndSeizeMenu = useCallback(() => {
    setSelectedGame('setAndSeize');
    setCurrentView('setAndSeizeMenu');
  }, []);

  const navigateToHowToPlay = useCallback((game: 'brazilianPoker' | 'setAndSeize') => {
    setSelectedGame(game); // Set the selected game before navigating to howToPlay
    setCurrentView('howToPlay');
  }, []);

  const startGame = useCallback((mode: 'ai' | 'online') => {
    if (selectedGame === 'brazilianPoker') {
      setGameMode(mode);
      setCurrentView('game');
      setRestartTrigger(prev => prev + 1); // Increment to force remount
    } else if (selectedGame === 'setAndSeize') {
      setGameMode(mode);
      setCurrentView('game');
      setRestartTrigger(prev => prev + 1); // Increment to force remount
    }
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
          <button
            onClick={navigateToSetAndSeizeMenu}
            className="w-96 bg-blue-600 hover:bg-blue-700 text-white font-bold py-6 px-8 rounded-xl text-3xl shadow-xl border-2 border-blue-800 hover:border-blue-900 transition duration-150 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50"
          >
            Set & Seize
          </button>
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
            onClick={() => navigateToHowToPlay('brazilianPoker')}
            className="w-72 bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-6 rounded-xl text-xl shadow-lg border-2 border-amber-800 hover:border-amber-900 transition duration-150 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-opacity-50"
          >
            How To Play
          </button>
        </div>

        <p className="mt-6 text-xs text-gray-300 text-center px-6">
          By pressing "Play vs AI" or "Play Online", I confirm that I have read and accepted the Terms & Conditions and Privacy Policy.
        </p>
        <button
          onClick={navigateToGameSelectionMenu}
          className="mt-8 bg-gray-700 hover:bg-gray-800 text-white font-semibold py-2 px-4 rounded-lg text-sm shadow-md transition duration-150 ease-in-out"
        >
          Back to Game Selection
        </button>
      </div>
    );
  }

  if (currentView === 'setAndSeizeMenu') {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center p-4" style={{ backgroundColor: '#003049' }}>
        <div className="mb-4 text-center">
          <h1
            className="text-6xl font-extrabold text-blue-400 tracking-wider"
            style={{ textShadow: '3px 3px 0px rgba(0,0,0,0.7), 0 0 10px rgba(0,255,255,0.5)' }}
          >
            Set & Seize
          </h1>
        </div>

        <p className="text-3xl font-semibold mb-4">Welcome!</p>
        <p className="text-xl text-gray-200 mb-6 text-center px-4">Select an option below to start your game.</p>

        <div className="space-y-3 flex flex-col items-center">
          <button
            onClick={() => startGame('ai')}
            className="w-72 bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 px-6 rounded-xl text-2xl shadow-xl border-2 border-blue-700 hover:border-blue-800 transition duration-150 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50"
          >
            Play vs AI
          </button>
          <button
            onClick={() => startGame('online')}
            className="w-72 bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 px-6 rounded-xl text-2xl shadow-xl border-2 border-blue-700 hover:border-blue-800 transition duration-150 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50"
          >
            Play Online
          </button>
          <button
            onClick={() => navigateToHowToPlay('setAndSeize')}
            className="w-72 bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-6 rounded-xl text-xl shadow-lg border-2 border-cyan-800 hover:border-cyan-900 transition duration-150 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-opacity-50"
          >
            How To Play
          </button>
        </div>

        <p className="mt-6 text-xs text-gray-300 text-center px-6">
          By pressing "Play vs AI" or "Play Online", I confirm that I have read and accepted the Terms & Conditions and Privacy Policy.
        </p>
        <button
          onClick={navigateToGameSelectionMenu}
          className="mt-8 bg-gray-700 hover:bg-gray-800 text-white font-semibold py-2 px-4 rounded-lg text-sm shadow-md transition duration-150 ease-in-out"
        >
          Back to Game Selection
        </button>
      </div>
    );
  }

  if (currentView === 'howToPlay' && selectedGame) { // Ensure selectedGame is not null
    return (
      <div
        ref={howToPlayScrollRef}
        className="w-screen h-screen overflow-y-auto text-white" style={{ backgroundColor: '#003049' }}
      >
        <HowToPlay
          gameName={selectedGame}
          onNavigateBack={selectedGame === 'brazilianPoker' ? navigateToBrazilianPokerMenu : navigateToSetAndSeizeMenu}
        />
      </div>
    );
  }

  // currentView === 'game'
  if (currentView === 'game' && gameMode && selectedGame) {
    return (
      <div className="w-screen h-screen text-white flex justify-center items-center" style={{ backgroundColor: '#003049' }}>
        <div
          style={gameAreaStyle}
        >
          {selectedGame === 'brazilianPoker' && (
            <GameTable
              key={`${gameMode}-${restartTrigger}`}
              isOnline={gameMode === 'online'}
              onGoHome={navigateToBrazilianPokerMenu}
              onRestartGame={restartGame}
            />
          )}
          {selectedGame === 'setAndSeize' && (
            <SetAndSeizeGameTable
              key={`${gameMode}-${restartTrigger}`}
              isOnline={gameMode === 'online'}
              onGoHome={navigateToSetAndSeizeMenu}
              onRestartGame={restartGame}
            />
          )}
        </div>
      </div>
    );
  }


  // Fallback or loading state, though ideally one of the views above should always match.
  return <div className="w-screen h-screen text-white flex justify-center items-center" style={{ backgroundColor: '#003049' }}><p>Loading...</p></div>; {/* Changed background for fallback */}
}

export default App;

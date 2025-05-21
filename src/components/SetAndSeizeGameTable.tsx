import React, { useState, useEffect } from 'react';
import useSetAndSeizeLogic, { ActionDetails as HookActionDetails } from '../hooks/useSetAndSeizeLogic'; // Import ActionDetails type
import { SnsCard, SnsSuit, SnsBuild, SnsPlayer } from '../types';

interface SnsCardDisplayProps {
  card: SnsCard;
  onClick?: () => void;
  className?: string;
  isHidden?: boolean;
}

const snsSuitSymbols: Record<SnsSuit, string> = { H: '♥', D: '♦', C: '♣', S: '♠' };
const snsSuitColors: Record<SnsSuit, string> = { H: '#FF0000', D: '#FF0000', C: '#000000', S: '#000000' };

const SnsCardDisplay: React.FC<SnsCardDisplayProps> = ({ card, onClick, className, isHidden }) => {
  const baseCardClasses = "w-[3.2rem] h-[4.5rem] sm:w-[3.5rem] sm:h-[4.9rem] rounded flex items-center justify-center overflow-hidden select-none shadow-sm border border-gray-500 bg-white";
  const combinedClassName = `${baseCardClasses} ${className || ''} ${onClick ? 'cursor-pointer hover:shadow-md transform hover:scale-105 transition-transform' : ''}`;

  if (isHidden) {
    return <div className={`${combinedClassName} bg-blue-700 border-blue-900`} />;
  }
  const rankDisplay = card.rank === 'T' ? '10' : card.rank;
  const color = snsSuitColors[card.suit];
  const symbol = snsSuitSymbols[card.suit];
  return (
    <svg viewBox="0 0 100 150" xmlns="http://www.w3.org/2000/svg" className={combinedClassName} onClick={onClick} aria-label={`${rankDisplay} of ${symbol}`}>
      <rect width="100" height="150" rx="6" ry="6" fill="white" />
      <text x="7" y="20" fontSize="18" fontFamily="Arial, sans-serif" fontWeight="bold" fill={color}>{rankDisplay}</text>
      <text x="9" y="38" fontSize="16" fontFamily="Arial, sans-serif" fill={color}>{symbol}</text>
      <text x="50" y="88" fontSize="40" fontFamily="Arial, sans-serif" fontWeight="bold" fill={color} textAnchor="middle">{symbol}</text>
      <g transform="rotate(180, 50, 75)">
        <text x="7" y="20" fontSize="18" fontFamily="Arial, sans-serif" fontWeight="bold" fill={color}>{rankDisplay}</text>
        <text x="9" y="38" fontSize="16" fontFamily="Arial, sans-serif" fill={color}>{symbol}</text>
      </g>
    </svg>
  );
};

interface SetAndSeizeGameTableProps {
  onGoHome: () => void;
}

const SetAndSeizeGameTable: React.FC<SetAndSeizeGameTableProps> = ({ onGoHome }) => {
  const { gameState, playCard, gameMessages, addGameMessage: logMessage } = useSetAndSeizeLogic(); // Destructure addGameMessage
  const { players, middleCards, currentPlayerId, gamePhase, winnerMessage, mustCaptureBuildId } = gameState;

  const [selectedPlayerCard, setSelectedPlayerCard] = useState<SnsCard | null>(null);
  const [selectedMiddleCards, setSelectedMiddleCards] = useState<SnsCard[]>([]); // Used for *currently selected* middle cards for the active build part
  const [currentAction, setCurrentAction] = useState<HookActionDetails['actionType'] | null>(null);
  const [aceValue, setAceValue] = useState<1 | 14 | undefined>(undefined); // For the selectedPlayerCard

  // New state for multi-build UI
  const [declaredBuildValue, setDeclaredBuildValue] = useState<number | null>(null); // Target value for all builds this turn
  const [confirmedPrimaryBuildMiddleCards, setConfirmedPrimaryBuildMiddleCards] = useState<SnsCard[]>([]); // Middle cards for the build with the played card
  const [confirmedAdditionalBuildGroups, setConfirmedAdditionalBuildGroups] = useState<SnsCard[][]>([]); // Each inner array is a group of SnsCard for an additional build
  const [currentBuildUiStep, setCurrentBuildUiStep] = useState<'idle' | 'definingPrimary' | 'definingAdditional'>('idle'); // UI flow for multi-build

  const [isMakingHardBuild, setIsMakingHardBuild] = useState<boolean>(false);
  const [cardToPairForHardBuild, setCardToPairForHardBuild] = useState<SnsCard | null>(null);
  const [selectedOpponentBuildToStackOn, setSelectedOpponentBuildToStackOn] = useState<SnsBuild | null>(null);

  const player1 = players['player1'];
  const player2 = players['player2'];

  useEffect(() => {
    if (currentAction === 'capture') {
      console.log("Current selected middle cards for capture:", selectedMiddleCards.map(c => c.id));
    }
  }, [selectedMiddleCards, currentAction]);

  const resetSelections = () => {
    setSelectedPlayerCard(null);
    setSelectedMiddleCards([]); // Clear current selections
    setCurrentAction(null);
    setAceValue(undefined);
    // Reset new multi-build states
    setDeclaredBuildValue(null);
    setConfirmedPrimaryBuildMiddleCards([]);
    setConfirmedAdditionalBuildGroups([]);
    setCurrentBuildUiStep('idle');
    // Reset primary build specific states
    setIsMakingHardBuild(false);
    setCardToPairForHardBuild(null);
    setSelectedOpponentBuildToStackOn(null);
  };

  const handlePlayerCardSelect = (card: SnsCard) => {
    // Logic for selecting cardToPairForHardBuild (applies only during primary build definition)
    if (currentAction === 'build' && currentBuildUiStep === 'definingPrimary' && selectedPlayerCard && isMakingHardBuild && card.id !== selectedPlayerCard.id) {
      // Check if this card is already part of confirmedPrimaryBuildMiddleCards or selectedMiddleCards to prevent re-selection for pairing
      const isAlreadyUsedInBuild = confirmedPrimaryBuildMiddleCards.some(c => c.id === card.id) || selectedMiddleCards.some(c => c.id === card.id);
      if (!isAlreadyUsedInBuild) {
        setCardToPairForHardBuild(card);
      } else {
        logMessage("This card is already part of the build.", "error");
      }
      return;
    }

    if (selectedPlayerCard?.id === card.id && card.isAce) {
      setAceValue(prevAceValue => (prevAceValue === 1 ? 14 : 1));
    } else {
      // Reset most things on new player card selection
      resetSelections(); // Call full reset first
      setSelectedPlayerCard(card); // Then set the new card

      if (card.isAce) {
        setAceValue(14); 
      } else {
        setAceValue(undefined);
      }
      // setCurrentAction(null) is handled by resetSelections, forcing action re-selection
      // setCurrentBuildUiStep('idle') is also handled by resetSelections
    }
  };

  const handleMiddleCardSelect = (card: SnsCard) => {
    if (!selectedPlayerCard || currentAction !== 'build' && currentAction !== 'capture') {
      logMessage("Select a player card and an action (Build or Capture) first.", "error");
      return;
    }

    if (currentAction === 'build' && (currentBuildUiStep === 'definingPrimary' || currentBuildUiStep === 'definingAdditional')) {
      // Prevent selecting cards already confirmed for other parts of the multi-build
      if (currentBuildUiStep === 'definingPrimary') {
        // No need to check here as confirmedPrimaryBuildMiddleCards is what we are building
      } else if (currentBuildUiStep === 'definingAdditional') {
        if (confirmedPrimaryBuildMiddleCards.some(c => c.id === card.id) || 
            confirmedAdditionalBuildGroups.flat().some(c => c.id === card.id)) {
          logMessage("This card is already used in another part of your build.", "error");
          return;
        }
      }
      setSelectedMiddleCards(prev =>
        prev.find(c => c.id === card.id) ? prev.filter(c => c.id !== card.id) : [...prev, card]
      );
    } else if (currentAction === 'capture') {
       setSelectedMiddleCards(prev =>
        prev.find(c => c.id === card.id) ? prev.filter(c => c.id !== card.id) : [...prev, card]
      );
    }
  };
  
  const handleBuildClick = (build: SnsBuild) => {
    if (currentAction === 'capture' && selectedPlayerCard) {
      // When a build is clicked during capture mode, it becomes the sole target of the capture.
      // Deselect any other middle cards and select all cards from this build.
      const allCardsFromThisBuildAreSelected = build.cards.every(bc => selectedMiddleCards.some(smc => smc.id === bc.id)) && selectedMiddleCards.length === build.cards.length;

      if (allCardsFromThisBuildAreSelected) {
        // If this exact build is already selected, deselect it.
        setSelectedMiddleCards([]);
      } else {
        // Otherwise, select this build (and only this build).
        setSelectedMiddleCards(build.cards.map(c => ({...c}))); 
      }
      setSelectedOpponentBuildToStackOn(null);
    } else if (currentAction === 'build' && selectedPlayerCard && build.ownerId !== player1.id && !build.isHard) {
        setSelectedOpponentBuildToStackOn(build);
        setSelectedMiddleCards([]); 
    } else if (selectedOpponentBuildToStackOn?.id === build.id) {
        setSelectedOpponentBuildToStackOn(null); 
    }
  };

  const handleConfirmAction = () => {
    if (!selectedPlayerCard || !currentAction) {
      logMessage("No action or player card selected for confirm.", "error");
      return;
    }
    if (currentPlayerId !== player1.id || gamePhase !== 'playing') {
      logMessage("Not your turn or game not in playing phase for confirm.", "error");
      return;
    }

    const details: HookActionDetails = {
      actionType: currentAction,
      playedCardId: selectedPlayerCard.id,
      aceValueChoice: selectedPlayerCard.isAce ? aceValue : undefined, // This is for the played card
    };

    if (currentAction === 'capture') {
      if (selectedMiddleCards.length === 0) {
        logMessage("No cards or build selected for capture.", "error");
        return;
      }
      // selectedMiddleCards should now accurately reflect EITHER a set of loose cards OR all cards from a single clicked build.
      details.selectedMiddleCardIdsForCapture = selectedMiddleCards.map(c => c.id);

    } else if (currentAction === 'build') {
      if (!declaredBuildValue) {
        logMessage("Please declare a target value for your build(s) first.", "error");
        return;
      }
      // For stacking, primary build middle cards are those added to the stack.
      // For new builds, primary build middle cards are those combined with the played card.
      // Additional builds are handled separately.

      if (!selectedOpponentBuildToStackOn) { // New build (not stacking)
        if (currentBuildUiStep === 'idle' || (currentBuildUiStep === 'definingPrimary' && confirmedPrimaryBuildMiddleCards.length === 0 && selectedMiddleCards.length === 0 && !isMakingHardBuild && !cardToPairForHardBuild)) {
           // This condition might need refinement based on full UI flow for primary build confirmation.
           // For now, it checks if we are trying to confirm a build without any middle cards for a soft build.
           // Hard build from hand (cardToPairForHardBuild) doesn't need middle cards for primary.
           // Hard build from middle (isMakingHardBuild true, cardToPairForHardBuild false) will use selectedMiddleCards.
          if (!isMakingHardBuild && !cardToPairForHardBuild && selectedMiddleCards.length === 0 && confirmedPrimaryBuildMiddleCards.length === 0) {
            logMessage("For a soft build, please select cards from the middle to combine with your played card, or confirm your primary build part first.", "error");
            return;
          }
        }
        if (isMakingHardBuild && cardToPairForHardBuild && (selectedMiddleCards.length > 0 || confirmedPrimaryBuildMiddleCards.length > 0)) {
          logMessage("For a hard build pairing with another card from your hand, do not select middle cards for the primary build part.", "error");
          return;
        }
      }
      
      // Consolidate current selections before sending if a part is being defined.
      let finalPrimaryMiddleCards = [...confirmedPrimaryBuildMiddleCards];
      let finalAdditionalGroups = [...confirmedAdditionalBuildGroups];

      if (currentBuildUiStep === 'definingPrimary' && selectedMiddleCards.length > 0 && !selectedOpponentBuildToStackOn) {
        // Attempt to confirm current selectedMiddleCards as the primary build part
        // This logic is similar to the "Confirm Part & Add Another" button's primary part validation
        const playedCardValue = selectedPlayerCard.isAce && aceValue ? aceValue : selectedPlayerCard.value;
        let primaryPartIsValid = false;
        if (isMakingHardBuild) {
          if (cardToPairForHardBuild) {
             primaryPartIsValid = playedCardValue === declaredBuildValue && cardToPairForHardBuild.value === declaredBuildValue && selectedMiddleCards.length === 0;
          } else {
             const sumSelected = selectedMiddleCards.reduce((s, c) => s + c.value, 0);
             primaryPartIsValid = (selectedMiddleCards.length === 1 && playedCardValue === declaredBuildValue && selectedMiddleCards[0].value === declaredBuildValue) ||
                                  (sumSelected === declaredBuildValue && playedCardValue === declaredBuildValue);
          }
        } else {
          const sum = playedCardValue + selectedMiddleCards.reduce((s, c) => s + c.value, 0);
          primaryPartIsValid = sum === declaredBuildValue;
        }
        if (primaryPartIsValid) {
          finalPrimaryMiddleCards = [...selectedMiddleCards];
        } else {
          logMessage("The currently selected cards for the primary build part are invalid. Please correct or clear selection.", "error");
          return;
        }
      } else if (currentBuildUiStep === 'definingAdditional' && selectedMiddleCards.length > 0) {
        // Attempt to confirm current selectedMiddleCards as an additional build part
        const sum = selectedMiddleCards.reduce((s, c) => s + c.value, 0);
        if (sum === declaredBuildValue) {
          finalAdditionalGroups.push([...selectedMiddleCards]);
        } else {
          logMessage("The currently selected cards for the additional build part are invalid. Please correct or clear selection.", "error");
          return;
        }
      }
      
      details.selectedMiddleCardIdsForBuild = finalPrimaryMiddleCards.map(c => c.id);
      details.additionalSelectedMiddleCardGroupsForBuild = finalAdditionalGroups.map(group => group.map(card => card.id));
      details.buildTargetValue = declaredBuildValue;
      
      if (selectedOpponentBuildToStackOn) {
          details.buildToStackOnId = selectedOpponentBuildToStackOn.id;
          details.isHardBuild = false; // Stacking always results in a soft build on top
      } else { // New build (not stacking)
          details.isHardBuild = isMakingHardBuild;
          if (isMakingHardBuild && cardToPairForHardBuild) {
            details.cardToPairForHardBuildId = cardToPairForHardBuild.id;
          }
          // If isMakingHardBuild is true but cardToPairForHardBuildId is not set,
          // the hook will check if selectedMiddleCardIdsForBuild (primary) can form a hard build.
      }
      console.log("[UI handleConfirmAction] Details for BUILD:", JSON.stringify(details));
    }
    
    console.log("Playing card with details:", player1.id, details);
    playCard(player1.id, details);
    resetSelections();
  };

  if (!player1 || !player2) {
    return <div className="flex items-center justify-center h-full text-xl">Loading game...</div>;
  }

  return (
    <div className="flex flex-col h-full p-0.5 sm:p-1 text-white bg-emerald-800">
      <div className="mb-0.5 sm:mb-1 p-0.5 sm:p-1 rounded shadow-sm flex flex-col flex-grow justify-center">
        <h3 className="text-2xs sm:text-xs text-center mb-0.5 text-gray-300">
          Opponent ({player2.id.substring(0,4)}) - Capt: {player2.capturedPile.length}
        </h3>
        <div className="flex justify-center items-center flex-wrap gap-px sm:gap-0.5">
          {player2.hand.map(card => <SnsCardDisplay key={card.id} card={card} className="opacity-80" />)}
          {player2.hand.length === 0 && <p className="text-3xs sm:text-2xs text-gray-400">No cards</p>}
        </div>
      </div>

      <div className="my-0.5 sm:my-1 p-0.5 sm:p-1 border border-dashed border-yellow-700 rounded min-h-[5.5rem] sm:min-h-[6rem] shadow-inner flex flex-col flex-grow justify-center">
        <div className="text-center mb-0.5 sm:mb-1 flex-shrink-0">
          <p className="text-xs sm:text-sm">Turn: <span className="font-semibold text-yellow-300">{currentPlayerId}</span></p>
          <p className="text-2xs sm:text-xs">Phase: {gamePhase} {mustCaptureBuildId && players[currentPlayerId]?.activeBuilds.find(b=>b.id===mustCaptureBuildId) ? `(Must Capture Own Build ${mustCaptureBuildId.substring(0,4)})` : ''}</p>
          {winnerMessage && <p className="text-sm sm:text-base font-bold text-green-400 mt-0.5">{winnerMessage}</p>}
        </div>
        <h2 className="text-xs sm:text-sm text-center mb-0.5 text-yellow-400">
          Middle ({middleCards.length}) & Active Builds ({Object.values(players).flatMap(p => p.activeBuilds).length})
        </h2>
        <div className="flex justify-center items-center flex-wrap gap-px sm:gap-0.5">
          {middleCards.map(card => (
            <SnsCardDisplay 
                key={card.id} 
                card={card} 
                onClick={() => (currentAction === 'capture' || currentAction === 'build') && handleMiddleCardSelect(card)}
                className={`${selectedMiddleCards.find(c=>c.id === card.id) ? 'ring-4 ring-lime-400 shadow-lime-300/50' : ''} ${(currentAction === 'capture' || currentAction === 'build') ? 'cursor-pointer' : ''}`}
            />
          ))}
          {Object.values(players).flatMap(p => p.activeBuilds).map(build => {
            const isPlayerOwner = build.ownerId === player1.id;
            const canStack = currentAction === 'build' && selectedPlayerCard && build.ownerId !== player1.id && !build.isHard;
            const isSelectedToStack = selectedOpponentBuildToStackOn?.id === build.id;
            
            const buildCardIds = build.cards.map(c => c.id);
            // A build is considered selected for capture if ALL its cards are in selectedMiddleCards
            const isSelectedForCapture = currentAction === 'capture' && 
                                         buildCardIds.length > 0 && // Ensure build has cards
                                         buildCardIds.every(id => selectedMiddleCards.some(smc => smc.id === id));
            
            const canBeClickedForCapture = currentAction === 'capture' && selectedPlayerCard;

            return (
              <div
                key={build.id}
                className={`p-1.5 m-1 border-2 rounded-md shadow-lg text-xs sm:text-sm flex flex-col items-center
                            ${isPlayerOwner ? 'border-sky-500 bg-sky-800/60' : 'border-violet-500 bg-violet-800/60'}
                            ${build.isHard ? 'border-dashed border-yellow-400' : ''}
                            ${canStack || canBeClickedForCapture ? 'cursor-pointer hover:opacity-80' : ''}
                            ${isSelectedToStack ? 'ring-4 ring-yellow-500 shadow-yellow-400/50' : ''}
                            ${isSelectedForCapture ? 'ring-4 ring-green-500 shadow-green-400/50' : ''}
                            ${mustCaptureBuildId === build.id && isPlayerOwner ? 'ring-4 ring-red-500 animate-pulse shadow-red-400/60' : ''}
                            `}
                title={`Build by ${build.ownerId}, Value: ${build.totalValue}, ${build.isHard ? "HARD Build" : "Soft Build"}
                        ${canStack ? ' (Click to stack on this build)' : ''}
                        ${canBeClickedForCapture ? ' (Click to select/deselect this build for capture)' : ''}`}
                onClick={() => handleBuildClick(build)}
              >
                <div className="font-semibold mb-1">
                  {build.ownerId === player1.id ? "Your" : "Opponent's"} Build: <span className="text-lg font-bold">{build.totalValue}</span>
                  {build.isHard && <span className="ml-1 px-1.5 py-0.5 text-2xs bg-yellow-500 text-black rounded-full font-bold">HARD</span>}
                </div>
                <div className="flex flex-wrap justify-center gap-0.5">
                  {build.cards.map(c => <SnsCardDisplay key={c.id} card={c} className="w-[2rem] h-[2.8rem] sm:w-[2.2rem] sm:h-[3.1rem] text-[0.5rem]" />)}
                </div>
              </div>
            );
          })}
          {middleCards.length === 0 && Object.values(players).flatMap(p => p.activeBuilds).length === 0 && <p className="text-3xs sm:text-2xs text-gray-400">No cards or builds</p>}
        </div>
      </div>

      <div className="mt-0.5 sm:mt-1 p-0.5 sm:p-1 rounded shadow-sm flex flex-col flex-grow justify-center">
        <h3 className="text-2xs sm:text-xs text-center mb-0.5 text-gray-200">
          Your Hand ({player1.id.substring(0,4)}) - Capt: {player1.capturedPile.length} 
          {selectedPlayerCard ? ` (Play: ${selectedPlayerCard.rank}${selectedPlayerCard.suit}${selectedPlayerCard.isAce && aceValue ? ` as ${aceValue}`:''})` : ''}
          {currentAction === 'build' && declaredBuildValue ? ` (Target Val: ${declaredBuildValue})` : ''}
          {currentAction === 'build' && currentBuildUiStep !== 'idle' ? ` (Step: ${currentBuildUiStep})` : ''}
          {isMakingHardBuild && cardToPairForHardBuild ? ` (Pair: ${cardToPairForHardBuild.rank}${cardToPairForHardBuild.suit})` : ''}
          {selectedOpponentBuildToStackOn ? ` (Stack on: ${selectedOpponentBuildToStackOn.totalValue})` : ''}
        </h3>
        <div className="flex justify-center items-center flex-wrap gap-px sm:gap-0.5">
          {player1.hand.map(card => {
            let canCaptureObligated = false;
            if (mustCaptureBuildId && currentPlayerId === player1.id) {
              const obligatedBuild = player1.activeBuilds.find(b => b.id === mustCaptureBuildId);
              if (obligatedBuild) {
                const cardValueAs1 = card.isAce ? 1 : card.value;
                const cardValueAs14 = card.isAce ? 14 : card.value;
                if (cardValueAs1 === obligatedBuild.totalValue || cardValueAs14 === obligatedBuild.totalValue) {
                  canCaptureObligated = true;
                }
              }
            }
            const isSelectedForHardPair = cardToPairForHardBuild?.id === card.id;
            return (
              <SnsCardDisplay 
                  key={card.id} 
                  card={card} 
                  onClick={() => handlePlayerCardSelect(card)}
                  className={`
                    ${selectedPlayerCard?.id === card.id ? 'ring-4 ring-sky-400 shadow-sky-300/70' : ''} 
                    ${isSelectedForHardPair ? 'ring-4 ring-amber-400 shadow-amber-300/70' : ''}
                    ${canCaptureObligated ? 'ring-4 ring-orange-500 shadow-orange-400/70 animate-pulse' : ''}
                  `}
              />
            );
          })}
          {player1.hand.length === 0 && <p className="text-3xs sm:text-2xs text-gray-400">No cards</p>}
        </div>
      </div>
      
      {currentPlayerId === player1.id && gamePhase === 'playing' && (
        <div className="flex flex-col items-center mt-1 sm:mt-2 flex-shrink-0">
          {!selectedPlayerCard && <p className="text-center text-xs text-gray-400">Select a card from your hand to play.</p>}
          {selectedPlayerCard && (
            () => {
              const obligatedBuildDetails = player1.activeBuilds.find(b => b.id === mustCaptureBuildId);
              const isObligated = !!obligatedBuildDetails;
              let canCaptureObligatedWithAnyHandCard = false;
              if (isObligated && obligatedBuildDetails) {
                canCaptureObligatedWithAnyHandCard = player1.hand.some(handCard => {
                  const val1 = handCard.isAce ? 1 : handCard.value;
                  const val14 = handCard.isAce ? 14 : handCard.value;
                  return val1 === obligatedBuildDetails.totalValue || val14 === obligatedBuildDetails.totalValue;
                });
              }
              const disableDrop = isObligated && canCaptureObligatedWithAnyHandCard;
              const disableBuild = isObligated && canCaptureObligatedWithAnyHandCard;

              return (
                <div className="flex flex-col items-center gap-1">
                  {isObligated && canCaptureObligatedWithAnyHandCard && (
                    <p className="text-xs text-orange-400 font-semibold">You MUST capture your build (value: {obligatedBuildDetails?.totalValue})!</p>
                  )}
                  <div className="flex justify-center items-center gap-1 sm:gap-2">
                    <button 
                      onClick={() => setCurrentAction('drop')} 
                      disabled={disableDrop}
                      className={`px-2 py-1 text-xs sm:text-sm rounded ${currentAction === 'drop' && !disableDrop ? 'bg-blue-600' : 'bg-gray-600 hover:bg-gray-500'} ${disableDrop ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      Drop
                    </button>
                    <button 
                      onClick={() => setCurrentAction('capture')} 
                      className={`px-2 py-1 text-xs sm:text-sm rounded ${currentAction === 'capture' ? 'bg-green-600' : 'bg-gray-600 hover:bg-gray-500'}`}
                    >
                      Capture
                    </button>
                    <button 
                      onClick={() => {
                        setCurrentAction('build');
                        // Reset build-specific states when 'Build' action is re-selected
                        setDeclaredBuildValue(null);
                        setConfirmedPrimaryBuildMiddleCards([]);
                        setConfirmedAdditionalBuildGroups([]);
                        setSelectedMiddleCards([]); // Clear current selections for middle
                        setCurrentBuildUiStep('idle');
                        setIsMakingHardBuild(false); 
                        setCardToPairForHardBuild(null);
                        setSelectedOpponentBuildToStackOn(null);
                      }} 
                      disabled={disableBuild}
                      className={`px-2 py-1 text-xs sm:text-sm rounded ${currentAction === 'build' && !disableBuild ? 'bg-yellow-600 text-black' : 'bg-gray-600 hover:bg-gray-500'} ${disableBuild ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      Build
                    </button>
                  </div>

                  {/* UI for Build Action Steps */}
                  {currentAction === 'build' && selectedPlayerCard && !disableBuild && (
                    <div className="mt-2 flex flex-col items-center gap-2 w-full">
                      {/* Step 1: Declare Build Value */}
                      {currentBuildUiStep === 'idle' && !selectedOpponentBuildToStackOn && (
                        <div className="flex items-center gap-2">
                          <label htmlFor="buildValueInput" className="text-xs">Target Value:</label>
                          <input 
                            type="number" 
                            id="buildValueInput"
                            value={declaredBuildValue || ''}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              setDeclaredBuildValue(isNaN(val) ? null : Math.max(1, Math.min(14, val))); // Assuming values 1-14
                            }}
                            className="p-1 text-xs text-black rounded w-16"
                            placeholder="e.g., 8"
                          />
                          <button
                            onClick={() => {
                              if (declaredBuildValue !== null) {
                                if (selectedOpponentBuildToStackOn) {
                                  // Logic for stacking will use declaredBuildValue as the *final* target
                                  // The primary "part" is adding to the stack.
                                  setCurrentBuildUiStep('definingPrimary'); // Or a specific stacking step
                                } else {
                                  setCurrentBuildUiStep('definingPrimary');
                                }
                              } else {
                                logMessage("Please enter a target value for the build.", "error");
                              }
                            }}
                            disabled={declaredBuildValue === null}
                            className="px-2 py-1 text-xs bg-cyan-600 hover:bg-cyan-500 rounded disabled:opacity-50"
                          >
                            {selectedOpponentBuildToStackOn ? "Set Stack Target" : "Start Primary Build"}
                          </button>
                        </div>
                      )}

                      {/* Step 2 & 3: Defining Primary and Additional Build Parts */}
                      {(currentBuildUiStep === 'definingPrimary' || currentBuildUiStep === 'definingAdditional') && !selectedOpponentBuildToStackOn && (
                        <>
                          <p className="text-xs">
                            {currentBuildUiStep === 'definingPrimary' 
                              ? "Select middle cards for PRIMARY build (with your played card)."
                              : "Select middle cards for an ADDITIONAL build."}
                          </p>
                          {currentBuildUiStep === 'definingPrimary' && (
                             <button 
                                onClick={() => setIsMakingHardBuild(prev => !prev)} 
                                className={`px-2 py-1 text-xs sm:text-sm rounded ${isMakingHardBuild ? 'bg-purple-600' : 'bg-gray-500 hover:bg-gray-400'}`}
                              >
                                {isMakingHardBuild ? 'Make Primary Soft' : 'Make Primary Hard'}
                              </button>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                // Validate current selection against declaredBuildValue
                                if (!declaredBuildValue) {
                                   logMessage("Declare a target build value first.", "error");
                                   return;
                                }
                                let currentPartIsValid = false;
                                const playedCardValue = selectedPlayerCard.isAce && aceValue ? aceValue : selectedPlayerCard.value;

                                if (currentBuildUiStep === 'definingPrimary') {
                                  if (isMakingHardBuild) {
                                    if (cardToPairForHardBuild) { // Hard build from hand
                                       // For hard build from hand, selectedMiddleCards should be empty for the primary part.
                                       currentPartIsValid = playedCardValue === declaredBuildValue && 
                                                            cardToPairForHardBuild.value === declaredBuildValue &&
                                                            selectedMiddleCards.length === 0;
                                    } else { // Hard build from middle (using selectedMiddleCards)
                                       const sumSelected = selectedMiddleCards.reduce((s, c) => s + c.value, 0);
                                       // Type A: Played X + Middle X = Hard X
                                       const typeAValid = selectedMiddleCards.length === 1 && playedCardValue === declaredBuildValue && selectedMiddleCards[0].value === declaredBuildValue;
                                       // Type B: Middle cards sum to X, Played card is X = Hard X
                                       const typeBValid = selectedMiddleCards.length >= 1 && sumSelected === declaredBuildValue && playedCardValue === declaredBuildValue;
                                       currentPartIsValid = typeAValid || typeBValid;
                                       // Type C (played + middle sum to X, another middle X makes it hard) is complex for UI validation, hook handles it.
                                       // For UI, we primarily check if the selected cards *could* form a hard build based on values.
                                    }
                                  } else { // Soft primary build
                                    const sum = playedCardValue + selectedMiddleCards.reduce((s, c) => s + c.value, 0);
                                    // Soft build needs middle cards, OR if it was an attempt at hard build from hand (cardToPairForHardBuild was set) that is now being treated as soft.
                                    currentPartIsValid = sum === declaredBuildValue && (selectedMiddleCards.length > 0 || (isMakingHardBuild && cardToPairForHardBuild !== null && selectedMiddleCards.length === 0) );
                                  }

                                  if (currentPartIsValid) {
                                    setConfirmedPrimaryBuildMiddleCards([...selectedMiddleCards]);
                                    // If hard build from hand was successful, cardToPairForHardBuild is already set.
                                    // If hard build from middle, selectedMiddleCards are used.
                                    setSelectedMiddleCards([]);
                                    setCurrentBuildUiStep('definingAdditional');
                                    // Do not reset isMakingHardBuild or cardToPairForHardBuild here, they define the primary build's nature.
                                  } else {
                                    logMessage("Primary build part is invalid or does not sum to target value.", "error");
                                  }
                                } else { // definingAdditional
                                  const sum = selectedMiddleCards.reduce((s, c) => s + c.value, 0);
                                  currentPartIsValid = sum === declaredBuildValue && selectedMiddleCards.length > 0;
                                  if (currentPartIsValid) {
                                    setConfirmedAdditionalBuildGroups(prev => [...prev, [...selectedMiddleCards]]);
                                    setSelectedMiddleCards([]);
                                    // Stays in 'definingAdditional'
                                  } else {
                                    logMessage("Additional build part does not sum to target value or is empty.", "error");
                                  }
                                }
                              }}
                              disabled={selectedMiddleCards.length === 0 && !(currentBuildUiStep === 'definingPrimary' && isMakingHardBuild && cardToPairForHardBuild && selectedMiddleCards.length === 0)}
                              className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded disabled:opacity-50"
                            >
                              Confirm Part & Add Another
                            </button>
                            <button 
                              onClick={handleConfirmAction} // This will now be "Finalize All Builds"
                              className="px-3 py-1 text-xs sm:text-sm bg-red-600 hover:bg-red-500 rounded font-semibold"
                            >
                              Finalize All Builds
                            </button>
                          </div>
                        </>
                      )}
                       {/* Finalize button for stacking or if only primary build is made without "add another" */}
                       {(currentBuildUiStep === 'definingPrimary' && selectedOpponentBuildToStackOn) && (
                           <button 
                              onClick={handleConfirmAction} 
                              className="mt-2 px-3 py-1 text-xs sm:text-sm bg-red-600 hover:bg-red-500 rounded font-semibold"
                            >
                              Confirm Stack
                            </button>
                       )}
                        {currentBuildUiStep === 'idle' && declaredBuildValue !== null && !selectedOpponentBuildToStackOn && (
                           <button 
                              onClick={handleConfirmAction} // Allows finalizing if only primary is intended and no "add another" clicked
                              className="mt-2 px-3 py-1 text-xs sm:text-sm bg-red-600 hover:bg-red-500 rounded font-semibold"
                            >
                              Finalize Build
                            </button>
                        )}
                    </div>
                  )}
                  {/* General Confirm Button for Drop/Capture - Placed outside build-specific UI */}
                  {(currentAction === 'drop' || currentAction === 'capture') && selectedPlayerCard && (
                     <button 
                        onClick={handleConfirmAction} 
                        className="mt-2 px-3 py-1 text-xs sm:text-sm bg-red-600 hover:bg-red-500 rounded font-semibold"
                      >
                        Confirm {currentAction.charAt(0).toUpperCase() + currentAction.slice(1)}
                      </button>
                  )}
                </div>
              );
            }
          )()}
        </div>
      )}
      {/* Game Messages Display */}
      <div className="mt-1 sm:mt-2 p-1 sm:p-2 bg-gray-900/70 rounded shadow-inner flex-shrink-0 h-24 sm:h-28 overflow-y-auto">
        <h4 className="text-xs sm:text-sm font-semibold text-gray-400 mb-1 border-b border-gray-700 pb-0.5">Game Log</h4>
        {gameMessages.length === 0 && <p className="text-2xs sm:text-xs text-gray-500 italic">No messages yet.</p>}
        {gameMessages.slice().reverse().map(msg => ( // Display newest first
          <div key={msg.id} className={`text-2xs sm:text-xs mb-0.5 ${
            msg.type === 'error' ? 'text-red-400' :
            msg.type === 'success' ? 'text-green-400' :
            msg.type === 'action' ? 'text-blue-300' :
            'text-gray-300' // info
          }`}>
            <span className="text-gray-500 mr-1">[{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
            {msg.text}
          </div>
        ))}
      </div>
       <div className="mt-0.5 sm:mt-1 text-center text-3xs sm:text-2xs text-gray-500 flex-shrink-0">
         {/* onGoHome button would typically be here or outside this component */}
         <button onClick={onGoHome} className="mt-2 px-3 py-1 bg-red-700 hover:bg-red-600 rounded text-xs">Go Home</button>
       </div>
    </div>
  );
};

export default SetAndSeizeGameTable;

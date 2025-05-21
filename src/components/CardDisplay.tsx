// src/components/CardDisplay.tsx
import React from 'react';
import { Card as CardType, Suit, Rank } from '../types';

interface CardDisplayProps {
  card: CardType | null;
  isHidden?: boolean;
  isSmall?: boolean; // For collected cards
  isHandCard?: boolean; // New prop for cards in hand
  className?: string;
}

const suitSymbols: Record<Suit, string> = {
  H: '♥', // Hearts
  D: '♦', // Diamonds
  C: '♣', // Clubs
  S: '♠', // Spades
};

const suitColors: Record<Suit, string> = {
  H: '#FF0000', // Red
  D: '#FF0000', // Red
  C: '#000000', // Black
  S: '#000000', // Black
};

const CardDisplay: React.FC<CardDisplayProps> = ({ card, isHidden, isSmall, isHandCard, className }) => {
  const baseCardClasses = "rounded-lg flex items-center justify-center overflow-hidden select-none";
  let sizeClass = "card-dimensions";
  if (isSmall) {
    sizeClass = "card-dimensions-small";
  } else if (isHandCard) {
    sizeClass = "card-dimensions-hand"; // New class for hand cards
  }
  const combinedClassName = `${baseCardClasses} ${sizeClass} ${className || ''}`;

  // Dimensions for SVG viewBox based on size
  let viewBoxWidth = 100;
  let viewBoxHeight = 150;
  let cornerFontSize = 28;
  let cornerSuitFontSize = 34;
  let centerFontSize = 70;
  let borderRadius = 8;
  let strokeWidth = 1;

  if (isSmall) {
    viewBoxWidth = 60;
    viewBoxHeight = 90;
    cornerFontSize = 16;
    cornerSuitFontSize = 20;
    centerFontSize = 40;
    borderRadius = 4;
    strokeWidth = 0.5;
  } else if (isHandCard) {
    viewBoxWidth = 80; // Slightly smaller than default
    viewBoxHeight = 120; // Slightly smaller than default
    cornerFontSize = 20;
    cornerSuitFontSize = 26;
    centerFontSize = 55;
    borderRadius = 6;
    strokeWidth = 0.75;
  }

  if (isHidden) {
    // Adjust card back dimensions for small cards if needed, or keep standard
    let hiddenViewBoxWidth = 68;
    let hiddenViewBoxHeight = 98;
    let hiddenBorderRadius = 6;
    let hiddenInnerRectRx = 4;
    let hiddenInnerRect2Rx = 3;

    if (isSmall) {
      hiddenViewBoxWidth = 40;
      hiddenViewBoxHeight = 60;
      hiddenBorderRadius = 3;
      hiddenInnerRectRx = 2;
      hiddenInnerRect2Rx = 1.5;
    } else if (isHandCard) {
      hiddenViewBoxWidth = 55; // Adjusted for hand card size
      hiddenViewBoxHeight = 80; // Adjusted for hand card size
      hiddenBorderRadius = 5;
      hiddenInnerRectRx = 3;
      hiddenInnerRect2Rx = 2;
    }

    return (
      <svg viewBox={`0 0 ${hiddenViewBoxWidth} ${hiddenViewBoxHeight}`} xmlns="http://www.w3.org/2000/svg" className={combinedClassName} aria-label="Card back">
        <rect width={hiddenViewBoxWidth} height={hiddenViewBoxHeight} rx={hiddenBorderRadius} ry={hiddenBorderRadius} fill="#FFFFFF"></rect>
        <rect x="3" y="3" width={hiddenViewBoxWidth - 6} height={hiddenViewBoxHeight - 6} rx={hiddenInnerRectRx} ry={hiddenInnerRectRx} fill="#003049"></rect>
        <rect x="5" y="5" width={hiddenViewBoxWidth - 10} height={hiddenViewBoxHeight - 10} rx={hiddenInnerRect2Rx} ry={hiddenInnerRect2Rx} fill="#004060"></rect>
        
        <path d={`M 0 ${hiddenViewBoxHeight / 2} C ${hiddenViewBoxWidth * 0.25} ${hiddenViewBoxHeight * 0.25}, ${hiddenViewBoxWidth * 0.75} ${hiddenViewBoxHeight * 0.25}, ${hiddenViewBoxWidth} ${hiddenViewBoxHeight / 2} S ${hiddenViewBoxWidth * 0.75} ${hiddenViewBoxHeight * 0.75}, ${hiddenViewBoxWidth * 0.25} ${hiddenViewBoxHeight * 0.75}, 0 ${hiddenViewBoxHeight / 2} Z`} fill="#005f73" opacity="0.7"></path>
        
        <defs>
          <linearGradient id="blueGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{stopColor:'#0a9396',stopOpacity:0.5}} />
            <stop offset="100%" style={{stopColor:'#005f73',stopOpacity:0.5}} />
          </linearGradient>
          <pattern id="wavePattern" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M0 5 Q2.5 2.5 5 5 T10 5" stroke="url(#blueGradient)" strokeWidth="0.5" fill="none"/>
          </pattern>
        </defs>
        <rect x="5" y="5" width={hiddenViewBoxWidth - 10} height={hiddenViewBoxHeight - 10} rx={hiddenInnerRect2Rx} ry={hiddenInnerRect2Rx} fill="url(#wavePattern)" opacity="0.3"></rect>
        
        <circle cx={hiddenViewBoxWidth / 2} cy={hiddenViewBoxHeight / 2} r={isSmall ? 5 : (isHandCard ? 7 : 8)} fill="#94d2bd" stroke="#005f73" strokeWidth={isSmall ? 0.5 : (isHandCard ? 0.75 : 1)}></circle>
      </svg>
    );
  }

  if (!card) {
    return null;
  }

  const rankDisplay = card.rank === 'T' ? '10' : card.rank;
  const cornerRankDisplay = card.rank === 'T' ? 'T' : card.rank;
  const color = suitColors[card.suit];
  const symbol = suitSymbols[card.suit];

  return (
    <svg
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      xmlns="http://www.w3.org/2000/svg"
      className={combinedClassName}
      aria-label={`${card.rank} of ${card.suit}`}
    >
      {/* Card Background */}
      <rect width={viewBoxWidth} height={viewBoxHeight} rx={borderRadius} ry={borderRadius} fill="white" stroke="#BCCCDC" strokeWidth={strokeWidth} />

      {/* Top-left Rank and Suit */}
      <text
        x={viewBoxWidth * 0.08}
        y={viewBoxHeight * 0.2}
        fontSize={cornerFontSize}
        fontFamily="Arial, sans-serif"
        fontWeight="bold"
        fill={color}
        textAnchor="start"
      >
        {cornerRankDisplay}
      </text>
      <text
        x={viewBoxWidth * 0.5}
        y={viewBoxHeight * 0.2}
        fontSize={cornerSuitFontSize}
        fontFamily="Arial, sans-serif"
        fontWeight="bold"
        fill={color}
        textAnchor="middle"
      >
        {symbol}
      </text>

      {/* Bottom-right Rank and Suit (rotated) */}
      <g transform={`rotate(180, ${viewBoxWidth / 2}, ${viewBoxHeight / 2})`}>
        <text
          x={viewBoxWidth * 0.08}
          y={viewBoxHeight * 0.2}
          fontSize={cornerFontSize}
          fontFamily="Arial, sans-serif"
          fontWeight="bold"
          fill={color}
          textAnchor="start"
        >
          {cornerRankDisplay}
        </text>
        <text
          x={viewBoxWidth * 0.5}
          y={viewBoxHeight * 0.2}
          fontSize={cornerSuitFontSize}
          fontFamily="Arial, sans-serif"
          fontWeight="bold"
          fill={color}
          textAnchor="middle"
        >
          {symbol}
        </text>
      </g>

      {/* Center Rank (larger) */}
      <text
        x={viewBoxWidth / 2}
        y={viewBoxHeight / 2}
        fontSize={centerFontSize}
        fontFamily="Arial, sans-serif"
        fontWeight="bold"
        fill={color}
        textAnchor="middle"
        dominantBaseline="central"
      >
        {rankDisplay}
      </text>
    </svg>
  );
};

export default CardDisplay;

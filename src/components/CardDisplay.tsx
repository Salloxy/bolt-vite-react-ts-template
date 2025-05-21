// src/components/CardDisplay.tsx
import React from 'react';
import { Card as CardType, Suit, Rank } from '../types';

interface CardDisplayProps {
  card: CardType | null;
  isHidden?: boolean;
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

const CardDisplay: React.FC<CardDisplayProps> = ({ card, isHidden, className }) => {
  const baseCardClasses = "card-dimensions rounded-lg flex items-center justify-center overflow-hidden select-none"; // Use CSS variables via .card-dimensions
  const combinedClassName = `${baseCardClasses} ${className || ''}`;

  if (isHidden) {
    return (
      <svg viewBox="0 0 68 98" xmlns="http://www.w3.org/2000/svg" className={combinedClassName} aria-label="Card back">
        <rect width="68" height="98" rx="6" ry="6" fill="#FFFFFF"></rect>
        <rect x="3" y="3" width="62" height="92" rx="4" ry="4" fill="#003049"></rect> {/* Darkest blue from outer background */}
        <rect x="5" y="5" width="58" height="88" rx="3" ry="3" fill="#004060"></rect> {/* Lighter blue from inner gradient start */}
        
        {/* Central design element - a subtle wave or abstract shape */}
        <path d="M 0 49 C 17 30, 51 30, 68 49 S 51 68, 17 68, 0 49 Z" fill="#005f73" opacity="0.7"></path> {/* Middle blue from inner gradient */}
        
        {/* Subtle pattern using a gradient */}
        <defs>
          <linearGradient id="blueGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{stopColor:'#0a9396',stopOpacity:0.5}} />
            <stop offset="100%" style={{stopColor:'#005f73',stopOpacity:0.5}} />
          </linearGradient>
          <pattern id="wavePattern" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M0 5 Q2.5 2.5 5 5 T10 5" stroke="url(#blueGradient)" strokeWidth="0.5" fill="none"/>
          </pattern>
        </defs>
        <rect x="5" y="5" width="58" height="88" rx="3" ry="3" fill="url(#wavePattern)" opacity="0.3"></rect>
        
        {/* Small central circle for detail */}
        <circle cx="34" cy="49" r="8" fill="#94d2bd" stroke="#005f73" strokeWidth="1"></circle> {/* Lightest blue from inner gradient */}
      </svg>
    );
  }

  if (!card) {
    return null;
  }

  const rankDisplay = card.rank === 'T' ? '10' : card.rank;
  const color = suitColors[card.suit];
  const symbol = suitSymbols[card.suit];

  return (
    <svg
      viewBox="0 0 100 150"
      xmlns="http://www.w3.org/2000/svg"
      className={combinedClassName}
      aria-label={`${card.rank} of ${card.suit}`}
    >
      {/* Card Background */}
      <rect width="100" height="150" rx="8" ry="8" fill="white" stroke="#BCCCDC" strokeWidth="1" />

      {/* Top-left Rank and Suit */}
      <text
        x="8" // Adjusted x for text-anchor start
        y="30" // Adjusted y - moved down for better vertical alignment
        fontSize="28" // Adjusted font size - made bigger
        fontFamily="Arial, sans-serif"
        fontWeight="bold"
        fill={color}
        textAnchor="start" // Corrected text-anchor
      >
        {rankDisplay}
      </text>
      <text
        x="50" // Moved slightly right
        y="30" // Adjusted y - moved down for better vertical alignment
        fontSize="34" // Increased font size for suit symbol
        fontFamily="Arial, sans-serif"
        fontWeight="bold"
        fill={color}
        textAnchor="middle" // Centered the suit symbol
      >
        {symbol}
      </text>

      {/* Bottom-right Rank and Suit (rotated) */}
      <g transform="rotate(180, 50, 75)">
        <text
          x="8" // Adjusted x
          y="30" // Adjusted y - moved down for better vertical alignment
          fontSize="28" // Adjusted font size - made bigger
          fontFamily="Arial, sans-serif"
          fontWeight="bold"
          fill={color}
          textAnchor="start" // Corrected text-anchor
        >
          {rankDisplay}
        </text>
        <text
          x="50" // Adjusted to align with the new top suit position
          y="30" // Adjusted y - moved down for better vertical alignment
          fontSize="34" // Increased font size for suit symbol
          fontFamily="Arial, sans-serif"
          fontWeight="bold"
          fill={color}
          textAnchor="middle" // Centered the suit symbol
        >
          {symbol}
        </text>
      </g>

      {/* Center Rank (larger) */}
      <text
        x="50"
        y="75" // Adjusted y for center - moved up for better alignment
        fontSize="70" // Adjusted font size for center - made bigger
        fontFamily="Arial, sans-serif"
        fontWeight="bold"
        fill={color}
        textAnchor="middle"
        dominantBaseline="central" // More precise vertical centering
      >
        {rankDisplay} {/* Changed to display rank instead of symbol */}
      </text>
    </svg>
  );
};

export default CardDisplay;

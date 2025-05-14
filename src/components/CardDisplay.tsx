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
      <svg
        viewBox="0 0 68 98"
        xmlns="http://www.w3.org/2000/svg"
        className={combinedClassName}
        aria-label="Card back"
      >
        <rect width="68" height="98" rx="6" ry="6" fill="#FFFFFF"/>
        <rect x="3" y="3" width="62" height="92" rx="4" ry="4" fill="#B22222"/> 
        <rect x="5" y="5" width="58" height="88" rx="3" ry="3" fill="#CD5C5C"/> 
        <circle cx="34" cy="49" r="12" fill="#FFA07A" stroke="#B22222" strokeWidth="1"/> 
        <circle cx="34" cy="49" r="8" fill="#DC143C"/> 
        <path d="M 10 10 Q 15 12 12 15 L 15 12 Q 12 15 10 10 Z" fill="#FFA07A" transform="rotate(45 10 10)"/>
        <path d="M 58 10 Q 53 12 56 15 L 53 12 Q 56 15 58 10 Z" fill="#FFA07A" transform="rotate(-45 58 10)"/>
        <path d="M 10 88 Q 15 86 12 83 L 15 86 Q 12 83 10 88 Z" fill="#FFA07A" transform="rotate(-45 10 88)"/>
        <path d="M 58 88 Q 53 86 56 83 L 53 86 Q 56 83 58 88 Z" fill="#FFA07A" transform="rotate(45 58 88)"/>
        <g fill="#FFA07A" opacity="0.6"> 
          <circle cx="18" cy="28" r="1.5"/>
          <circle cx="50" cy="28" r="1.5"/>
          <circle cx="18" cy="70" r="1.5"/>
          <circle cx="50" cy="70" r="1.5"/>
          <circle cx="34" cy="20" r="2"/>
          <circle cx="34" cy="78" r="2"/>
          <circle cx="20" cy="49" r="2"/>
          <circle cx="48" cy="49" r="2"/>
        </g>
        <defs>
          <pattern id="subtleGrid" width="4" height="4" patternUnits="userSpaceOnUse">
            <path d="M 0 2 L 4 2 M 2 0 L 2 4" stroke="#DC143C" strokeWidth="0.3" opacity="0.5"/> 
          </pattern>
        </defs>
        <rect x="5" y="5" width="58" height="88" rx="3" ry="3" fill="url(#subtleGrid)" opacity="0.3"/>
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
        y="25" // Adjusted y
        fontSize="20" // Adjusted font size
        fontFamily="Arial, sans-serif"
        fontWeight="bold"
        fill={color}
        textAnchor="start" // Corrected text-anchor
      >
        {rankDisplay}
      </text>
      <text
        x="32" // Increased x for more space from rank
        y="25" // Adjusted y to align with rank
        fontSize="22" // Increased font size for suit symbol
        fontFamily="Arial, sans-serif"
        fontWeight="bold"
        fill={color}
        textAnchor="start" // Corrected text-anchor
      >
        {symbol}
      </text>

      {/* Bottom-right Rank and Suit (rotated) */}
      <g transform="rotate(180, 50, 75)">
        <text
          x="8" // Adjusted x
          y="25" // Adjusted y
          fontSize="20" // Adjusted font size
          fontFamily="Arial, sans-serif"
          fontWeight="bold"
          fill={color}
          textAnchor="start" // Corrected text-anchor
        >
          {rankDisplay}
        </text>
        <text
          x="32" // Increased x for more space from rank
          y="25" // Adjusted y to align with rank
          fontSize="22" // Increased font size for suit symbol
          fontFamily="Arial, sans-serif"
          fontWeight="bold"
          fill={color}
          textAnchor="start" // Corrected text-anchor
        >
          {symbol}
        </text>
      </g>

      {/* Center Suit Symbol (larger) */}
      <text
        x="50"
        y="80" // Adjusted y for center
        fontSize="50" // Adjusted font size for center
        fontFamily="Arial, sans-serif"
        fontWeight="bold"
        fill={color}
        textAnchor="middle"
        dominantBaseline="central" // More precise vertical centering
      >
        {symbol}
      </text>
    </svg>
  );
};

export default CardDisplay;

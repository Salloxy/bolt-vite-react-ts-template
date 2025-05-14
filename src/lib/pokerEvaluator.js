// src/lib/pokerEvaluator.ts
import { PokerHandRank } from '../types';
import { getRankValue } from './utils';
// Helper to sort cards by rank (Ace high)
const sortCards = (cards) => {
    return [...cards].sort((a, b) => getRankValue(b.rank) - getRankValue(a.rank));
};
// Helper to count rank occurrences
const getRankCounts = (cards) => {
    const counts = {};
    for (const card of cards) {
        counts[card.rank] = (counts[card.rank] || 0) + 1;
    }
    return counts;
};
// Helper to check for flush
const isFlush = (cards) => {
    if (cards.length !== 5)
        return { flush: false };
    const firstSuit = cards[0].suit;
    const flush = cards.every(card => card.suit === firstSuit);
    return { flush, suit: flush ? firstSuit : undefined };
};
// Helper to check for straight
const isStraight = (cards) => {
    if (cards.length !== 5)
        return { straight: false };
    const sortedRanks = sortCards(cards).map(card => getRankValue(card.rank));
    // Check for Ace-low straight (A-2-3-4-5)
    // Ranks: A=14, K=13, Q=12, J=11, T=10, 9=9 ... 2=2
    // A-5-4-3-2 would be [14, 5, 4, 3, 2]
    const isAceLow = sortedRanks[0] === 14 && sortedRanks[1] === 5 && sortedRanks[2] === 4 && sortedRanks[3] === 3 && sortedRanks[4] === 2;
    if (isAceLow)
        return { straight: true, highRank: '5' }; // Ace-low straight, 5 is high card for ranking
    // Check for regular straight
    for (let i = 0; i < sortedRanks.length - 1; i++) {
        if (sortedRanks[i] !== sortedRanks[i + 1] + 1) {
            return { straight: false };
        }
    }
    return { straight: true, highRank: cards[0].rank }; // Highest card of the straight
};
export const evaluateHand = (hand) => {
    const validCards = hand.filter(card => card !== null);
    if (validCards.length !== 5) {
        return null; // Not a full hand
    }
    const sortedHand = sortCards(validCards);
    const rankCounts = getRankCounts(sortedHand);
    const { flush, suit: flushSuit } = isFlush(sortedHand);
    const { straight, highRank: straightHighRank } = isStraight(sortedHand);
    const ranksPresent = Object.keys(rankCounts);
    const counts = Object.values(rankCounts);
    // Straight Flush
    if (straight && flush) {
        let desc = '';
        if (straightHighRank === 'A') {
            desc = 'Royal Flush';
        }
        else if (straightHighRank === '5') {
            // This implies an Ace-low straight (A,2,3,4,5) if it's also a flush
            desc = 'Steel Wheel (5 High Straight Flush)';
        }
        else {
            desc = `${straightHighRank} High Straight Flush`;
        }
        return {
            rank: PokerHandRank.STRAIGHT_FLUSH,
            values: [straightHighRank],
            description: desc
        };
    }
    // Four of a Kind
    if (counts.includes(4)) {
        const fourRank = ranksPresent.find(r => rankCounts[r] === 4);
        const kicker = ranksPresent.find(r => rankCounts[r] === 1);
        return { rank: PokerHandRank.FOUR_OF_A_KIND, values: [fourRank, kicker], description: `Four of a Kind, ${fourRank}s` };
    }
    // Full House
    if (counts.includes(3) && counts.includes(2)) {
        const threeRank = ranksPresent.find(r => rankCounts[r] === 3);
        const pairRank = ranksPresent.find(r => rankCounts[r] === 2);
        return { rank: PokerHandRank.FULL_HOUSE, values: [threeRank, pairRank], description: `Full House, ${threeRank}s over ${pairRank}s` };
    }
    // Flush
    if (flush) {
        return { rank: PokerHandRank.FLUSH, values: sortedHand.map(c => c.rank), description: `${flushSuit} Flush, ${sortedHand[0].rank} high` };
    }
    // Straight
    if (straight) {
        return { rank: PokerHandRank.STRAIGHT, values: [straightHighRank], description: `${straightHighRank} High Straight` };
    }
    // Three of a Kind
    if (counts.includes(3)) {
        const threeRank = ranksPresent.find(r => rankCounts[r] === 3);
        const kickers = sortedHand.filter(c => c.rank !== threeRank).map(c => c.rank).slice(0, 2);
        return { rank: PokerHandRank.THREE_OF_A_KIND, values: [threeRank, ...kickers], description: `Three of a Kind, ${threeRank}s` };
    }
    // Two Pair
    const pairs = ranksPresent.filter(r => rankCounts[r] === 2);
    if (pairs.length === 2) {
        const sortedPairs = pairs.sort((a, b) => getRankValue(b) - getRankValue(a));
        const kicker = sortedHand.find(c => !pairs.includes(c.rank)).rank;
        return { rank: PokerHandRank.TWO_PAIR, values: [...sortedPairs, kicker], description: `Two Pair, ${sortedPairs[0]}s and ${sortedPairs[1]}s` };
    }
    // One Pair
    if (pairs.length === 1) {
        const pairRank = pairs[0];
        const kickers = sortedHand.filter(c => c.rank !== pairRank).map(c => c.rank).slice(0, 3);
        return { rank: PokerHandRank.ONE_PAIR, values: [pairRank, ...kickers], description: `Pair of ${pairRank}s` };
    }
    // High Card
    return { rank: PokerHandRank.HIGH_CARD, values: sortedHand.map(c => c.rank), description: `${sortedHand[0].rank} High` };
};
// TODO: Add function to compare two EvaluatedHands to determine a winner.
// This will be needed for comparing player hands against each other.
export const compareEvaluatedHands = (handA, handB) => {
    if (handA.rank > handB.rank)
        return 1; // Higher rank wins (PokerHandRank enum is ordered highest to lowest)
    if (handA.rank < handB.rank)
        return -1;
    // Ranks are the same, compare by values (kickers)
    // Values are ordered from most significant to least significant
    for (let i = 0; i < handA.values.length; i++) {
        if (i >= handB.values.length)
            return 1; // handA has more kickers specified, should not happen if logic is correct
        const valueA = getRankValue(handA.values[i]);
        const valueB = getRankValue(handB.values[i]);
        if (valueA > valueB)
            return 1;
        if (valueA < valueB)
            return -1;
    }
    if (handB.values.length > handA.values.length)
        return -1; // handB has more kickers
    return 0; // Tie
};
//# sourceMappingURL=pokerEvaluator.js.map
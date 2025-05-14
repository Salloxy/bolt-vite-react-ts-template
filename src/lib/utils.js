export const SUITS = ['H', 'D', 'C', 'S'];
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
/**
 * Creates a standard 52-card deck.
 */
export const createDeck = () => {
    const deck = [];
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            deck.push({ suit, rank, id: `${rank}${suit}` });
        }
    }
    return deck;
};
/**
 * Shuffles an array of cards in place using the Fisher-Yates algorithm.
 * @param deck The array of cards to shuffle.
 */
export const shuffleDeck = (deck) => {
    const shuffledDeck = [...deck]; // Create a copy to avoid mutating the original
    for (let i = shuffledDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledDeck[i], shuffledDeck[j]] = [shuffledDeck[j], shuffledDeck[i]];
    }
    return shuffledDeck;
};
/**
 * Gets the numerical value of a card rank for sorting and comparison.
 * Ace can be high or low depending on context (e.g., A-2-3-4-5 straight).
 * For simplicity here, Ace is treated as highest.
 */
export const getRankValue = (rank) => {
    if (rank === 'A')
        return 14;
    if (rank === 'K')
        return 13;
    if (rank === 'Q')
        return 12;
    if (rank === 'J')
        return 11;
    if (rank === 'T')
        return 10;
    return parseInt(rank, 10);
};
//# sourceMappingURL=utils.js.map
// src/types/index.ts
// Enum for Poker Hand Rankings
export var PokerHandRank;
(function (PokerHandRank) {
    PokerHandRank[PokerHandRank["HIGH_CARD"] = 0] = "HIGH_CARD";
    PokerHandRank[PokerHandRank["ONE_PAIR"] = 1] = "ONE_PAIR";
    PokerHandRank[PokerHandRank["TWO_PAIR"] = 2] = "TWO_PAIR";
    PokerHandRank[PokerHandRank["THREE_OF_A_KIND"] = 3] = "THREE_OF_A_KIND";
    PokerHandRank[PokerHandRank["STRAIGHT"] = 4] = "STRAIGHT";
    PokerHandRank[PokerHandRank["FLUSH"] = 5] = "FLUSH";
    PokerHandRank[PokerHandRank["FULL_HOUSE"] = 6] = "FULL_HOUSE";
    PokerHandRank[PokerHandRank["FOUR_OF_A_KIND"] = 7] = "FOUR_OF_A_KIND";
    PokerHandRank[PokerHandRank["STRAIGHT_FLUSH"] = 8] = "STRAIGHT_FLUSH";
    // ROYAL_FLUSH is a specific type of STRAIGHT_FLUSH
})(PokerHandRank || (PokerHandRank = {}));
//# sourceMappingURL=index.js.map
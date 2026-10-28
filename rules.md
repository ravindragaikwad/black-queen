# Black Queen: Rules Spec (v0.1)

## Players and dealing
- Minimum 5 players. Maximum 17 with this removal scheme (more would need 5s removed).
- Cards per player = floor(52 / players). Everyone gets the same number.
- Leftover cards (52 mod players) are removed before dealing, lowest first.
- Removal order: 2D, 2C, 2H, 2S, then 3D, 3C, 3H, 3S, then 4D, 4C, 4H, 4S.

| Players | Each | Removed |
|---|---|---|
| 5 | 10 | 2D 2C |
| 6 | 8 | all 2s |
| 7 | 7 | 2D 2C 2H |
| 8 | 6 | all 2s |
| 9 | 5 | all 2s + 3D 3C 3H |

## Points (235 total, never changes as removed cards are worth 0)
- A, K, Q, J = 10 each
- Queen of Spades = 25
- 10 = 10
- 5 = 5
- All others = 0

## Bidding
- First bidder chosen at random, then clockwise.
- Minimum bid: 70 with 5 players, 75 with 6+. Maximum 125. Step of 5.
- Each bid must beat the last. Passing is final.
- A bid of 125 ends bidding immediately.
- If everyone passes, the last player is forced to take the minimum bid.

## After bidding
- Winner chooses **trump** suit.
- Winner names **partner cards**: count = floor((players - 3) / 2).
  (5 -> 1, 6 -> 1, 7 -> 2, 8 -> 2, 9 -> 3)
- Partner cards are specific cards (e.g. "AH"). The bidder may name a card they hold.
- Partner cards must be in play (not removed).

## Play (ASSUMED, please confirm)
- Bidder leads the first trick.
- Must follow the led suit if able.
- Highest trump wins; if no trump, highest card of the led suit wins.
- Trick winner leads next and collects the points in the trick.

## Result
- Bidding team = bidder + holders of the partner cards.
- Success if the team's captured points >= the bid.

## Scoring (PLACEHOLDER, please confirm)
- Success: each team member +bid. Failure: bidder -bid, others 0.

import { describe, expect, it } from "vitest";
import {
  calculateDebts,
  calculateOdds,
  calculatePotentialPayout,
  calculateResolutionPayouts,
} from "./odds";

describe("prediction market calculations", () => {
  it("derives probability and multipliers from the current pool", () => {
    const result = calculateOdds([
      { id: "home", bets: [{ amount: 30 }, { amount: 20 }] },
      { id: "away", bets: [{ amount: 50 }] },
    ]);

    expect(result.totalPool).toBe(100);
    expect(result.options).toEqual([
      {
        optionId: "home",
        totalBet: 50,
        probability: 0.5,
        multiplier: 2,
        betCount: 2,
      },
      {
        optionId: "away",
        totalBet: 50,
        probability: 0.5,
        multiplier: 2,
        betCount: 1,
      },
    ]);
  });

  it("includes a proposed prediction in the potential payout", () => {
    expect(calculatePotentialPayout(25, 25, 75)).toBe(50);
  });

  it("distributes the pool proportionally when a question is resolved", () => {
    const payouts = calculateResolutionPayouts("yes", [
      {
        id: "yes",
        bets: [
          { id: "a", userId: "alice", amount: 30 },
          { id: "b", userId: "bob", amount: 10 },
        ],
      },
      {
        id: "no",
        bets: [{ id: "c", userId: "carol", amount: 40 }],
      },
    ]);

    expect(payouts).toEqual([
      { betId: "a", userId: "alice", payout: 60 },
      { betId: "b", userId: "bob", payout: 20 },
      { betId: "c", userId: "carol", payout: 0 },
    ]);
  });

  it("splits each losing prediction evenly between winners", () => {
    const debts = calculateDebts("yes", [
      {
        id: "yes",
        bets: [
          { userId: "alice", amount: 10 },
          { userId: "bob", amount: 20 },
        ],
      },
      { id: "no", bets: [{ userId: "carol", amount: 30 }] },
    ]);

    expect(debts).toEqual([
      { fromUserId: "carol", toUserId: "alice", amount: 15 },
      { fromUserId: "carol", toUserId: "bob", amount: 15 },
    ]);
  });
});

export interface OptionOdds {
  optionId: string;
  totalBet: number;
  probability: number;
  multiplier: number;
  betCount: number;
}

export interface QuestionOdds {
  totalPool: number;
  options: OptionOdds[];
}

export function calculateOdds(
  options: { id: string; bets: { amount: number }[] }[]
): QuestionOdds {
  const totalPool = options.reduce(
    (sum, opt) => sum + opt.bets.reduce((s, b) => s + b.amount, 0),
    0
  );

  const optionOdds: OptionOdds[] = options.map((opt) => {
    const totalBet = opt.bets.reduce((s, b) => s + b.amount, 0);
    const probability = totalPool > 0 ? totalBet / totalPool : 1 / options.length;
    const multiplier = totalBet > 0 ? totalPool / totalBet : 0;

    return {
      optionId: opt.id,
      totalBet,
      probability,
      multiplier,
      betCount: opt.bets.length,
    };
  });

  return { totalPool, options: optionOdds };
}

export function calculatePotentialPayout(
  betAmount: number,
  currentOptionTotal: number,
  currentTotalPool: number
): number {
  const newOptionTotal = currentOptionTotal + betAmount;
  const newTotalPool = currentTotalPool + betAmount;
  return betAmount * (newTotalPool / newOptionTotal);
}

export function calculateResolutionPayouts(
  winningOptionId: string,
  options: { id: string; bets: { id: string; amount: number; userId: string }[] }[]
): { betId: string; userId: string; payout: number }[] {
  const totalPool = options.reduce(
    (sum, opt) => sum + opt.bets.reduce((s, b) => s + b.amount, 0),
    0
  );

  const winningOption = options.find((o) => o.id === winningOptionId);
  if (!winningOption) return [];

  const winnerPool = winningOption.bets.reduce((s, b) => s + b.amount, 0);
  if (winnerPool === 0) return [];

  const payouts: { betId: string; userId: string; payout: number }[] = [];

  // Winners get proportional share of total pool
  for (const bet of winningOption.bets) {
    payouts.push({
      betId: bet.id,
      userId: bet.userId,
      payout: (bet.amount / winnerPool) * totalPool,
    });
  }

  // Losers get 0
  for (const opt of options) {
    if (opt.id === winningOptionId) continue;
    for (const bet of opt.bets) {
      payouts.push({
        betId: bet.id,
        userId: bet.userId,
        payout: 0,
      });
    }
  }

  return payouts;
}

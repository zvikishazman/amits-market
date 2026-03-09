"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { formatCurrency, formatPercentage, timeAgo } from "@/lib/utils";
import { CURRENCY_SYMBOL, MIN_BET, MAX_BET } from "@/lib/constants";
import { calculatePotentialPayout } from "@/lib/odds";

interface Bet {
  id: string;
  amount: number;
  payout: number | null;
  createdAt: string;
  user: { id: string; name: string; image: string | null };
}

interface OptionDetail {
  id: string;
  text: string;
  bets: Bet[];
}

interface QuestionDetail {
  id: string;
  title: string;
  description: string | null;
  status: string;
  resolvedOptionId: string | null;
  createdAt: string;
  resolvedAt: string | null;
  closesAt: string | null;
  creator: { id: string; name: string };
  options: OptionDetail[];
  group: { id: string; name: string };
}

interface OddsData {
  totalPool: number;
  options: {
    optionId: string;
    totalBet: number;
    probability: number;
    multiplier: number;
    betCount: number;
  }[];
}

const OPTION_COLORS = [
  "from-blue-600 to-blue-500",
  "from-cyan-600 to-cyan-500",
  "from-purple-600 to-purple-500",
  "from-amber-600 to-amber-500",
  "from-pink-600 to-pink-500",
  "from-emerald-600 to-emerald-500",
  "from-red-600 to-red-500",
  "from-indigo-600 to-indigo-500",
];

const OPTION_TEXT_COLORS = [
  "text-blue-400",
  "text-cyan-400",
  "text-purple-400",
  "text-amber-400",
  "text-pink-400",
  "text-emerald-400",
  "text-red-400",
  "text-indigo-400",
];

export default function QuestionDetailPage() {
  const params = useParams();
  const groupId = params.groupId as string;
  const questionId = params.questionId as string;
  const { data: session } = useSession();

  const [question, setQuestion] = useState<QuestionDetail | null>(null);
  const [odds, setOdds] = useState<OddsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState("");
  const [placing, setPlacing] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showBets, setShowBets] = useState(false);

  const fetchQuestion = useCallback(() => {
    fetch(`/api/groups/${groupId}/questions/${questionId}`)
      .then((r) => r.json())
      .then((data) => {
        setQuestion(data.question);
        setOdds(data.odds);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [groupId, questionId]);

  useEffect(() => {
    fetchQuestion();
  }, [fetchQuestion]);

  async function placeBet() {
    if (!selectedOption || !betAmount) return;
    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount < MIN_BET || amount > MAX_BET) {
      setMessage({ type: "error", text: `Bet must be between ${CURRENCY_SYMBOL}${MIN_BET} and ${CURRENCY_SYMBOL}${MAX_BET}` });
      return;
    }

    setPlacing(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/groups/${groupId}/questions/${questionId}/bets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId: selectedOption, amount }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to place bet");

      setMessage({ type: "success", text: `Bet of ${CURRENCY_SYMBOL}${formatCurrency(amount)} placed!` });
      setBetAmount("");
      setSelectedOption(null);
      fetchQuestion();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to place bet" });
    } finally {
      setPlacing(false);
    }
  }

  async function resolveQuestion(winningOptionId: string) {
    if (!confirm("Are you sure? This cannot be undone.")) return;
    setResolving(true);

    try {
      const res = await fetch(`/api/groups/${groupId}/questions/${questionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolvedOptionId: winningOptionId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resolve");

      setMessage({ type: "success", text: "Market resolved! Payouts distributed." });
      fetchQuestion();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to resolve" });
    } finally {
      setResolving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse max-w-4xl mx-auto">
        <div className="h-8 bg-gray-800 rounded w-2/3" />
        <div className="h-4 bg-gray-800 rounded w-1/3" />
        <div className="space-y-3 mt-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-800/50 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!question || !odds) {
    return (
      <div className="glass p-8 sm:p-12 text-center">
        <h2 className="text-xl font-bold mb-2">Market not found</h2>
        <Link href={`/dashboard/groups/${groupId}`} className="btn-primary mt-4 inline-block">
          Back to Group
        </Link>
      </div>
    );
  }

  const isCreator = session?.user?.id === question.creator.id;
  const isOpen = question.status === "OPEN";
  const isResolved = question.status === "RESOLVED";
  const selectedOdds = odds.options.find((o) => o.optionId === selectedOption);
  const potentialPayout = selectedOption && betAmount && parseFloat(betAmount) > 0 && selectedOdds
    ? calculatePotentialPayout(parseFloat(betAmount), selectedOdds.totalBet, odds.totalPool)
    : 0;

  const myBets = question.options.flatMap((opt) =>
    opt.bets.filter((b) => b.user.id === session?.user?.id).map((b) => ({ ...b, optionText: opt.text, optionId: opt.id }))
  );

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 animate-fade-in">
      {/* Back link */}
      <Link href={`/dashboard/groups/${groupId}`} className="text-xs sm:text-sm text-gray-400 hover:text-white transition-colors inline-flex items-center gap-1">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to {question.group.name}
      </Link>

      {/* Header */}
      <div className="glass p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold">{question.title}</h1>
            {question.description && (
              <p className="text-gray-400 mt-1 sm:mt-2 text-sm">{question.description}</p>
            )}
            <div className="flex items-center gap-2 sm:gap-3 mt-2 sm:mt-3 text-xs sm:text-sm text-gray-500">
              <span>by {question.creator.name}</span>
              <span>&middot;</span>
              <span>{timeAgo(new Date(question.createdAt))}</span>
            </div>
          </div>
          <span className={`px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold rounded-full flex-shrink-0 ${
            isOpen
              ? "bg-green-500/10 text-green-400 border border-green-500/20"
              : "bg-gray-500/10 text-gray-400 border border-gray-500/20"
          }`}>
            {question.status}
          </span>
        </div>

        {/* Pool info */}
        <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-800 flex items-center gap-4 sm:gap-6 text-sm">
          <div>
            <span className="text-[10px] sm:text-xs text-gray-500">Total Pool</span>
            <div className="font-mono font-semibold text-base sm:text-lg text-white">
              {CURRENCY_SYMBOL}{formatCurrency(odds.totalPool)}
            </div>
          </div>
          <div>
            <span className="text-[10px] sm:text-xs text-gray-500">Bettors</span>
            <div className="font-mono font-semibold text-base sm:text-lg text-white">
              {odds.options.reduce((s, o) => s + o.betCount, 0)}
            </div>
          </div>
          <div>
            <span className="text-[10px] sm:text-xs text-gray-500">Options</span>
            <div className="font-mono font-semibold text-base sm:text-lg text-white">
              {question.options.length}
            </div>
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-3 sm:p-4 rounded-xl border text-xs sm:text-sm ${
          message.type === "success"
            ? "bg-green-500/10 border-green-500/20 text-green-400"
            : "bg-red-500/10 border-red-500/20 text-red-400"
        }`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Odds display - left side */}
        <div className="lg:col-span-2 space-y-2 sm:space-y-3">
          <h2 className="text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider">
            {isResolved ? "Results" : "Current Odds"}
          </h2>

          {question.options.map((option, i) => {
            const optOdds = odds.options.find((o) => o.optionId === option.id);
            const prob = optOdds?.probability || 0;
            const isWinner = question.resolvedOptionId === option.id;
            const isSelected = selectedOption === option.id;
            const colorGradient = OPTION_COLORS[i % OPTION_COLORS.length];
            const textColor = OPTION_TEXT_COLORS[i % OPTION_TEXT_COLORS.length];

            return (
              <button
                key={option.id}
                onClick={() => isOpen && setSelectedOption(isSelected ? null : option.id)}
                disabled={!isOpen}
                className={`w-full text-left transition-all duration-300 rounded-xl p-3 sm:p-4 ${
                  isOpen ? "hover:bg-gray-800/50 cursor-pointer" : ""
                } ${isSelected ? "ring-2 ring-blue-500/50 bg-gray-800/50" : ""} ${
                  isWinner ? "ring-2 ring-green-500/50 bg-green-500/5" : ""
                } ${!isOpen && !isWinner ? "opacity-50" : ""}`}
              >
                <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {isWinner && <span className="text-green-400 flex-shrink-0">&#10003;</span>}
                    <span className="font-medium text-sm sm:text-base truncate">{option.text}</span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 ml-2">
                    <span className={`font-mono text-xs sm:text-sm ${textColor}`}>
                      {optOdds ? `${optOdds.multiplier.toFixed(2)}x` : "-"}
                    </span>
                    <span className="font-mono font-semibold text-base sm:text-lg">
                      {formatPercentage(prob)}
                    </span>
                  </div>
                </div>

                {/* Odds bar */}
                <div className="h-6 sm:h-8 bg-gray-800 rounded-lg overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${colorGradient} rounded-lg flex items-center px-2 sm:px-3 transition-all duration-700 ease-out`}
                    style={{ width: `${Math.max(3, prob * 100)}%` }}
                  >
                    {prob > 0.15 && (
                      <span className="text-[10px] sm:text-xs font-medium text-white/90">
                        {CURRENCY_SYMBOL}{formatCurrency(optOdds?.totalBet || 0)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-1 flex items-center justify-between text-[10px] sm:text-xs text-gray-500">
                  <span>{optOdds?.betCount || 0} bets</span>
                  <span>{CURRENCY_SYMBOL}{formatCurrency(optOdds?.totalBet || 0)} staked</span>
                </div>

                {/* Resolve button for creator */}
                {isOpen && isCreator && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      resolveQuestion(option.id);
                    }}
                    disabled={resolving}
                    className="mt-2 text-[10px] sm:text-xs text-gray-500 hover:text-green-400 transition-colors"
                  >
                    Resolve as winner
                  </button>
                )}
              </button>
            );
          })}
        </div>

        {/* Betting panel - right side */}
        <div className="space-y-3 sm:space-y-4">
          {isOpen && (
            <div className="glass p-4 sm:p-5 space-y-3 sm:space-y-4 sticky top-4">
              <h3 className="font-semibold text-sm sm:text-base">Place Your Bet</h3>

              {selectedOption ? (
                <>
                  <div className="p-2.5 sm:p-3 bg-gray-800/50 rounded-lg">
                    <span className="text-[10px] sm:text-xs text-gray-500">Selected</span>
                    <div className="font-medium mt-0.5 sm:mt-1 text-sm sm:text-base">
                      {question.options.find((o) => o.id === selectedOption)?.text}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs sm:text-sm text-gray-400 mb-1 block">Amount</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">{CURRENCY_SYMBOL}</span>
                      <input
                        type="number"
                        value={betAmount}
                        onChange={(e) => setBetAmount(e.target.value)}
                        placeholder="0"
                        min={MIN_BET}
                        max={MAX_BET}
                        step="1"
                        className="input-field pl-7 font-mono"
                      />
                    </div>
                    <div className="flex gap-1.5 sm:gap-2 mt-2">
                      {[10, 25, 50, 100].map((amount) => (
                        <button
                          key={amount}
                          onClick={() => setBetAmount(amount.toString())}
                          className={`flex-1 py-1 text-[10px] sm:text-xs rounded-lg transition-colors font-mono ${
                            betAmount === amount.toString()
                              ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                              : "bg-gray-800 hover:bg-gray-700"
                          }`}
                        >
                          {amount}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Potential payout */}
                  {potentialPayout > 0 && (
                    <div className="p-2.5 sm:p-3 bg-green-500/5 border border-green-500/10 rounded-lg">
                      <div className="text-[10px] sm:text-xs text-gray-400">Potential Return</div>
                      <div className="text-lg sm:text-xl font-mono font-bold text-green-400">
                        {CURRENCY_SYMBOL}{formatCurrency(potentialPayout)}
                      </div>
                      <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">
                        Profit: {CURRENCY_SYMBOL}{formatCurrency(potentialPayout - parseFloat(betAmount || "0"))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={placeBet}
                    disabled={placing || !betAmount || parseFloat(betAmount) < MIN_BET}
                    className="btn-primary w-full text-sm"
                  >
                    {placing ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Placing...
                      </span>
                    ) : (
                      "Place Bet"
                    )}
                  </button>
                </>
              ) : (
                <p className="text-xs sm:text-sm text-gray-400">Select an option to place a bet.</p>
              )}
            </div>
          )}

          {/* My bets */}
          {myBets.length > 0 && (
            <div className="glass p-4 sm:p-5">
              <h3 className="font-semibold mb-2 sm:mb-3 text-sm sm:text-base">My Bets</h3>
              <div className="space-y-1.5 sm:space-y-2">
                {myBets.map((bet) => (
                  <div key={bet.id} className="flex items-center justify-between p-2 bg-gray-800/30 rounded-lg text-xs sm:text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{bet.optionText}</div>
                      <div className="text-[10px] sm:text-xs text-gray-500">{timeAgo(new Date(bet.createdAt))}</div>
                    </div>
                    <div className="text-right font-mono ml-2">
                      <div>{CURRENCY_SYMBOL}{formatCurrency(bet.amount)}</div>
                      {bet.payout !== null && (
                        <div className={bet.payout > 0 ? "text-green-400 text-[10px] sm:text-xs" : "text-red-400 text-[10px] sm:text-xs"}>
                          {bet.payout > 0 ? `+${CURRENCY_SYMBOL}${formatCurrency(bet.payout)}` : "Lost"}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All bets toggle */}
          <button
            onClick={() => setShowBets(!showBets)}
            className="text-xs sm:text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            {showBets ? "Hide all bets" : "Show all bets"}
          </button>

          {showBets && (
            <div className="glass p-4 sm:p-5">
              <h3 className="font-semibold mb-2 sm:mb-3 text-sm sm:text-base">All Bets</h3>
              <div className="space-y-1.5 sm:space-y-2 max-h-60 overflow-y-auto">
                {question.options.flatMap((opt) =>
                  opt.bets.map((bet) => (
                    <div key={bet.id} className="flex items-center justify-between p-2 bg-gray-800/30 rounded-lg text-xs sm:text-sm">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{bet.user.name}</div>
                        <div className="text-[10px] sm:text-xs text-gray-500">{opt.text}</div>
                      </div>
                      <div className="font-mono ml-2">{CURRENCY_SYMBOL}{formatCurrency(bet.amount)}</div>
                    </div>
                  ))
                )}
                {question.options.every((o) => o.bets.length === 0) && (
                  <p className="text-xs sm:text-sm text-gray-500">No bets yet. Be the first!</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

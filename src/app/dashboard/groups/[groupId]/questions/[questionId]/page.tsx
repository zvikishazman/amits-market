"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { formatCurrency, formatPercentage, timeAgo } from "@/lib/utils";
import { CURRENCY_SYMBOL } from "@/lib/constants";
import { calculatePotentialPayout } from "@/lib/odds";
import { useI18n } from "@/lib/i18n/context";

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
  betAmount: number | null;
  showBetChoices: boolean;
  createdAt: string;
  resolvedAt: string | null;
  closesAt: string | null;
  creator: { id: string; name: string };
  options: OptionDetail[];
  group: { id: string; name: string };
  hiddenFromIds?: string[];
}

interface GroupMember {
  id: string;
  user: { id: string; name: string; image: string | null };
  role: string;
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

interface DebtDetail {
  fromUserId: string;
  toUserId: string;
  amount: number;
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
  const { t } = useI18n();

  const [question, setQuestion] = useState<QuestionDetail | null>(null);
  const [odds, setOdds] = useState<OddsData | null>(null);
  const [debts, setDebts] = useState<DebtDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showBets, setShowBets] = useState(false);
  const [countdown, setCountdown] = useState<{ days: number; hours: number; minutes: number; seconds: number; text: string }>({ days: 0, hours: 0, minutes: 0, seconds: 0, text: "" });
  const [changingBet, setChangingBet] = useState(false);
  const [removingVote, setRemovingVote] = useState(false);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editBetAmount, setEditBetAmount] = useState("");
  const [editOptions, setEditOptions] = useState<{ id?: string; text: string }[]>([]);
  const [editClosesAt, setEditClosesAt] = useState("");
  const [editShowBetChoices, setEditShowBetChoices] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editHiddenFromUserIds, setEditHiddenFromUserIds] = useState<Set<string>>(new Set());
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);

  // Resolve modal state
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolveOptionId, setResolveOptionId] = useState<string | null>(null);

  // Settle payment state
  const [settlingTo, setSettlingTo] = useState<string | null>(null);
  const [settledPairs, setSettledPairs] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch(`/api/groups/${groupId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.group?.members) setGroupMembers(data.group.members);
      })
      .catch(() => {});
  }, [groupId]);

  const fetchQuestion = useCallback(() => {
    fetch(`/api/groups/${groupId}/questions/${questionId}`)
      .then((r) => r.json())
      .then((data) => {
        setQuestion(data.question);
        setOdds(data.odds);
        setDebts(data.debts || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [groupId, questionId]);

  useEffect(() => {
    fetchQuestion();
    const interval = setInterval(fetchQuestion, 5000);
    return () => clearInterval(interval);
  }, [fetchQuestion]);

  useEffect(() => {
    if (!question?.closesAt) return;
    const updateCountdown = () => {
      const now = new Date().getTime();
      const close = new Date(question.closesAt!).getTime();
      const diff = close - now;
      if (diff <= 0) {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0, text: t("closed") });
        return;
      }
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setCountdown({ days, hours, minutes, seconds, text: "" });
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [question?.closesAt, t]);

  const isClosed = question?.closesAt ? new Date(question.closesAt) <= new Date() : false;

  async function placeBet() {
    if (!selectedOption) return;
    setPlacing(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/questions/${questionId}/bets`, {
        method: "POST",
        headers: { "Content-Type": "application/json"},
        body: JSON.stringify({ optionId: selectedOption }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("failedToPlaceBet"));
      setMessage({ type: "success", text: `${t("bet")} ${CURRENCY_SYMBOL}${formatCurrency(question?.betAmount || 0)}!` });
      setSelectedOption(null);
      fetchQuestion();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : t("failedToPlaceBet") });
    } finally {
      setPlacing(false);
    }
  }

  async function changeBet(newOptionId: string) {
    setChangingBet(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/questions/${questionId}/bets`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId: newOptionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("failedToChangeBet"));
      setMessage({ type: "success", text: t("betChanged") });
      fetchQuestion();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : t("failedToChangeBet") });
    } finally {
      setChangingBet(false);
    }
  }

  async function removeVote() {
    if (!confirm(t("confirmRemoveVote"))) return;
    setRemovingVote(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/questions/${questionId}/bets`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("failedToRemoveVote"));
      setMessage({ type: "success", text: t("voteRemoved") });
      fetchQuestion();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : t("failedToRemoveVote") });
    } finally {
      setRemovingVote(false);
    }
  }

  async function resolveQuestion(winningOptionId: string) {
    if (!confirm(t("resolveConfirm"))) return;
    setResolving(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/questions/${questionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolvedOptionId: winningOptionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("failedToResolve"));
      setMessage({ type: "success", text: t("marketResolved") });
      setShowResolveModal(false);
      fetchQuestion();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : t("failedToResolve") });
    } finally {
      setResolving(false);
    }
  }

  async function handleSettlePayment(toUserId: string, amount: number) {
    setSettlingTo(toUserId);
    try {
      const res = await fetch(`/api/groups/${groupId}/settlements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId, amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("failed"));
      setMessage({ type: "success", text: t("paymentRecorded") });
      setSettledPairs((prev) => new Set(prev).add(toUserId));
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : t("failed") });
    } finally {
      setSettlingTo(null);
    }
  }

  function openEditModal() {
    if (!question) return;
    setEditTitle(question.title);
    setEditDescription(question.description || "");
    setEditBetAmount(String(question.betAmount || 50));
    if (question.closesAt) {
      const d = new Date(question.closesAt);
      const localStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      setEditClosesAt(localStr);
    } else {
      setEditClosesAt("");
    }
    setEditShowBetChoices(question.showBetChoices || false);
    setEditOptions(question.options.map((o) => ({ id: o.id, text: o.text })));
    setEditHiddenFromUserIds(new Set(question.hiddenFromIds || []));
    setEditError(null);
    setShowEditModal(true);
  }

  async function handleSaveEdit() {
    // Validate options
    const filteredOptions = editOptions.filter((o) => o.text.trim());
    if (filteredOptions.length < 2) {
      setEditError(t("provideQuestionAndOptions"));
      return;
    }

    setSaving(true);
    setEditError(null);
    try {
      const updates: Record<string, unknown> = {};
      if (editTitle !== question?.title) updates.title = editTitle;
      if (editDescription !== (question?.description || "")) updates.description = editDescription;
      const newAmt = parseInt(editBetAmount);
      if (!isNaN(newAmt) && newAmt !== question?.betAmount) updates.betAmount = newAmt;
      const newClose = editClosesAt ? editClosesAt : null;
      const oldClose = question?.closesAt ? (() => { const d = new Date(question.closesAt!); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; })() : null;
      if (newClose !== oldClose) updates.closesAt = editClosesAt ? new Date(editClosesAt).toISOString() : null;
      if (editShowBetChoices !== (question?.showBetChoices || false)) updates.showBetChoices = editShowBetChoices;

      // Check if hiddenFrom changed
      const oldHiddenIds = new Set(question?.hiddenFromIds || []);
      const newHiddenIds = editHiddenFromUserIds;
      if (oldHiddenIds.size !== newHiddenIds.size || Array.from(newHiddenIds).some((id) => !oldHiddenIds.has(id))) {
        updates.hiddenFromUserIds = Array.from(newHiddenIds);
      }

      // Check if options changed
      const optionsChanged = filteredOptions.length !== question?.options.length ||
        filteredOptions.some((o, i) => o.text.trim() !== question?.options[i]?.text || o.id !== question?.options[i]?.id);
      if (optionsChanged) {
        updates.options = filteredOptions.map((o) => ({ id: o.id, text: o.text.trim() }));
      }

      if (Object.keys(updates).length === 0) {
        setShowEditModal(false);
        return;
      }

      const res = await fetch(`/api/groups/${groupId}/questions/${questionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("failedToSave"));
      setShowEditModal(false);
      fetchQuestion();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : t("failedToSave"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <div className="h-8 bg-gray-800 rounded w-2/3 animate-shimmer" />
        <div className="h-4 bg-gray-800 rounded w-1/3 animate-shimmer" />
        <div className="glass p-6 mt-6 space-y-4">
          <div className="h-5 bg-gray-800 rounded w-1/2 animate-shimmer" />
          <div className="flex gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex-1 h-12 bg-gray-800/50 rounded-lg animate-shimmer" />
            ))}
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-800/30 rounded-xl animate-shimmer" />
          ))}
        </div>
      </div>
    );
  }

  if (!question || !odds) {
    return (
      <div className="glass p-8 sm:p-12 text-center">
        <h2 className="text-xl font-bold mb-2">{t("marketNotFound")}</h2>
        <Link href={`/dashboard/groups/${groupId}`} className="btn-primary mt-4 inline-block">{t("backToGroup")}</Link>
      </div>
    );
  }

  const isCreator = session?.user?.id === question.creator.id;
  const isOpen = question.status === "OPEN";
  const isResolved = question.status === "RESOLVED";
  const canBet = isOpen && !isClosed;
  const fixedAmount = question.betAmount || 50;
  const selectedOdds = odds.options.find((o) => o.optionId === selectedOption);
  const potentialPayout = selectedOption && selectedOdds
    ? calculatePotentialPayout(fixedAmount, selectedOdds.totalBet, odds.totalPool)
    : 0;

  const myBets = question.options.flatMap((opt) =>
    opt.bets.filter((b) => b.user.id === session?.user?.id).map((b) => ({ ...b, optionText: opt.text, optionId: opt.id }))
  );
  const hasAlreadyBet = myBets.length > 0;
  const myCurrentOption = hasAlreadyBet ? myBets[0].optionId : null;

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 animate-fade-in">
      {/* Back link */}
      <Link href={`/dashboard/groups/${groupId}`} className="text-xs sm:text-sm text-gray-400 hover:text-white transition-colors inline-flex items-center gap-1">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {t("backToGroup")} {question.group.name}
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
              <span>{t("by")} {question.creator.name}</span>
              <span>&middot;</span>
              <span>{timeAgo(new Date(question.createdAt), t)}</span>
              {isCreator && isOpen && (
                <>
                  <span>&middot;</span>
                  <button onClick={openEditModal} className="text-blue-400 hover:text-blue-300 transition-colors">
                    {t("editMarket")}
                  </button>
                </>
              )}
            </div>
          </div>
          <span className={`px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold rounded-full flex-shrink-0 ${
            isOpen && !isClosed
              ? "bg-green-500/10 text-green-400 border border-green-500/20"
              : isClosed && isOpen
              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
              : "bg-gray-500/10 text-gray-400 border border-gray-500/20"
          }`}>
            {isResolved ? t("resolved2") : isClosed ? t("closed2") : t("open")}
          </span>
        </div>

        {/* Pool info */}
        <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-800 flex flex-wrap items-center gap-4 sm:gap-6 text-sm">
          <div>
            <span className="text-[10px] sm:text-xs text-gray-500">{t("totalPool")}</span>
            <div className="font-mono font-semibold text-base sm:text-lg text-white">{CURRENCY_SYMBOL}{formatCurrency(odds.totalPool)}</div>
          </div>
          <div>
            <span className="text-[10px] sm:text-xs text-gray-500">{t("bettors")}</span>
            <div className="font-mono font-semibold text-base sm:text-lg text-white">{odds.options.reduce((s, o) => s + o.betCount, 0)}</div>
          </div>
          <div>
            <span className="text-[10px] sm:text-xs text-gray-500">{t("entryPrice")}</span>
            <div className="font-mono font-semibold text-base sm:text-lg text-blue-400">{CURRENCY_SYMBOL}{formatCurrency(fixedAmount)}</div>
          </div>
          {question.closesAt && (
            <div>
              <span className="text-[10px] sm:text-xs text-gray-500">{isClosed ? t("closed") : t("timeLeft")}</span>
              {isClosed ? (
                <div className="font-mono font-semibold text-base sm:text-lg text-red-400">{countdown.text}</div>
              ) : (
                <div className="flex gap-1.5 sm:gap-2 mt-1" dir="ltr">
                  {countdown.days > 0 && (
                    <div className="flex flex-col items-center">
                      <div className="bg-gradient-to-b from-amber-500/20 to-amber-600/10 border border-amber-500/20 rounded-lg px-2 py-1 min-w-[36px] sm:min-w-[42px]">
                        <span className="font-mono font-bold text-sm sm:text-lg text-amber-400 block text-center">{String(countdown.days).padStart(2, "0")}</span>
                      </div>
                      <span className="text-[8px] sm:text-[10px] text-gray-500 mt-0.5">{t("days")}</span>
                    </div>
                  )}
                  <div className="flex flex-col items-center">
                    <div className="bg-gradient-to-b from-amber-500/20 to-amber-600/10 border border-amber-500/20 rounded-lg px-2 py-1 min-w-[36px] sm:min-w-[42px]">
                      <span className="font-mono font-bold text-sm sm:text-lg text-amber-400 block text-center">{String(countdown.hours).padStart(2, "0")}</span>
                    </div>
                    <span className="text-[8px] sm:text-[10px] text-gray-500 mt-0.5">{t("hours")}</span>
                  </div>
                  <span className="text-amber-400/50 font-bold self-start mt-1.5 sm:mt-2">:</span>
                  <div className="flex flex-col items-center">
                    <div className="bg-gradient-to-b from-amber-500/20 to-amber-600/10 border border-amber-500/20 rounded-lg px-2 py-1 min-w-[36px] sm:min-w-[42px]">
                      <span className="font-mono font-bold text-sm sm:text-lg text-amber-400 block text-center">{String(countdown.minutes).padStart(2, "0")}</span>
                    </div>
                    <span className="text-[8px] sm:text-[10px] text-gray-500 mt-0.5">{t("minutes")}</span>
                  </div>
                  <span className="text-amber-400/50 font-bold self-start mt-1.5 sm:mt-2">:</span>
                  <div className="flex flex-col items-center">
                    <div className="bg-gradient-to-b from-amber-500/20 to-amber-600/10 border border-amber-500/20 rounded-lg px-2 py-1 min-w-[36px] sm:min-w-[42px]">
                      <span className="font-mono font-bold text-sm sm:text-lg text-amber-400 block text-center">{String(countdown.seconds).padStart(2, "0")}</span>
                    </div>
                    <span className="text-[8px] sm:text-[10px] text-gray-500 mt-0.5">{t("seconds")}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-3 sm:p-4 rounded-xl border text-xs sm:text-sm animate-slide-in ${
          message.type === "success" ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-red-500/10 border-red-500/20 text-red-400"
        }`}>{message.text}</div>
      )}

      {/* Resolve prompt for admin/creator when deadline passed */}
      {isCreator && isClosed && isOpen && !showResolveModal && (
        <div className="glass p-4 sm:p-5 border border-amber-500/20 bg-amber-500/5">
          <div className="flex items-center gap-2 text-amber-400 mb-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-semibold text-sm">{t("deadlinePassedResolve")}</span>
          </div>
          <button onClick={() => setShowResolveModal(true)} className="btn-primary text-sm mt-2">
            {t("resolveMarket")}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Odds display - left side */}
        <div className="lg:col-span-2 space-y-2 sm:space-y-3">
          <h2 className="text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider">
            {isResolved ? t("results") : t("currentOdds")}
          </h2>

          {question.options.map((option, i) => {
            const optOdds = odds.options.find((o) => o.optionId === option.id);
            const prob = optOdds?.probability || 0;
            const isWinner = question.resolvedOptionId === option.id;
            const isSelected = selectedOption === option.id;
            const isMyBet = myCurrentOption === option.id;
            const colorGradient = OPTION_COLORS[i % OPTION_COLORS.length];
            const textColor = OPTION_TEXT_COLORS[i % OPTION_TEXT_COLORS.length];

            return (
              <button
                key={option.id}
                onClick={() => {
                  if (canBet && !hasAlreadyBet) {
                    setSelectedOption(isSelected ? null : option.id);
                  } else if (canBet && hasAlreadyBet && !isMyBet && !changingBet) {
                    changeBet(option.id);
                  }
                }}
                disabled={(!canBet && !isCreator) || changingBet}
                className={`w-full text-left transition-all duration-300 rounded-xl p-3 sm:p-4 ${
                  canBet && (!hasAlreadyBet || !isMyBet) ? "hover:bg-gray-800/50 cursor-pointer" : ""
                } ${isSelected ? "ring-2 ring-blue-500/50 bg-gray-800/50" : ""} ${
                  isWinner ? "ring-2 ring-green-500/50 bg-green-500/5" : ""
                } ${isMyBet && isOpen ? "ring-2 ring-blue-500/30 bg-blue-500/5" : ""
                } ${!isOpen && !isWinner ? "opacity-50" : ""}`}
              >
                <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {isWinner && <span className="text-green-400 flex-shrink-0">&#10003;</span>}
                    {isMyBet && isOpen && <span className="text-blue-400 flex-shrink-0 text-xs">&#9679;</span>}
                    <span className="font-medium text-sm sm:text-base truncate">{option.text}</span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 ml-2">
                    <span className={`font-mono text-xs sm:text-sm ${textColor}`}>
                      {optOdds ? `${optOdds.multiplier.toFixed(2)}x` : "-"}
                    </span>
                    <span className="font-mono font-semibold text-base sm:text-lg">{formatPercentage(prob)}</span>
                  </div>
                </div>

                <div className="h-6 sm:h-8 bg-gray-800 rounded-lg overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${colorGradient} rounded-lg flex items-center px-2 sm:px-3 transition-all duration-700 ease-out`}
                    style={{ width: `${Math.max(3, prob * 100)}%` }}
                  >
                    {prob > 0.15 && (
                      <span className="text-[10px] sm:text-xs font-medium text-white/90">{CURRENCY_SYMBOL}{formatCurrency(optOdds?.totalBet || 0)}</span>
                    )}
                  </div>
                </div>

                <div className="mt-1 flex items-center justify-between text-[10px] sm:text-xs text-gray-500">
                  <span>{optOdds?.betCount || 0} {t("bets")}</span>
                  <span>{CURRENCY_SYMBOL}{formatCurrency(optOdds?.totalBet || 0)} {t("staked")}</span>
                </div>

                {/* Resolve button for creator (inline) - only after deadline */}
                {isOpen && isClosed && isCreator && !showResolveModal && (
                  <button
                    onClick={(e) => { e.stopPropagation(); resolveQuestion(option.id); }}
                    disabled={resolving}
                    className="mt-2 text-[10px] sm:text-xs text-gray-500 hover:text-green-400 transition-colors"
                  >
                    {t("resolveAsWinner")}
                  </button>
                )}
              </button>
            );
          })}
        </div>

        {/* Betting panel - right side */}
        <div className="space-y-3 sm:space-y-4">
          {canBet && !hasAlreadyBet && (
            <div className="glass p-4 sm:p-5 space-y-3 sm:space-y-4 sticky top-4">
              <h3 className="font-semibold text-sm sm:text-base">{t("placeYourBet")}</h3>
              <div className="p-2.5 sm:p-3 bg-blue-500/5 border border-blue-500/10 rounded-lg">
                <div className="text-[10px] sm:text-xs text-gray-400">{t("entryPrice")}</div>
                <div className="text-lg sm:text-xl font-mono font-bold text-blue-400">{CURRENCY_SYMBOL}{formatCurrency(fixedAmount)}</div>
              </div>

              {selectedOption ? (
                <>
                  <div className="p-2.5 sm:p-3 bg-gray-800/50 rounded-lg">
                    <span className="text-[10px] sm:text-xs text-gray-500">{t("yourPick")}</span>
                    <div className="font-medium mt-0.5 sm:mt-1 text-sm sm:text-base">
                      {question.options.find((o) => o.id === selectedOption)?.text}
                    </div>
                  </div>
                  {potentialPayout > 0 && (
                    <div className="p-2.5 sm:p-3 bg-green-500/5 border border-green-500/10 rounded-lg">
                      <div className="text-[10px] sm:text-xs text-gray-400">{t("potentialReturn")}</div>
                      <div className="text-lg sm:text-xl font-mono font-bold text-green-400">{CURRENCY_SYMBOL}{formatCurrency(potentialPayout)}</div>
                      <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">{t("profit")}: {CURRENCY_SYMBOL}{formatCurrency(potentialPayout - fixedAmount)}</div>
                    </div>
                  )}
                  <button onClick={placeBet} disabled={placing} className="btn-primary w-full text-sm">
                    {placing ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        {t("placing")}
                      </span>
                    ) : (
                      `${t("bet")} ${CURRENCY_SYMBOL}${formatCurrency(fixedAmount)}`
                    )}
                  </button>
                </>
              ) : (
                <p className="text-xs sm:text-sm text-gray-400">{t("selectOption")}</p>
              )}
            </div>
          )}

          {hasAlreadyBet && isOpen && (
            <div className="glass p-4 sm:p-5">
              <div className="flex items-center gap-2 text-green-400 mb-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-semibold text-sm">{t("betPlaced")}</span>
              </div>
              <p className="text-xs text-gray-400">{canBet ? t("changeBet") + " — " + t("selectOption").toLowerCase() : t("alreadyVoted")}</p>
              {canBet && changingBet && (
                <div className="mt-2 flex items-center gap-2 text-xs text-blue-400">
                  <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  {t("changingBet")}
                </div>
              )}
              {canBet && (
                <button
                  onClick={removeVote}
                  disabled={removingVote || changingBet}
                  className="mt-3 w-full text-xs px-3 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {removingVote ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-3 h-3 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                      {t("removingVote")}
                    </span>
                  ) : t("removeVote")}
                </button>
              )}
            </div>
          )}

          {isClosed && isOpen && !isCreator && (
            <div className="glass p-4 sm:p-5">
              <div className="flex items-center gap-2 text-amber-400 mb-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-semibold text-sm">{t("bettingClosed")}</span>
              </div>
              <p className="text-xs text-gray-400">{t("deadlinePassed")}</p>
            </div>
          )}

          {/* My bets */}
          {myBets.length > 0 && (
            <div className="glass p-4 sm:p-5">
              <h3 className="font-semibold mb-2 sm:mb-3 text-sm sm:text-base">{t("myBets")}</h3>
              <div className="space-y-1.5 sm:space-y-2">
                {myBets.map((bet) => (
                  <div key={bet.id} className="flex items-center justify-between p-2 bg-gray-800/30 rounded-lg text-xs sm:text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{bet.optionText}</div>
                      <div className="text-[10px] sm:text-xs text-gray-500">{timeAgo(new Date(bet.createdAt), t)}</div>
                    </div>
                    <div className="text-right font-mono ml-2">
                      <div>{CURRENCY_SYMBOL}{formatCurrency(bet.amount)}</div>
                      {bet.payout !== null && (
                        <div className={bet.payout > 0 ? "text-green-400 text-[10px] sm:text-xs" : "text-red-400 text-[10px] sm:text-xs"}>
                          {bet.payout > 0 ? `+${CURRENCY_SYMBOL}${formatCurrency(bet.payout)}` : t("lost")}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No winner refund notice */}
          {isResolved && question.resolvedOptionId && (() => {
            const winOpt = question.options.find((o) => o.id === question.resolvedOptionId);
            const noWinners = !winOpt || winOpt.bets.length === 0;
            if (!noWinners) return null;
            return (
              <div className="glass p-4 sm:p-5 border border-amber-500/20 bg-amber-500/5">
                <div className="flex items-center gap-2 text-amber-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm">{t("noWinnerRefund")}</span>
                </div>
              </div>
            );
          })()}

          {/* Who Owes Whom - shown after resolution */}
          {isResolved && debts.length > 0 && (() => {
            // Build a map of user names from bets
            const userNames: Record<string, string> = {};
            question.options.forEach((opt) => {
              opt.bets.forEach((b) => {
                userNames[b.user.id] = b.user.name || t("unknown");
              });
            });

            // Aggregate debts between same users
            const aggregated: Record<string, { from: string; to: string; amount: number }> = {};
            debts.forEach((d) => {
              const key = `${d.fromUserId}-${d.toUserId}`;
              if (aggregated[key]) {
                aggregated[key].amount += d.amount;
              } else {
                aggregated[key] = { from: d.fromUserId, to: d.toUserId, amount: d.amount };
              }
            });

            // Calculate profit per user
            const profitMap: Record<string, number> = {};
            question.options.forEach((opt) => {
              opt.bets.forEach((b) => {
                const profit = (b.payout ?? 0) - b.amount;
                profitMap[b.user.id] = (profitMap[b.user.id] || 0) + profit;
              });
            });
            const profitLeaderboard = Object.entries(profitMap)
              .map(([userId, profit]) => ({ userId, name: userNames[userId] || t("unknown"), profit }))
              .sort((a, b) => b.profit - a.profit);

            return (
              <>
                {/* Profit Leaderboard */}
                <div className="glass p-4 sm:p-5">
                  <h3 className="font-semibold mb-2 sm:mb-3 text-sm sm:text-base flex items-center gap-2">
                    <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    {t("profitLeaderboard")}
                  </h3>
                  <div className="space-y-1.5">
                    {profitLeaderboard.map((entry, i) => {
                      const isMe = entry.userId === session?.user?.id;
                      return (
                        <div key={entry.userId} className={`flex items-center justify-between p-2 rounded-lg text-xs sm:text-sm ${isMe ? "bg-blue-500/10 border border-blue-500/20" : "bg-gray-800/30"}`}>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-gray-500 w-5">#{i + 1}</span>
                            <span className={isMe ? "font-medium text-blue-400" : "text-gray-300"}>
                              {entry.name} {isMe && <span className="text-gray-500">({t("you")})</span>}
                            </span>
                          </div>
                          <span className={`font-mono font-semibold ${entry.profit > 0 ? "text-green-400" : entry.profit < 0 ? "text-red-400" : "text-gray-400"}`}>
                            {entry.profit > 0 ? "+" : ""}{CURRENCY_SYMBOL}{formatCurrency(Math.abs(entry.profit))}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Who Owes Whom */}
                <div className="glass p-4 sm:p-5">
                  <h3 className="font-semibold mb-2 sm:mb-3 text-sm sm:text-base flex items-center gap-2">
                    <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    {t("whoOwesWhom")}
                  </h3>
                  <div className="space-y-1.5">
                    {Object.values(aggregated).map((debt, i) => {
                      const fromMe = debt.from === session?.user?.id;
                      const toMe = debt.to === session?.user?.id;
                      return (
                        <div key={i} className={`flex items-center justify-between p-2 rounded-lg text-xs sm:text-sm ${fromMe ? "bg-red-500/5 border border-red-500/10" : toMe ? "bg-green-500/5 border border-green-500/10" : "bg-gray-800/30"}`}>
                          <div className="flex items-center gap-1.5">
                            <span className={fromMe ? "text-red-400 font-medium" : "text-gray-300"}>
                              {fromMe ? t("you") : userNames[debt.from]}
                            </span>
                            <span className="text-gray-500 text-[10px] sm:text-xs">{t("owes")}</span>
                            <span className={toMe ? "text-green-400 font-medium" : "text-gray-300"}>
                              {toMe ? t("you") : userNames[debt.to]}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold">{CURRENCY_SYMBOL}{formatCurrency(debt.amount)}</span>
                            {fromMe && (
                              settledPairs.has(debt.to) ? (
                                <span className="text-[10px] sm:text-xs px-2 py-1 bg-green-500/10 text-green-400 rounded-lg border border-green-500/20">
                                  {t("paidDone")}
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleSettlePayment(debt.to, Math.round(debt.amount))}
                                  disabled={settlingTo === debt.to}
                                  className="text-[10px] sm:text-xs px-2 py-1 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                                >
                                  {settlingTo === debt.to ? t("recording") : t("markAsPaid")}
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            );
          })()}

          {/* All bets toggle */}
          <button onClick={() => setShowBets(!showBets)} className="text-xs sm:text-sm text-blue-400 hover:text-blue-300 transition-colors">
            {showBets ? t("hideAllBets") : t("showAllBets")}
          </button>

          {showBets && (
            <div className="glass p-4 sm:p-5">
              <h3 className="font-semibold mb-2 sm:mb-3 text-sm sm:text-base">{t("allBets")}</h3>
              <div className="space-y-1.5 sm:space-y-2 max-h-60 overflow-y-auto">
                {question.options.flatMap((opt) =>
                  opt.bets.map((bet) => (
                    <div key={bet.id} className="flex items-center justify-between p-2 bg-gray-800/30 rounded-lg text-xs sm:text-sm">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{bet.user.name}</div>
                        <div className="text-[10px] sm:text-xs text-gray-500">
                          {question.showBetChoices || isResolved ? opt.text : t("bet")}
                        </div>
                      </div>
                      <div className="font-mono ml-2">{CURRENCY_SYMBOL}{formatCurrency(bet.amount)}</div>
                    </div>
                  ))
                )}
                {question.options.every((o) => o.bets.length === 0) && (
                  <p className="text-xs sm:text-sm text-gray-500">{t("noBetsYet")}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowEditModal(false)}>
          <div className="glass p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-lg mb-4">{t("editMarket")}</h3>
            {question.options.some((o) => o.bets.length > 0) && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-xs mb-4">
                {t("betsRefunded")}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">{t("question")}</label>
                <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="input-field" maxLength={200} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">{t("description")}</label>
                <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="input-field min-h-[60px] resize-none" maxLength={500} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">{t("answerOptions")}</label>
                <div className="space-y-2">
                  {editOptions.map((opt, i) => (
                    <div key={i} className="flex gap-2">
                      <div className="w-6 h-10 flex items-center justify-center text-xs font-mono text-gray-500" dir="ltr">{i + 1}.</div>
                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => {
                          const updated = [...editOptions];
                          updated[i] = { ...updated[i], text: e.target.value };
                          setEditOptions(updated);
                        }}
                        placeholder={`${t("option")} ${i + 1}`}
                        className="input-field flex-1"
                        maxLength={100}
                      />
                      {editOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setEditOptions(editOptions.filter((_, j) => j !== i))}
                          className="px-2 text-gray-500 hover:text-red-400 transition-colors"
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {editOptions.length < 10 && (
                  <button
                    type="button"
                    onClick={() => setEditOptions([...editOptions, { text: "" }])}
                    className="mt-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    {t("addOption")}
                  </button>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">{t("betAmount")}</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">{CURRENCY_SYMBOL}</span>
                  <input type="number" value={editBetAmount} onChange={(e) => setEditBetAmount(e.target.value)} min={1} max={10000} className="input-field pl-8 font-mono" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">{t("bettingDeadline")}</label>
                <input type="datetime-local" value={editClosesAt} onChange={(e) => setEditClosesAt(e.target.value)} className="input-field" />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditShowBetChoices(!editShowBetChoices)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${editShowBetChoices ? "bg-blue-500" : "bg-gray-700"}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${editShowBetChoices ? "translate-x-[22px]" : "translate-x-0.5"}`} />
                </button>
                <span className="text-sm text-gray-300">
                  {editShowBetChoices ? t("showBetChoicesLabel") : t("hideBetChoicesLabel")}
                </span>
              </div>

              {/* Hide from members */}
              {(() => {
                const otherMembers = groupMembers.filter((m) => m.user.id !== session?.user?.id);
                if (otherMembers.length === 0) return null;
                return (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                      <span className="text-sm font-medium text-gray-300">{t("hideFromMembers")}</span>
                      {editHiddenFromUserIds.size > 0 && (
                        <span className="text-xs text-amber-400">({editHiddenFromUserIds.size})</span>
                      )}
                    </div>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {otherMembers.map((member) => (
                        <label
                          key={member.user.id}
                          className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${
                            editHiddenFromUserIds.has(member.user.id)
                              ? "bg-amber-500/10 border border-amber-500/20"
                              : "bg-gray-800/30 border border-transparent hover:bg-gray-800/50"
                          }`}
                        >
                          <input type="checkbox" checked={editHiddenFromUserIds.has(member.user.id)} onChange={() => {
                            setEditHiddenFromUserIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(member.user.id)) next.delete(member.user.id);
                              else next.add(member.user.id);
                              return next;
                            });
                          }} className="sr-only" />
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                            editHiddenFromUserIds.has(member.user.id) ? "bg-amber-500 border-amber-500" : "border-gray-600"
                          }`}>
                            {editHiddenFromUserIds.has(member.user.id) && (
                              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-[10px] font-bold flex-shrink-0 overflow-hidden">
                            {member.user.image ? (
                              <img src={member.user.image} alt="" className="w-full h-full object-cover" />
                            ) : (
                              member.user.name?.[0] || "?"
                            )}
                          </div>
                          <span className="text-xs text-gray-300 truncate">{member.user.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
            {editError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs mt-4">
                {editError}
              </div>
            )}
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowEditModal(false)} className="btn-secondary flex-1 !py-2">{t("cancel")}</button>
              <button onClick={handleSaveEdit} disabled={saving} className="btn-primary flex-1 !py-2">
                {saving ? t("editing") : t("saveChanges")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Modal */}
      {showResolveModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowResolveModal(false)}>
          <div className="glass p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-lg mb-2">{t("resolveMarket")}</h3>
            <p className="text-sm text-gray-400 mb-4">{t("selectWinningOption")}</p>
            <div className="space-y-2">
              {question.options.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setResolveOptionId(opt.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    resolveOptionId === opt.id
                      ? "border-green-500/50 bg-green-500/10 text-green-400"
                      : "border-gray-700 hover:border-gray-600 text-gray-300"
                  }`}
                >
                  {opt.text}
                </button>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowResolveModal(false)} className="btn-secondary flex-1 !py-2">{t("cancel")}</button>
              <button
                onClick={() => resolveOptionId && resolveQuestion(resolveOptionId)}
                disabled={!resolveOptionId || resolving}
                className="btn-primary flex-1 !py-2"
              >
                {resolving ? t("editing") : t("resolveMarket")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

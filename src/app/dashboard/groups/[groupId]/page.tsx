"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { formatCurrency, timeAgo } from "@/lib/utils";
import { CURRENCY_SYMBOL } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/context";
import type { TranslationKey } from "@/lib/i18n/translations";

interface Member {
  id: string;
  role: string;
  balance: number;
  user: { id: string; name: string; image: string | null };
}

interface Option {
  id: string;
  text: string;
  _count: { bets: number };
  bets: { amount: number; userId: string; payout: number | null }[];
}

interface Question {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  closesAt: string | null;
  resolvedOptionId: string | null;
  betAmount: number | null;
  options: Option[];
  creator: { name: string };
  hiddenFromIds?: string[];
}

interface Settlement {
  id: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  createdAt: string;
  fromUser: { id: string; name: string };
  toUser: { id: string; name: string };
}

interface MemberStats {
  totalBet: number;
  totalWon: number;
  totalLost: number;
  betCount: number;
  winCount: number;
}

interface GroupDetail {
  id: string;
  name: string;
  inviteCode: string;
  startingBalance: number;
  createdAt: string;
  creator: { name: string };
  members: Member[];
  questions: Question[];
  settlements: Settlement[];
}

function QuestionCountdown({ closesAt, t }: { closesAt: string; t: (key: TranslationKey) => string }) {
  const [parts, setParts] = useState<{ d: number; h: number; m: number; s: number; closed: boolean }>({ d: 0, h: 0, m: 0, s: 0, closed: false });
  useEffect(() => {
    const update = () => {
      const diff = new Date(closesAt).getTime() - Date.now();
      if (diff <= 0) {
        setParts({ d: 0, h: 0, m: 0, s: 0, closed: true });
        return;
      }
      setParts({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
        closed: false,
      });
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [closesAt, t]);

  if (parts.closed) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
        <span className="font-mono text-[10px] sm:text-xs text-red-400 font-semibold">{t("closed")}</span>
      </div>
    );
  }

  const isUrgent = parts.d === 0 && parts.h === 0 && parts.m < 30;
  const segments: { val: string; label: string }[] = [];
  if (parts.d > 0) segments.push({ val: String(parts.d).padStart(2, "0"), label: t("daysShort") });
  segments.push({ val: String(parts.h).padStart(2, "0"), label: t("hoursShort") });
  segments.push({ val: String(parts.m).padStart(2, "0"), label: t("minutesShort") });
  if (parts.d === 0) segments.push({ val: String(parts.s).padStart(2, "0"), label: t("secondsShort") });

  return (
    <div className="flex items-center gap-1" dir="ltr">
      {segments.map((seg, i) => (
        <div key={i} className="flex items-center">
          {i > 0 && (
            <span className={`font-bold text-[10px] mx-0.5 ${isUrgent ? "text-amber-500/40" : "text-cyan-500/40"}`}>:</span>
          )}
          <div className="flex flex-col items-center">
            <div className={`rounded px-1.5 py-0.5 min-w-[24px] sm:min-w-[28px] text-center ${
              isUrgent
                ? "bg-amber-500/10 border border-amber-500/20"
                : "bg-cyan-500/10 border border-cyan-500/20"
            }`}>
              <span className={`font-mono font-bold text-[10px] sm:text-xs leading-none ${
                isUrgent ? "text-amber-400" : "text-cyan-400"
              }`}>{seg.val}</span>
            </div>
            <span className={`text-[8px] mt-0.5 ${isUrgent ? "text-amber-500/60" : "text-cyan-500/60"}`}>{seg.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.groupId as string;
  const { data: session } = useSession();
  const { t } = useI18n();
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [memberStats, setMemberStats] = useState<Record<string, MemberStats>>({});
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"openQuestions" | "closedQuestions" | "members" | "settlements">("openQuestions");

  const [settleModal, setSettleModal] = useState<{ userId: string; userName: string } | null>(null);
  const [settleAmount, setSettleAmount] = useState("");
  const [settling, setSettling] = useState(false);
  const [settleMsg, setSettleMsg] = useState("");
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchGroup = useCallback(() => {
    fetch(`/api/groups/${groupId}`)
      .then((r) => r.json())
      .then((data) => {
        setGroup(data.group);
        setMemberStats(data.memberStats || {});
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [groupId]);

  useEffect(() => {
    fetchGroup();
    const interval = setInterval(fetchGroup, 5000);
    return () => clearInterval(interval);
  }, [fetchGroup]);

  function copyInviteCode() {
    if (!group) return;
    const link = `${window.location.origin}/join/${group.inviteCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSettle() {
    if (!settleModal || !settleAmount) return;
    const amount = parseFloat(settleAmount);
    if (isNaN(amount) || amount <= 0) return;

    setSettling(true);
    setSettleMsg("");
    try {
      const res = await fetch(`/api/groups/${groupId}/settlements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId: settleModal.userId, amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("failedToRecord"));
      setSettleMsg(t("paymentRecorded"));
      setSettleAmount("");
      fetchGroup();
      setTimeout(() => {
        setSettleModal(null);
        setSettleMsg("");
      }, 1500);
    } catch (err) {
      setSettleMsg(err instanceof Error ? err.message : t("failed"));
    } finally {
      setSettling(false);
    }
  }

  function calculateDebts() {
    if (!group) return [];
    const startBal = group.startingBalance || 1000;
    const netPL: Record<string, number> = {};
    for (const m of group.members) {
      netPL[m.user.id] = m.balance - startBal;
    }
    for (const s of group.settlements) {
      netPL[s.fromUserId] = (netPL[s.fromUserId] || 0) + s.amount;
      netPL[s.toUserId] = (netPL[s.toUserId] || 0) - s.amount;
    }
    const debtors: { id: string; amount: number }[] = [];
    const creditors: { id: string; amount: number }[] = [];
    for (const [userId, pl] of Object.entries(netPL)) {
      if (pl < -0.5) debtors.push({ id: userId, amount: -pl });
      else if (pl > 0.5) creditors.push({ id: userId, amount: pl });
    }
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);
    const debts: { from: string; to: string; amount: number }[] = [];
    let di = 0, ci = 0;
    while (di < debtors.length && ci < creditors.length) {
      const payment = Math.min(debtors[di].amount, creditors[ci].amount);
      if (payment > 0.5) {
        debts.push({ from: debtors[di].id, to: creditors[ci].id, amount: Math.round(payment) });
      }
      debtors[di].amount -= payment;
      creditors[ci].amount -= payment;
      if (debtors[di].amount < 0.5) di++;
      if (creditors[ci].amount < 0.5) ci++;
    }
    return debts;
  }

  async function handleRemoveMember(userId: string) {
    if (!confirm(t("confirmRemoveMember"))) return;
    setRemovingMember(userId);
    try {
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || t("failedToRemoveMember"));
      } else {
        fetchGroup();
      }
    } catch {
      alert(t("failedToRemoveMember"));
    } finally {
      setRemovingMember(null);
    }
  }

  async function handleDeleteGroup() {
    if (!confirm(t("confirmDeleteGroup"))) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/groups/${groupId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || t("failedToDeleteGroup"));
      } else {
        router.push("/dashboard");
      }
    } catch {
      alert(t("failedToDeleteGroup"));
    } finally {
      setDeleting(false);
    }
  }

  function getMemberName(userId: string) {
    return group?.members.find((m) => m.user.id === userId)?.user.name || t("unknown");
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-800 rounded w-1/3 animate-shimmer" />
        <div className="h-4 bg-gray-800 rounded w-1/5 animate-shimmer" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mt-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass p-6"><div className="h-12 bg-gray-800 rounded animate-shimmer" /></div>
          ))}
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="glass p-8 sm:p-12 text-center">
        <h2 className="text-xl font-bold mb-2">{t("groupNotFound")}</h2>
        <p className="text-gray-400">{t("groupNotFoundDesc")}</p>
        <Link href="/dashboard" className="btn-primary mt-4 inline-block">{t("backToDashboard")}</Link>
      </div>
    );
  }

  const openQuestions = group.questions.filter((q) => q.status === "OPEN" && (!q.closesAt || new Date(q.closesAt).getTime() > now));
  const pendingQuestions = group.questions.filter((q) => q.status === "OPEN" && q.closesAt && new Date(q.closesAt).getTime() <= now);
  const resolvedQuestions = group.questions.filter((q) => q.status === "RESOLVED");
  const debts = calculateDebts();
  const isAdmin = group.members.some((m) => m.user.id === session?.user?.id && m.role === "ADMIN");

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">{group.name}</h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">
            {t("createdBy")} {group.creator.name} &middot; {group.members.length} {t("members")} &middot; {CURRENCY_SYMBOL}{formatCurrency(group.startingBalance || 1000)} {t("startingBalance")}
          </p>
        </div>
        <div className="flex gap-2 sm:gap-3">
          {isAdmin && (
            <button onClick={copyInviteCode} className="btn-secondary text-xs sm:text-sm !py-2 !px-3">
              {copied ? t("copied") : t("copyInviteLink")}
            </button>
          )}
          <Link href={`/dashboard/groups/${groupId}/questions/new`} className="btn-primary text-xs sm:text-sm !py-2 !px-3">
            {t("newMarket")}
          </Link>
          {isAdmin && (
            <button onClick={handleDeleteGroup} disabled={deleting} className="btn-danger text-xs sm:text-sm !py-2 !px-3">
              {deleting ? t("loading") : t("deleteGroup")}
            </button>
          )}
        </div>
      </div>

      {/* Invite code banner - admin only */}
      {isAdmin && (
        <div className="glass p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
          <div>
            <span className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider">{t("inviteCode")}</span>
            <div className="font-mono text-base sm:text-lg text-blue-400 mt-0.5 sm:mt-1">{group.inviteCode}</div>
          </div>
          <button onClick={copyInviteCode} className="text-xs sm:text-sm text-blue-400 hover:text-blue-300 transition-colors">
            {copied ? t("linkCopied") : t("copyInviteLink2")}
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900/60 backdrop-blur-sm p-1 rounded-xl border border-gray-800/50 overflow-x-auto max-w-full scrollbar-hide">
        {(["openQuestions", "closedQuestions", "members", "settlements"] as const).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap ${
              tab === tabKey
                ? "bg-gradient-to-r from-blue-600/20 to-cyan-600/20 text-white border border-blue-500/20 shadow-sm shadow-blue-500/10"
                : "text-gray-400 hover:text-white hover:bg-gray-800/50"
            }`}
          >
            {tabKey === "openQuestions" ? `${t("openQuestions")} (${openQuestions.length})` :
             tabKey === "closedQuestions" ? `${t("closedQuestions")} (${resolvedQuestions.length + pendingQuestions.length})` :
             tabKey === "members" ? `${t("members")} (${group.members.length})` :
             t("settleUp")}
          </button>
        ))}
      </div>

      {/* Open Questions tab */}
      {tab === "openQuestions" && (
        <div className="space-y-3 sm:space-y-4 animate-fade-in">
          {openQuestions.length === 0 ? (
            <div className="glass p-8 sm:p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">{t("noOpenQuestions")}</h3>
              <p className="text-gray-400 mb-6 text-sm">{t("noOpenQuestionsDesc")}</p>
              <Link href={`/dashboard/groups/${groupId}/questions/new`} className="btn-primary">{t("createMarket")}</Link>
            </div>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {openQuestions.map((q) => {
                const totalBets = q.options.reduce((s, o) => s + o.bets.reduce((a, b) => a + b.amount, 0), 0);
                const totalBettors = q.options.reduce((s, o) => s + o._count.bets, 0);
                const myBet = q.options.find((o) => o.bets.some((b) => b.userId === session?.user?.id));
                const isClosed = q.closesAt ? new Date(q.closesAt).getTime() <= now : false;

                return (
                  <Link key={q.id} href={`/dashboard/groups/${groupId}/questions/${q.id}`} className="glass-hover p-4 sm:p-5 block group/card relative overflow-hidden">
                    {/* Subtle gradient accent on left edge */}
                    <div className={`absolute inset-y-0 left-0 w-0.5 ${isClosed ? "bg-gradient-to-b from-amber-500 to-red-500" : "bg-gradient-to-b from-blue-500 to-cyan-500"}`} />

                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-white text-sm sm:text-base truncate group-hover/card:text-blue-300 transition-colors">{q.title}</h4>
                        <div className="flex items-center gap-2 mt-1.5 text-[10px] sm:text-xs text-gray-500">
                          <span>{t("by")} {q.creator.name}</span>
                          <span className="text-gray-700">&middot;</span>
                          <span>{timeAgo(new Date(q.createdAt), t)}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        {isClosed ? (
                          <span className="px-2 py-1 text-[10px] sm:text-xs rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                            {t("closed2")}
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-[10px] sm:text-xs rounded-full bg-green-500/10 text-green-400 border border-green-500/20 font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                            {t("open")}
                          </span>
                        )}
                        {myBet && (
                          <span className="px-2 py-0.5 text-[10px] rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            {t("betPlaced")}
                          </span>
                        )}
                        {q.hiddenFromIds && q.hiddenFromIds.length > 0 && (
                          <span className="px-2 py-0.5 text-[10px] rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            </svg>
                            {t("hidden")}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Timer row */}
                    {q.closesAt && (
                      <div className="mt-2.5 flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <QuestionCountdown closesAt={q.closesAt} t={t} />
                      </div>
                    )}

                    {/* Stats row */}
                    <div className="mt-3 flex items-center gap-3 sm:gap-4">
                      <div className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <span className="font-mono text-[10px] sm:text-xs text-gray-300">{CURRENCY_SYMBOL}{formatCurrency(totalBets)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="font-mono text-[10px] sm:text-xs text-gray-300">{totalBettors}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] sm:text-xs text-gray-500">{t("entryPrice")}</span>
                        <span className="font-mono text-[10px] sm:text-xs text-blue-400 font-medium">{CURRENCY_SYMBOL}{formatCurrency(q.betAmount || 50)}</span>
                      </div>
                    </div>

                    {/* Options preview bars */}
                    <div className="mt-3 flex gap-1.5 sm:gap-2">
                      {q.options.slice(0, 4).map((opt, i) => {
                        const optTotal = opt.bets.reduce((a, b) => a + b.amount, 0);
                        const pct = totalBets > 0 ? (optTotal / totalBets) * 100 : 100 / q.options.length;
                        const barColors = [
                          "from-blue-600 to-blue-400",
                          "from-cyan-600 to-cyan-400",
                          "from-purple-600 to-purple-400",
                          "from-amber-600 to-amber-400",
                        ];
                        return (
                          <div key={opt.id} className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] sm:text-xs text-gray-400 truncate">{opt.text}</span>
                              {totalBets > 0 && <span className="text-[10px] font-mono text-gray-500 ml-1">{Math.round(pct)}%</span>}
                            </div>
                            <div className="h-1.5 sm:h-2 bg-gray-800/80 rounded-full overflow-hidden">
                              <div className={`h-full bg-gradient-to-r ${barColors[i % barColors.length]} rounded-full transition-all duration-700`} style={{ width: `${Math.max(4, pct)}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Closed Questions tab */}
      {tab === "closedQuestions" && (
        <div className="space-y-3 sm:space-y-4 animate-fade-in">
          {/* Pending resolution questions */}
          {pendingQuestions.length > 0 && (
            <div className="space-y-2 sm:space-y-3">
              <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                {t("pendingResolution")} ({pendingQuestions.length})
              </h3>
              {pendingQuestions.map((q) => {
                const totalBets = q.options.reduce((s, o) => s + o.bets.reduce((a, b) => a + b.amount, 0), 0);
                const totalBettors = q.options.reduce((s, o) => s + o._count.bets, 0);
                return (
                  <Link key={q.id} href={`/dashboard/groups/${groupId}/questions/${q.id}`} className="glass-hover p-4 sm:p-5 block relative overflow-hidden">
                    <div className="absolute inset-y-0 left-0 w-0.5 bg-gradient-to-b from-amber-500 to-red-500" />
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-white text-sm sm:text-base truncate">{q.title}</h4>
                        <div className="flex items-center gap-2 mt-1.5 text-[10px] sm:text-xs text-gray-500">
                          <span>{t("by")} {q.creator.name}</span>
                          <span className="text-gray-700">&middot;</span>
                          <span>{timeAgo(new Date(q.createdAt), t)}</span>
                        </div>
                      </div>
                      <span className="px-2 py-1 text-[10px] sm:text-xs rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium flex-shrink-0">
                        {t("pendingResolution")}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-3 sm:gap-4">
                      <span className="font-mono text-[10px] sm:text-xs text-gray-300">{CURRENCY_SYMBOL}{formatCurrency(totalBets)}</span>
                      <span className="font-mono text-[10px] sm:text-xs text-gray-300">{totalBettors} {t("bettors")}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {resolvedQuestions.length === 0 && pendingQuestions.length === 0 ? (
            <div className="glass p-8 sm:p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-500/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">{t("noClosedQuestions")}</h3>
              <p className="text-gray-400 text-sm">{t("noClosedQuestionsDesc")}</p>
            </div>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {resolvedQuestions.map((q) => {
                const winningOption = q.options.find((o) => o.id === q.resolvedOptionId);
                const myBet = q.options.flatMap((o) => o.bets.filter((b) => b.userId === session?.user?.id).map((b) => ({ ...b, optionId: o.id, optionText: o.text }))).at(0);
                const didVote = !!myBet;
                const won = didVote && myBet.optionId === q.resolvedOptionId;
                const myPayout = myBet?.payout ?? 0;
                const myAmount = myBet?.amount ?? 0;
                const myProfit = myPayout - myAmount;
                const noWinners = winningOption && winningOption.bets.length === 0;

                return (
                  <Link key={q.id} href={`/dashboard/groups/${groupId}/questions/${q.id}`} className="glass-hover p-4 sm:p-5 block">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm sm:text-base">{q.title}</h4>
                        <p className="text-xs sm:text-sm text-gray-400 mt-1">
                          {t("by")} {q.creator.name} &middot; {timeAgo(new Date(q.createdAt), t)}
                        </p>
                      </div>
                      {/* User status badge */}
                      {!didVote ? (
                        <span className="px-2 py-1 text-[10px] sm:text-xs rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20 flex-shrink-0">
                          {t("didntVote")}
                        </span>
                      ) : noWinners ? (
                        <span className="px-2 py-1 text-[10px] sm:text-xs rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex-shrink-0">
                          {t("refunded")}
                        </span>
                      ) : won ? (
                        <span className="px-2 py-1 text-[10px] sm:text-xs rounded-full bg-green-500/10 text-green-400 border border-green-500/20 flex-shrink-0">
                          +{CURRENCY_SYMBOL}{formatCurrency(myProfit)}
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-[10px] sm:text-xs rounded-full bg-red-500/10 text-red-400 border border-red-500/20 flex-shrink-0">
                          -{CURRENCY_SYMBOL}{formatCurrency(myAmount)}
                        </span>
                      )}
                    </div>

                    {/* Winning answer */}
                    {winningOption && (
                      <div className="mt-2 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-xs sm:text-sm text-green-400 font-medium truncate">{winningOption.text}</span>
                      </div>
                    )}

                    {/* My vote info */}
                    {didVote && !won && !noWinners && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span className="text-xs sm:text-sm text-gray-400">{t("yourVote")}: <span className="text-red-400">{myBet.optionText}</span></span>
                      </div>
                    )}

                    {/* Summary bar */}
                    <div className="mt-2 flex gap-1.5 sm:gap-2">
                      {q.options.map((opt) => {
                        const totalBets = q.options.reduce((s, o) => s + o.bets.reduce((a, b) => a + b.amount, 0), 0);
                        const optTotal = opt.bets.reduce((a, b) => a + b.amount, 0);
                        const pct = totalBets > 0 ? (optTotal / totalBets) * 100 : 100 / q.options.length;
                        const isWinner = opt.id === q.resolvedOptionId;
                        return (
                          <div key={opt.id} className="flex-1 min-w-0">
                            <div className={`text-[10px] sm:text-xs truncate ${isWinner ? "text-green-400 font-medium" : "text-gray-500"}`}>{opt.text}</div>
                            <div className="h-1 sm:h-1.5 bg-gray-800 rounded-full mt-1">
                              <div
                                className={`h-full rounded-full transition-all duration-700 ${isWinner ? "bg-gradient-to-r from-green-600 to-green-400" : "bg-gray-700"}`}
                                style={{ width: `${Math.max(5, pct)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Members tab */}
      {tab === "members" && (() => {
        const currentUserIsAdmin = group.members.some(
          (m) => m.user.id === session?.user?.id && m.role === "ADMIN"
        );
        return (
        <div className="glass overflow-hidden animate-fade-in">
          <div className="divide-y divide-gray-800">
            {group.members
              .sort((a, b) => b.balance - a.balance)
              .map((member, i) => {
                const stats = memberStats[member.user.id];
                const pnl = member.balance - (group.startingBalance || 1000);
                const isMe = member.user.id === session?.user?.id;
                const canRemove = currentUserIsAdmin && !isMe && member.role !== "ADMIN";
                return (
                  <div
                    key={member.id}
                    className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 hover:bg-gray-800/30 transition-colors ${!isMe ? "cursor-pointer" : ""}`}
                    onClick={() => { if (!isMe) setSettleModal({ userId: member.user.id, userName: member.user.name || "Unknown" }); }}
                  >
                    <span className="text-xs sm:text-sm font-mono text-gray-500 w-5 sm:w-6">#{i + 1}</span>
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-xs sm:text-sm font-bold flex-shrink-0 overflow-hidden">
                      {member.user.image ? (
                        <Image src={member.user.image} alt="" width={36} height={36} className="w-full h-full object-cover" />
                      ) : (
                        member.user.name?.[0] || "?"
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm sm:text-base truncate">
                        {member.user.name} {isMe && <span className="text-gray-500 text-xs">({t("you")})</span>}
                      </div>
                      <div className="text-[10px] sm:text-xs text-gray-500 flex items-center gap-1 sm:gap-2 flex-wrap">
                        <span>{member.role === "ADMIN" ? t("admin") : t("member")}</span>
                        {stats && (
                          <>
                            <span className="hidden sm:inline">&middot;</span>
                            <span>{stats.betCount} {t("bets")}</span>
                            <span className="text-green-400">{stats.winCount} {t("wins")}</span>
                            <span className="text-red-400">{stats.betCount - stats.winCount - (stats.betCount > 0 && stats.totalWon === 0 && stats.totalLost === 0 ? stats.betCount : 0)} {t("losses")}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-mono font-semibold text-sm sm:text-base ${member.balance >= (group.startingBalance || 1000) ? "text-green-400" : "text-red-400"}`}>
                        {CURRENCY_SYMBOL}{formatCurrency(member.balance)}
                      </div>
                      <div className={`font-mono text-[10px] sm:text-xs ${pnl >= 0 ? "text-green-400/70" : "text-red-400/70"}`}>
                        {pnl >= 0 ? "+" : ""}{CURRENCY_SYMBOL}{formatCurrency(pnl)}
                      </div>
                    </div>
                    {canRemove && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemoveMember(member.user.id); }}
                        disabled={removingMember === member.user.id}
                        className="flex items-center gap-1 px-1.5 sm:px-2.5 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-colors flex-shrink-0"
                        title={t("removeMember")}
                      >
                        {removingMember === member.user.id ? (
                          <span className="w-3.5 h-3.5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                        <span className="hidden sm:inline">{t("removeMember")}</span>
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
        );
      })()}

      {/* Settlements tab */}
      {tab === "settlements" && (
        <div className="space-y-4 animate-fade-in">
          {/* Per-question debts from resolved questions */}
          {(() => {
            const questionsWithDebts = resolvedQuestions.filter((q) => {
              if (!q.resolvedOptionId) return false;
              const winOpt = q.options.find((o) => o.id === q.resolvedOptionId);
              return winOpt && winOpt.bets.length > 0 && q.options.some((o) => o.id !== q.resolvedOptionId && o.bets.length > 0);
            });

            if (questionsWithDebts.length === 0) return null;

            return questionsWithDebts.map((q) => {
              const winOpt = q.options.find((o) => o.id === q.resolvedOptionId)!;
              const winnerIds = winOpt.bets.map((b) => b.userId);
              // Calculate per-question debts: each loser owes each winner (loserAmount / numWinners)
              const qDebts: { from: string; to: string; amount: number }[] = [];
              for (const opt of q.options) {
                if (opt.id === q.resolvedOptionId) continue;
                for (const loserBet of opt.bets) {
                  const perWinner = loserBet.amount / winnerIds.length;
                  for (const winnerId of winnerIds) {
                    const existing = qDebts.find((d) => d.from === loserBet.userId && d.to === winnerId);
                    if (existing) {
                      existing.amount += perWinner;
                    } else {
                      qDebts.push({ from: loserBet.userId, to: winnerId, amount: perWinner });
                    }
                  }
                }
              }

              if (qDebts.length === 0) return null;

              return (
                <div key={q.id} className="glass p-4 sm:p-6">
                  <Link href={`/dashboard/groups/${groupId}/questions/${q.id}`} className="font-semibold text-sm sm:text-base hover:text-blue-400 transition-colors">
                    {q.title}
                  </Link>
                  <div className="flex items-center gap-1.5 mt-1 mb-3">
                    <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-xs text-green-400">{winOpt.text}</span>
                  </div>
                  <div className="space-y-1.5">
                    {qDebts.map((debt, i) => {
                      const fromMe = debt.from === session?.user?.id;
                      const toMe = debt.to === session?.user?.id;
                      return (
                        <div key={i} className={`flex items-center justify-between p-2.5 rounded-lg text-xs sm:text-sm ${fromMe ? "bg-red-500/5 border border-red-500/10" : toMe ? "bg-green-500/5 border border-green-500/10" : "bg-gray-800/30"}`}>
                          <div className="flex items-center gap-1.5">
                            <span className={fromMe ? "text-red-400 font-medium" : "text-gray-300"}>
                              {fromMe ? t("you") : getMemberName(debt.from)}
                            </span>
                            <span className="text-gray-500 text-[10px] sm:text-xs">{t("owes")}</span>
                            <span className={toMe ? "text-green-400 font-medium" : "text-gray-300"}>
                              {toMe ? t("you") : getMemberName(debt.to)}
                            </span>
                          </div>
                          <span className="font-mono font-semibold">{CURRENCY_SYMBOL}{formatCurrency(Math.round(debt.amount))}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()}

          {/* Overall outstanding debts */}
          <div className="glass p-4 sm:p-6">
            <h3 className="font-semibold mb-3 text-sm sm:text-base">{t("totalOutstanding")}</h3>
            {debts.length === 0 ? (
              <p className="text-sm text-gray-400">{t("everyoneSettled")}</p>
            ) : (
              <div className="space-y-2">
                {debts.map((debt, i) => {
                  const fromMe = debt.from === session?.user?.id;
                  const toMe = debt.to === session?.user?.id;
                  return (
                    <div key={i} className={`flex items-center justify-between p-3 rounded-lg ${fromMe ? "bg-red-500/5 border border-red-500/10" : toMe ? "bg-green-500/5 border border-green-500/10" : "bg-gray-800/30"}`}>
                      <div className="flex items-center gap-2 text-sm">
                        <span className={fromMe ? "text-red-400 font-medium" : "text-gray-300"}>
                          {fromMe ? t("you") : getMemberName(debt.from)}
                        </span>
                        <span className="text-gray-500 text-xs">{t("owes")}</span>
                        <span className={toMe ? "text-green-400 font-medium" : "text-gray-300"}>
                          {toMe ? t("you") : getMemberName(debt.to)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-sm">{CURRENCY_SYMBOL}{formatCurrency(debt.amount)}</span>
                        {fromMe && (
                          <button onClick={() => setSettleModal({ userId: debt.to, userName: getMemberName(debt.to) })} className="text-xs px-2 py-1 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-colors">
                            {t("pay")}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="glass p-4 sm:p-6">
            <h3 className="font-semibold mb-3 text-sm sm:text-base">{t("paymentHistory")}</h3>
            {group.settlements.length === 0 ? (
              <p className="text-sm text-gray-400">{t("noPayments")}</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {group.settlements.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-2 bg-gray-800/30 rounded-lg text-xs sm:text-sm">
                    <div>
                      <span className="text-gray-300">{s.fromUser.name}</span>
                      <span className="text-gray-500 mx-1">{t("paid")}</span>
                      <span className="text-gray-300">{s.toUser.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                      <span className="font-mono">{CURRENCY_SYMBOL}{formatCurrency(s.amount)}</span>
                      <span className="text-[10px]">{timeAgo(new Date(s.createdAt), t)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Settlement Modal */}
      {settleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSettleModal(null)}>
          <div className="glass p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-lg mb-4">{t("recordPayment")}</h3>
            <p className="text-sm text-gray-400 mb-4">
              {t("howMuchPaid")} <span className="text-white font-medium">{settleModal.userName}</span>?
            </p>
            <div className="relative mb-4">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">{CURRENCY_SYMBOL}</span>
              <input type="number" value={settleAmount} onChange={(e) => setSettleAmount(e.target.value)} placeholder="0" min={1} className="input-field pl-8 font-mono" autoFocus />
            </div>
            {settleMsg && (
              <p className={`text-sm mb-3 ${settleMsg.includes("recorded") || settleMsg.includes("נרשם") ? "text-green-400" : "text-red-400"}`}>{settleMsg}</p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setSettleModal(null)} className="btn-secondary flex-1 !py-2">{t("cancel")}</button>
              <button onClick={handleSettle} disabled={settling || !settleAmount || parseFloat(settleAmount) <= 0} className="btn-primary flex-1 !py-2">
                {settling ? t("recording") : t("recordPayment")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { formatCurrency, timeAgo } from "@/lib/utils";
import { CURRENCY_SYMBOL } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/context";

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
  bets: { amount: number }[];
}

interface Question {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  options: Option[];
  creator: { name: string };
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

export default function GroupDetailPage() {
  const params = useParams();
  const groupId = params.groupId as string;
  const { data: session } = useSession();
  const { t } = useI18n();
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [memberStats, setMemberStats] = useState<Record<string, MemberStats>>({});
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"markets" | "members" | "settlements">("markets");

  const [settleModal, setSettleModal] = useState<{ userId: string; userName: string } | null>(null);
  const [settleAmount, setSettleAmount] = useState("");
  const [settling, setSettling] = useState(false);
  const [settleMsg, setSettleMsg] = useState("");
  const [removingMember, setRemovingMember] = useState<string | null>(null);

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

  function getMemberName(userId: string) {
    return group?.members.find((m) => m.user.id === userId)?.user.name || t("unknown");
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-gray-800 rounded w-1/3" />
        <div className="h-4 bg-gray-800 rounded w-1/5" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mt-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass p-6"><div className="h-12 bg-gray-800 rounded" /></div>
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

  const openQuestions = group.questions.filter((q) => q.status === "OPEN");
  const resolvedQuestions = group.questions.filter((q) => q.status === "RESOLVED");
  const debts = calculateDebts();

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
          <button onClick={copyInviteCode} className="btn-secondary text-xs sm:text-sm !py-2 !px-3">
            {copied ? t("copied") : t("copyInviteLink")}
          </button>
          <Link href={`/dashboard/groups/${groupId}/questions/new`} className="btn-primary text-xs sm:text-sm !py-2 !px-3">
            {t("newMarket")}
          </Link>
        </div>
      </div>

      {/* Invite code banner */}
      <div className="glass p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
        <div>
          <span className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider">{t("inviteCode")}</span>
          <div className="font-mono text-base sm:text-lg text-blue-400 mt-0.5 sm:mt-1">{group.inviteCode}</div>
        </div>
        <button onClick={copyInviteCode} className="text-xs sm:text-sm text-blue-400 hover:text-blue-300 transition-colors">
          {copied ? t("linkCopied") : t("copyInviteLink2")}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900/50 p-1 rounded-xl w-fit">
        {(["markets", "members", "settlements"] as const).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              tab === tabKey ? "bg-gray-800 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            {tabKey === "markets" ? `${t("markets")} (${group.questions.length})` :
             tabKey === "members" ? `${t("members")} (${group.members.length})` :
             t("settleUp")}
          </button>
        ))}
      </div>

      {/* Markets tab */}
      {tab === "markets" && (
        <div className="space-y-3 sm:space-y-4">
          {group.questions.length === 0 ? (
            <div className="glass p-8 sm:p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">{t("noMarketsYet")}</h3>
              <p className="text-gray-400 mb-6 text-sm">{t("noMarketsDesc")}</p>
              <Link href={`/dashboard/groups/${groupId}/questions/new`} className="btn-primary">{t("createMarket")}</Link>
            </div>
          ) : (
            <>
              {openQuestions.length > 0 && (
                <div>
                  <h3 className="text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider mb-2 sm:mb-3">{t("openMarkets")}</h3>
                  <div className="space-y-2 sm:space-y-3">
                    {openQuestions.map((q) => (
                      <Link key={q.id} href={`/dashboard/groups/${groupId}/questions/${q.id}`} className="glass-hover p-4 sm:p-5 block">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-white text-sm sm:text-base truncate">{q.title}</h4>
                            <p className="text-xs sm:text-sm text-gray-400 mt-1">
                              {q.options.length} {t("options")} &middot; {t("by")} {q.creator.name} &middot; {timeAgo(new Date(q.createdAt), t)}
                            </p>
                          </div>
                          <span className="px-2 py-1 text-[10px] sm:text-xs rounded-full bg-green-500/10 text-green-400 border border-green-500/20 flex-shrink-0">
                            {t("open")}
                          </span>
                        </div>
                        <div className="mt-2 sm:mt-3 flex gap-1.5 sm:gap-2">
                          {(() => {
                            const totalBets = q.options.reduce((s, o) => s + o.bets.reduce((a, b) => a + b.amount, 0), 0);
                            return q.options.slice(0, 4).map((opt) => {
                              const optTotal = opt.bets.reduce((a, b) => a + b.amount, 0);
                              const pct = totalBets > 0 ? (optTotal / totalBets) * 100 : 100 / q.options.length;
                              return (
                                <div key={opt.id} className="flex-1 min-w-0">
                                  <div className="text-[10px] sm:text-xs text-gray-400 truncate">{opt.text}</div>
                                  <div className="h-1 sm:h-1.5 bg-gray-800 rounded-full mt-1">
                                    <div className="h-full bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full transition-all duration-700" style={{ width: `${Math.max(5, pct)}%` }} />
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {resolvedQuestions.length > 0 && (
                <div>
                  <h3 className="text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider mb-2 sm:mb-3">{t("resolved")}</h3>
                  <div className="space-y-2 sm:space-y-3">
                    {resolvedQuestions.map((q) => (
                      <Link key={q.id} href={`/dashboard/groups/${groupId}/questions/${q.id}`} className="glass-hover p-4 sm:p-5 block opacity-70">
                        <div className="flex items-start justify-between">
                          <h4 className="font-semibold text-sm sm:text-base">{q.title}</h4>
                          <span className="px-2 py-1 text-[10px] sm:text-xs rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20">{t("resolved2")}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Members tab */}
      {tab === "members" && (() => {
        const currentUserIsAdmin = group.members.some(
          (m) => m.user.id === session?.user?.id && m.role === "ADMIN"
        );
        return (
        <div className="glass overflow-hidden">
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
                        <img src={member.user.image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        member.user.name?.[0] || "?"
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm sm:text-base truncate">
                        {member.user.name} {isMe && <span className="text-gray-500 text-xs">({t("you")})</span>}
                      </div>
                      <div className="text-[10px] sm:text-xs text-gray-500 flex items-center gap-2">
                        <span>{member.role === "ADMIN" ? t("admin") : t("member")}</span>
                        {stats && (
                          <>
                            <span>&middot;</span>
                            <span>{stats.betCount} {t("bets")}</span>
                            <span>&middot;</span>
                            <span className="text-green-400">{stats.winCount}{t("wins")}</span>
                            <span className="text-red-400">{stats.betCount - stats.winCount - (stats.betCount > 0 && stats.totalWon === 0 && stats.totalLost === 0 ? stats.betCount : 0)}{t("losses")}</span>
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
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-colors"
                        title={t("removeMember")}
                      >
                        {removingMember === member.user.id ? (
                          <span className="w-3.5 h-3.5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                        {t("removeMember")}
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
        <div className="space-y-4">
          <div className="glass p-4 sm:p-6">
            <h3 className="font-semibold mb-3 text-sm sm:text-base">{t("outstandingDebts")}</h3>
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
                        <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
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

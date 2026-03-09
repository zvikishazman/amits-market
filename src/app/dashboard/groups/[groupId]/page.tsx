"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { formatCurrency, timeAgo } from "@/lib/utils";
import { CURRENCY_SYMBOL } from "@/lib/constants";

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
}

interface Question {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  options: Option[];
  creator: { name: string };
  _count: { options: number };
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
}

export default function GroupDetailPage() {
  const params = useParams();
  const groupId = params.groupId as string;
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"markets" | "members">("markets");

  const fetchGroup = useCallback(() => {
    fetch(`/api/groups/${groupId}`)
      .then((r) => r.json())
      .then((data) => {
        setGroup(data.group);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [groupId]);

  useEffect(() => {
    fetchGroup();
  }, [fetchGroup]);

  function copyInviteCode() {
    if (!group) return;
    const link = `${window.location.origin}/join/${group.inviteCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
        <h2 className="text-xl font-bold mb-2">Group not found</h2>
        <p className="text-gray-400">This group doesn&apos;t exist or you&apos;re not a member.</p>
        <Link href="/dashboard" className="btn-primary mt-4 inline-block">Back to Dashboard</Link>
      </div>
    );
  }

  const openQuestions = group.questions.filter((q) => q.status === "OPEN");
  const resolvedQuestions = group.questions.filter((q) => q.status === "RESOLVED");

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">{group.name}</h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">
            Created by {group.creator.name} &middot; {group.members.length} members &middot; {CURRENCY_SYMBOL}{formatCurrency(group.startingBalance || 1000)} starting balance
          </p>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <button onClick={copyInviteCode} className="btn-secondary text-xs sm:text-sm !py-2 !px-3">
            {copied ? "Copied!" : "Copy Invite Link"}
          </button>
          <Link
            href={`/dashboard/groups/${groupId}/questions/new`}
            className="btn-primary text-xs sm:text-sm !py-2 !px-3"
          >
            + New Market
          </Link>
        </div>
      </div>

      {/* Invite code banner */}
      <div className="glass p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
        <div>
          <span className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider">Invite Code</span>
          <div className="font-mono text-base sm:text-lg text-blue-400 mt-0.5 sm:mt-1">{group.inviteCode}</div>
        </div>
        <button onClick={copyInviteCode} className="text-xs sm:text-sm text-blue-400 hover:text-blue-300 transition-colors">
          {copied ? "Link copied!" : "Copy invite link"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900/50 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab("markets")}
          className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
            tab === "markets" ? "bg-gray-800 text-white" : "text-gray-400 hover:text-white"
          }`}
        >
          Markets ({group.questions.length})
        </button>
        <button
          onClick={() => setTab("members")}
          className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
            tab === "members" ? "bg-gray-800 text-white" : "text-gray-400 hover:text-white"
          }`}
        >
          Members ({group.members.length})
        </button>
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
              <h3 className="text-lg font-semibold mb-2">No markets yet</h3>
              <p className="text-gray-400 mb-6 text-sm">Create the first prediction market for your group!</p>
              <Link href={`/dashboard/groups/${groupId}/questions/new`} className="btn-primary">
                Create Market
              </Link>
            </div>
          ) : (
            <>
              {openQuestions.length > 0 && (
                <div>
                  <h3 className="text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider mb-2 sm:mb-3">
                    Open Markets
                  </h3>
                  <div className="space-y-2 sm:space-y-3">
                    {openQuestions.map((q) => (
                      <Link
                        key={q.id}
                        href={`/dashboard/groups/${groupId}/questions/${q.id}`}
                        className="glass-hover p-4 sm:p-5 block"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-white text-sm sm:text-base truncate">{q.title}</h4>
                            <p className="text-xs sm:text-sm text-gray-400 mt-1">
                              {q.options.length} options &middot; by {q.creator.name} &middot; {timeAgo(new Date(q.createdAt))}
                            </p>
                          </div>
                          <span className="px-2 py-1 text-[10px] sm:text-xs rounded-full bg-green-500/10 text-green-400 border border-green-500/20 flex-shrink-0">
                            OPEN
                          </span>
                        </div>
                        {/* Mini odds bars */}
                        <div className="mt-2 sm:mt-3 flex gap-1.5 sm:gap-2">
                          {q.options.slice(0, 4).map((opt) => (
                            <div key={opt.id} className="flex-1 min-w-0">
                              <div className="text-[10px] sm:text-xs text-gray-400 truncate">{opt.text}</div>
                              <div className="h-1 sm:h-1.5 bg-gray-800 rounded-full mt-1">
                                <div
                                  className="h-full bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full transition-all duration-700"
                                  style={{ width: `${Math.max(10, Math.random() * 80 + 20)}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {resolvedQuestions.length > 0 && (
                <div>
                  <h3 className="text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider mb-2 sm:mb-3">
                    Resolved
                  </h3>
                  <div className="space-y-2 sm:space-y-3">
                    {resolvedQuestions.map((q) => (
                      <Link
                        key={q.id}
                        href={`/dashboard/groups/${groupId}/questions/${q.id}`}
                        className="glass-hover p-4 sm:p-5 block opacity-70"
                      >
                        <div className="flex items-start justify-between">
                          <h4 className="font-semibold text-sm sm:text-base">{q.title}</h4>
                          <span className="px-2 py-1 text-[10px] sm:text-xs rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20">
                            RESOLVED
                          </span>
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
      {tab === "members" && (
        <div className="glass overflow-hidden">
          <div className="divide-y divide-gray-800">
            {group.members
              .sort((a, b) => b.balance - a.balance)
              .map((member, i) => (
                <div key={member.id} className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 hover:bg-gray-800/30 transition-colors">
                  <span className="text-xs sm:text-sm font-mono text-gray-500 w-5 sm:w-6">#{i + 1}</span>
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-xs sm:text-sm font-bold flex-shrink-0 overflow-hidden">
                    {member.user.image ? (
                      <img src={member.user.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      member.user.name?.[0] || "?"
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm sm:text-base truncate">{member.user.name}</div>
                    <div className="text-[10px] sm:text-xs text-gray-500">
                      {member.role === "ADMIN" ? "Admin" : "Member"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-mono font-semibold text-sm sm:text-base ${member.balance >= (group.startingBalance || 1000) ? "text-green-400" : "text-red-400"}`}>
                      {CURRENCY_SYMBOL}{formatCurrency(member.balance)}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

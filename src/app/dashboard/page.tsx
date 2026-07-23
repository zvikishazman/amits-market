"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CURRENCY_SYMBOL } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/context";

interface GroupSummary {
  id: string;
  name: string;
  inviteCode: string;
  myRole: string;
  _count: { members: number; questions: number };
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const { t } = useI18n();
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/groups")
      .then((r) => r.json())
      .then((data) => {
        setGroups(data.groups || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      {/* Welcome */}
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">
          {t("welcomeBack")} <span className="gradient-text">{session?.user?.name?.split(" ")[0] || "Player"}</span>
        </h1>
        <p className="text-gray-400 mt-1 text-sm sm:text-base">{t("whatsHappening")}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="card-stat">
          <span className="text-xs sm:text-sm text-gray-400">{t("myGroups")}</span>
          <span className="text-xl sm:text-2xl font-bold font-mono">{groups.length}</span>
        </div>
        <div className="card-stat">
          <span className="text-xs sm:text-sm text-gray-400">{t("activeMarkets")}</span>
          <span className="text-xl sm:text-2xl font-bold font-mono">
            {groups.reduce((sum, g) => sum + g._count.questions, 0)}
          </span>
        </div>
        <div className="card-stat col-span-2 sm:col-span-1">
          <span className="text-xs sm:text-sm text-gray-400">{t("currency")}</span>
          <span className="text-xl sm:text-2xl font-bold font-mono text-green-400">
            {CURRENCY_SYMBOL} {t("shekel")}
          </span>
        </div>
      </div>

      {/* Groups */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base sm:text-lg font-semibold">{t("myGroups")}</h2>
          <Link href="/dashboard/groups/new" className="btn-primary text-xs sm:text-sm !py-2 !px-3 sm:!px-4">
            + {t("createGroup")}
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass p-6">
                <div className="h-5 bg-gray-800 rounded w-2/3 mb-3 animate-shimmer" />
                <div className="h-4 bg-gray-800 rounded w-1/3 animate-shimmer" />
              </div>
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="glass p-8 sm:p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">{t("noGroupsYet")}</h3>
            <p className="text-gray-400 mb-6 text-sm sm:text-base">{t("noGroupsDesc")}</p>
            <Link href="/dashboard/groups/new" className="btn-primary">
              {t("createYourFirstGroup")}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {groups.map((group) => (
              <Link
                key={group.id}
                href={`/dashboard/groups/${group.id}`}
                className="glass-hover p-5 sm:p-6 block"
              >
                <h3 className="font-semibold text-white mb-2">{group.name}</h3>
                <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-400">
                  <span>{group._count.members} {t("members")}</span>
                  <span>{group._count.questions} {t("markets")}</span>
                </div>
                {group.myRole === "ADMIN" && (
                  <div className="mt-3 text-xs font-mono text-gray-500 bg-gray-800/30 rounded-lg px-2 py-1 inline-block">
                    {t("code")}: {group.inviteCode}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="glass p-4 sm:p-6">
        <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">{t("quickActions")}</h2>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <Link href="/dashboard/groups/new" className="btn-secondary text-sm !py-2 text-center">
            {t("createGroup")}
          </Link>
          <button
            onClick={() => {
              const code = prompt(t("enterInviteCode"));
              if (code) window.location.href = `/join/${code}`;
            }}
            className="btn-secondary text-sm !py-2"
          >
            {t("joinWithCode")}
          </button>
        </div>
      </div>
    </div>
  );
}

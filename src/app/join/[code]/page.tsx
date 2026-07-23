"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Logo from "@/components/layout/Logo";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import { CURRENCY_SYMBOL } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/context";

interface GroupPreview {
  name: string;
  memberCount: number;
  creatorName: string;
  startingBalance: number;
}

export default function JoinPage() {
  const params = useParams();
  const code = params.code as string;
  const router = useRouter();
  const { data: session, status } = useSession();
  const { t } = useI18n();

  const [group, setGroup] = useState<GroupPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/invite/${code}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setGroup(data);
        }
        setLoading(false);
      })
      .catch(() => {
        setError(t("failedToValidateInvite"));
        setLoading(false);
      });
  }, [code, t]);

  // Auto-join when user is signed in and group is loaded (e.g. after Google sign-in redirect)
  useEffect(() => {
    if (session && group && !joined && !joining && !error) {
      handleJoin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, group]);

  async function handleJoin() {
    if (!session || !group) return;
    setJoining(true);
    setError("");

    try {
      const res = await fetch(`/api/invite/${code}`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || t("failedToJoin"));

      setJoined(true);
      setJoining(false);
      setTimeout(() => {
        router.push(`/dashboard/groups/${data.groupId}`);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failedToJoin"));
      setJoining(false);
    }
  }

  return (
    <div className="min-h-screen mesh-gradient flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Logo className="justify-center" />
        </div>

        <div className="glass p-6 sm:p-8">
          {loading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-gray-400 mt-4">{t("validatingInvite")}</p>
            </div>
          ) : error && !group ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-bold mb-2">{t("invalidInvite")}</h2>
              <p className="text-gray-400">{error}</p>
              <button onClick={() => router.push("/")} className="btn-primary mt-6">
                {t("goHome")}
              </button>
            </div>
          ) : joined && group ? (
            <div className="text-center py-4">
              <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4 animate-pulse-slow">
                <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold mb-2 text-green-400">{t("welcome")}</h2>
              <p className="text-gray-300 mb-2">{t("youJoined")} <span className="font-semibold gradient-text">{group.name}</span></p>
              <p className="text-sm text-gray-400 mb-4">
                {t("youReceived")} {CURRENCY_SYMBOL}{formatCurrency(group.startingBalance)} {t("toStartBetting")}
              </p>
              <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mt-4" />
              <p className="text-xs text-gray-500 mt-2">{t("redirecting")}</p>
            </div>
          ) : group ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-4 animate-pulse-slow">
                <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold mb-1">{t("youreInvited")}</h2>
              <p className="text-gray-400 mb-6">{t("joinPredictionGroup")}</p>

              <div className="p-4 bg-gray-800/50 rounded-xl mb-4">
                <h3 className="text-lg font-semibold gradient-text">{group.name}</h3>
                <p className="text-sm text-gray-400 mt-1">
                  {group.memberCount} {t("members")} &middot; {t("createdBy")} {group.creatorName}
                </p>
              </div>

              <div className="p-3 bg-green-500/5 border border-green-500/10 rounded-xl mb-6 flex items-center justify-center gap-2">
                <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm text-green-400 font-medium">
                  {t("youllReceive")} {CURRENCY_SYMBOL}{formatCurrency(group.startingBalance)} {t("toStartBetting")}
                </span>
              </div>

              {status === "loading" ? (
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              ) : session ? (
                <>
                  <button onClick={handleJoin} disabled={joining} className="btn-primary w-full">
                    {joining ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        {t("joining")}
                      </span>
                    ) : (
                      t("joinGroup")
                    )}
                  </button>
                  {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
                </>
              ) : (
                <div>
                  <p className="text-sm text-gray-400 mb-4">{t("signInToJoin")}</p>
                  <GoogleSignInButton callbackUrl={`/join/${code}`} />
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

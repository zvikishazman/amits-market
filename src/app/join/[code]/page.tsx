"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Logo from "@/components/layout/Logo";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import { CURRENCY_SYMBOL } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";

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

  const [group, setGroup] = useState<GroupPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
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
        setError("Failed to validate invite");
        setLoading(false);
      });
  }, [code]);

  async function handleJoin() {
    if (!session || !group) return;
    setJoining(true);
    setError("");

    try {
      const res = await fetch(`/api/invite/${code}`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to join");

      router.push(`/dashboard/groups/${data.groupId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join");
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
              <p className="text-gray-400 mt-4">Validating invite...</p>
            </div>
          ) : error && !group ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-bold mb-2">Invalid Invite</h2>
              <p className="text-gray-400">{error}</p>
              <button onClick={() => router.push("/")} className="btn-primary mt-6">
                Go Home
              </button>
            </div>
          ) : group ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-4 animate-pulse-slow">
                <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold mb-1">You&apos;re invited!</h2>
              <p className="text-gray-400 mb-6">Join the prediction market group</p>

              <div className="p-4 bg-gray-800/50 rounded-xl mb-4">
                <h3 className="text-lg font-semibold gradient-text">{group.name}</h3>
                <p className="text-sm text-gray-400 mt-1">
                  {group.memberCount} members &middot; Created by {group.creatorName}
                </p>
              </div>

              {/* Starting balance info */}
              <div className="p-3 bg-green-500/5 border border-green-500/10 rounded-xl mb-6 flex items-center justify-center gap-2">
                <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm text-green-400 font-medium">
                  You&apos;ll receive {CURRENCY_SYMBOL}{formatCurrency(group.startingBalance)} to start betting
                </span>
              </div>

              {status === "loading" ? (
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              ) : session ? (
                <>
                  <button
                    onClick={handleJoin}
                    disabled={joining}
                    className="btn-primary w-full"
                  >
                    {joining ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Joining...
                      </span>
                    ) : (
                      "Join Group"
                    )}
                  </button>
                  {error && (
                    <p className="text-red-400 text-sm mt-3">{error}</p>
                  )}
                </>
              ) : (
                <div>
                  <p className="text-sm text-gray-400 mb-4">Sign in to join this group</p>
                  <GoogleSignInButton />
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

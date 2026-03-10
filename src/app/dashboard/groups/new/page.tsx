"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CURRENCY_SYMBOL, DEFAULT_STARTING_BALANCE, MIN_STARTING_BALANCE, MAX_STARTING_BALANCE } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/context";

export default function CreateGroupPage() {
  const [name, setName] = useState("");
  const [startingBalance, setStartingBalance] = useState(DEFAULT_STARTING_BALANCE.toString());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { t } = useI18n();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const balance = parseInt(startingBalance) || DEFAULT_STARTING_BALANCE;
    if (balance < MIN_STARTING_BALANCE || balance > MAX_STARTING_BALANCE) {
      setError(`${t("startingBalanceRange")} ${CURRENCY_SYMBOL}${formatCurrency(MIN_STARTING_BALANCE)} ${t("and")} ${CURRENCY_SYMBOL}${formatCurrency(MAX_STARTING_BALANCE)}`);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), startingBalance: balance }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("failedToCreateGroup"));
      }

      const data = await res.json();
      router.push(`/dashboard/groups/${data.group.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("somethingWentWrong"));
      setLoading(false);
    }
  }

  const presets = [500, 1000, 5000, 10000];

  return (
    <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">{t("createAGroup")}</h1>
        <p className="text-gray-400 mt-1">{t("createAGroupDesc")}</p>
      </div>

      <form onSubmit={handleSubmit} className="glass p-6 space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
            {t("groupName")}
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("groupNamePlaceholder2")}
            className="input-field"
            maxLength={50}
            required
          />
        </div>

        <div>
          <label htmlFor="balance" className="block text-sm font-medium text-gray-300 mb-2">
            {t("startingBalancePerMember")}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-lg">{CURRENCY_SYMBOL}</span>
            <input
              id="balance"
              type="number"
              value={startingBalance}
              onChange={(e) => setStartingBalance(e.target.value)}
              min={MIN_STARTING_BALANCE}
              max={MAX_STARTING_BALANCE}
              step="100"
              className="input-field pl-8 font-mono text-lg"
              required
            />
          </div>
          <div className="flex gap-2 mt-2">
            {presets.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => setStartingBalance(amount.toString())}
                className={`flex-1 py-1.5 text-xs font-mono rounded-lg transition-all duration-200 ${
                  parseInt(startingBalance) === amount
                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    : "bg-gray-800 hover:bg-gray-700 text-gray-400"
                }`}
              >
                {CURRENCY_SYMBOL}{formatCurrency(amount)}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">{t("everyMemberReceives")}</p>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">
            {t("cancel")}
          </button>
          <button type="submit" disabled={loading || !name.trim()} className="btn-primary flex-1">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t("creating")}
              </span>
            ) : (
              t("createGroup")
            )}
          </button>
        </div>
      </form>

      <div className="glass p-6">
        <h3 className="font-medium mb-2">{t("whatHappensNext")}</h3>
        <ul className="text-sm text-gray-400 space-y-2">
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">1.</span>
            {t("youllGetInviteCode")}
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">2.</span>
            {t("everyoneStartsWith")} {CURRENCY_SYMBOL}{formatCurrency(parseInt(startingBalance) || DEFAULT_STARTING_BALANCE)} {t("toBetWith")}
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">3.</span>
            {t("createQuestionsAndStart")}
          </li>
        </ul>
      </div>
    </div>
  );
}

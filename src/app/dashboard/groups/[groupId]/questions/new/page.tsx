"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { CURRENCY_SYMBOL } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/context";

export default function CreateQuestionPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = params.groupId as string;
  const { t } = useI18n();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [betAmount, setBetAmount] = useState("50");
  const [closesAt, setClosesAt] = useState("");
  const [showBetChoices, setShowBetChoices] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function addOption() {
    if (options.length >= 10) return;
    setOptions([...options, ""]);
  }

  function removeOption(index: number) {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== index));
  }

  function updateOption(index: number, value: string) {
    const updated = [...options];
    updated[index] = value;
    setOptions(updated);
  }

  function getMinDateTime() {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    return now.toISOString().slice(0, 16);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const filteredOptions = options.filter((o) => o.trim());
    if (!title.trim() || filteredOptions.length < 2) {
      setError(t("provideQuestionAndOptions"));
      return;
    }

    const amount = parseInt(betAmount);
    if (isNaN(amount) || amount < 1 || amount > 10000) {
      setError(t("betAmountValidation"));
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/groups/${groupId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          options: filteredOptions,
          betAmount: amount,
          closesAt: closesAt || undefined,
          showBetChoices,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("failedToCreateMarket"));
      }

      const data = await res.json();
      router.push(`/dashboard/groups/${groupId}/questions/${data.question.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("somethingWentWrong"));
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">{t("createAMarket")}</h1>
        <p className="text-gray-400 mt-1">{t("createMarketDesc")}</p>
      </div>

      <form onSubmit={handleSubmit} className="glass p-6 space-y-6">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-2">
            {t("question")}
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("questionPlaceholder")}
            className="input-field"
            maxLength={200}
            required
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-2">
            {t("description")} <span className="text-gray-500">({t("optional")})</span>
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("descriptionPlaceholder")}
            className="input-field min-h-[80px] resize-none"
            maxLength={500}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">{t("answerOptions")}</label>
          <div className="space-y-3">
            {options.map((option, i) => (
              <div key={i} className="flex gap-2">
                <div className="w-8 h-12 flex items-center justify-center text-sm font-mono text-gray-500">{i + 1}.</div>
                <input
                  type="text"
                  value={option}
                  onChange={(e) => updateOption(i, e.target.value)}
                  placeholder={`${t("option")} ${i + 1}`}
                  className="input-field flex-1"
                  maxLength={100}
                />
                {options.length > 2 && (
                  <button type="button" onClick={() => removeOption(i)} className="px-3 text-gray-500 hover:text-red-400 transition-colors">&times;</button>
                )}
              </div>
            ))}
          </div>
          {options.length < 10 && (
            <button type="button" onClick={addOption} className="mt-3 text-sm text-blue-400 hover:text-blue-300 transition-colors">
              {t("addOption")}
            </button>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            {t("betAmount")} <span className="text-gray-500">({t("everyonePaysThis")})</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">{CURRENCY_SYMBOL}</span>
            <input type="number" value={betAmount} onChange={(e) => setBetAmount(e.target.value)} min={1} max={10000} className="input-field pl-8 font-mono" />
          </div>
          <div className="flex gap-2 mt-2">
            {[10, 25, 50, 100, 250, 500].map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => setBetAmount(amount.toString())}
                className={`flex-1 py-1.5 text-xs rounded-lg transition-colors font-mono ${
                  betAmount === amount.toString() ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "bg-gray-800 hover:bg-gray-700 text-gray-400"
                }`}
              >
                {amount}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">{t("eachMemberWillPay")} {CURRENCY_SYMBOL}{betAmount || "0"} {t("toVote")}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            {t("bettingDeadline")} <span className="text-gray-500">({t("optional")})</span>
          </label>
          <input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} min={getMinDateTime()} className="input-field" />
          <p className="text-xs text-gray-500 mt-2">
            {closesAt ? `${t("noOneCanBetAfter")} ${new Date(closesAt).toLocaleString()}` : t("noDeadline")}
          </p>
        </div>

        {/* Privacy toggle */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowBetChoices(!showBetChoices)}
            className={`relative w-11 h-6 rounded-full transition-colors ${showBetChoices ? "bg-blue-500" : "bg-gray-700"}`}
          >
            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${showBetChoices ? "translate-x-[22px]" : "translate-x-0.5"}`} />
          </button>
          <span className="text-sm text-gray-300">
            {showBetChoices ? t("showBetChoicesLabel") : t("hideBetChoicesLabel")}
          </span>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">{t("cancel")}</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t("creating")}
              </span>
            ) : t("createMarket")}
          </button>
        </div>
      </form>
    </div>
  );
}

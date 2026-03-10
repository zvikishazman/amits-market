"use client";

import { useI18n } from "@/lib/i18n/context";

export default function LanguageToggle() {
  const { locale, setLocale } = useI18n();

  return (
    <button
      onClick={() => setLocale(locale === "en" ? "he" : "en")}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-800/60 hover:bg-gray-700/60 border border-gray-700/50 transition-all duration-200 text-xs font-medium"
      title={locale === "en" ? "עברית" : "English"}
    >
      <span className="text-sm">{locale === "en" ? "🇮🇱" : "🇬🇧"}</span>
      <span className="text-gray-300">{locale === "en" ? "עב" : "EN"}</span>
    </button>
  );
}

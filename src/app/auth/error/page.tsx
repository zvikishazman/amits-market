"use client";

import Link from "next/link";
import Logo from "@/components/layout/Logo";
import { useI18n } from "@/lib/i18n/context";

export default function AuthErrorPage() {
  const { t } = useI18n();

  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const errorType = params?.get("error") || "Default";

  const errorMessages: Record<string, string> = {
    Configuration: t("errorConfiguration"),
    AccessDenied: t("errorAccessDenied"),
    Verification: t("errorVerification"),
    Default: t("errorDefault"),
  };

  const errorMessage = errorMessages[errorType] || errorMessages.Default;

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="glass p-8 sm:p-10 shadow-2xl shadow-black/30">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <Logo />
          </div>

          {/* Error icon */}
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>

          {/* Error message */}
          <h1 className="text-xl font-bold text-white mb-2">
            {t("authError")}
          </h1>
          <p className="text-gray-400 text-sm mb-8">
            {errorMessage}
          </p>

          {/* Back to sign in */}
          <Link href="/auth/signin" className="btn-primary inline-block">
            {t("tryAgain")}
          </Link>
        </div>
      </div>
    </div>
  );
}

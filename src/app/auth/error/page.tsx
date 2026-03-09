import Link from "next/link";
import Logo from "@/components/layout/Logo";

interface ErrorPageProps {
  searchParams: { error?: string };
}

const errorMessages: Record<string, string> = {
  Configuration: "There is a problem with the server configuration.",
  AccessDenied: "Access denied. You do not have permission to sign in.",
  Verification: "The verification link has expired or has already been used.",
  Default: "An unexpected error occurred during authentication.",
};

export default function AuthErrorPage({ searchParams }: ErrorPageProps) {
  const errorType = searchParams.error || "Default";
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
            Authentication Error
          </h1>
          <p className="text-gray-400 text-sm mb-8">
            {errorMessage}
          </p>

          {/* Back to sign in */}
          <Link href="/auth/signin" className="btn-primary inline-block">
            Try Again
          </Link>
        </div>
      </div>
    </div>
  );
}

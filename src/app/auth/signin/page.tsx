import Logo from "@/components/layout/Logo";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 mesh-gradient">
      <div className="w-full max-w-md">
        {/* Glass card */}
        <div className="glass p-8 sm:p-10 shadow-2xl shadow-black/30">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <Logo />
          </div>

          {/* Heading */}
          <h1 className="text-2xl sm:text-3xl font-bold text-white text-center mb-2">
            Welcome to{" "}
            <span className="gradient-text">Amit&apos;s Market</span>
          </h1>
          <p className="text-gray-400 text-center mb-8 text-sm leading-relaxed">
            Your premium prediction market platform. Sign in to create groups,
            make predictions, and track your performance.
          </p>

          {/* Divider */}
          <div className="relative mb-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-800" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-gray-900/60 text-gray-500">
                Sign in to continue
              </span>
            </div>
          </div>

          {/* Google Sign-In */}
          <GoogleSignInButton />

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-gray-600 leading-relaxed">
            By continuing, you agree to our Terms of Service and Privacy Policy.
            Your data is encrypted and secure.
          </p>
        </div>

        {/* Security badge */}
        <div className="flex items-center justify-center gap-2 mt-6 text-gray-600">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <span className="text-xs">Secured with 256-bit encryption</span>
        </div>
      </div>
    </div>
  );
}

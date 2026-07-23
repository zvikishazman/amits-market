import UserMenu from "@/components/auth/UserMenu";
import LanguageToggle from "@/components/ui/LanguageToggle";

interface TopbarProps {
  onMenuClick?: () => void;
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 h-14 sm:h-16 flex items-center justify-between px-3 sm:px-6 bg-gray-900/60 backdrop-blur-xl border-b border-gray-800/50">
      {/* Left: hamburger + page title area */}
      <div className="flex items-center gap-4">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800/60 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        <div className="hidden sm:block" />
      </div>

      {/* Right: Language toggle + User menu */}
      <div className="flex items-center gap-3">
        <LanguageToggle />
        <UserMenu />
      </div>
    </header>
  );
}

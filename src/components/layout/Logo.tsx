import Link from "next/link";

interface LogoProps {
  className?: string;
}

export default function Logo({ className = "" }: LogoProps) {
  return (
    <Link href="/" className={`flex items-center gap-3 group ${className}`}>
      <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-shadow duration-300">
        <span className="text-white font-bold text-lg tracking-tight">AM</span>
      </div>
      <span className="gradient-text text-xl font-bold tracking-tight">
        Amit&apos;s Market
      </span>
    </Link>
  );
}

"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import Logo from "@/components/layout/Logo";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import { CURRENCY_SYMBOL } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/context";

function AnimatedCounter({ end, duration = 2000, prefix = "" }: { end: number; duration?: number; prefix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStarted(true); },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    let start = 0;
    const increment = end / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [end, duration, started]);

  return <div ref={ref}>{prefix}{count.toLocaleString()}</div>;
}

function LiveOddsBar({ label, percentage, color, delay }: { label: string; percentage: number; color: string; delay: number }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setWidth(percentage), delay);
    return () => clearTimeout(timer);
  }, [percentage, delay]);

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <div className="flex-1 h-10 sm:h-12 bg-gray-800/80 rounded-xl overflow-hidden backdrop-blur-sm">
        <div
          className={`h-full ${color} rounded-xl flex items-center justify-between px-3 sm:px-4 transition-all duration-1000 ease-out`}
          style={{ width: `${width}%` }}
        >
          <span className="text-xs sm:text-sm font-semibold text-white drop-shadow-lg truncate">{label}</span>
          {width > 30 && (
            <span className="text-xs font-mono text-white/70 hidden sm:inline">{CURRENCY_SYMBOL}{Math.floor(percentage * 4.5)}</span>
          )}
        </div>
      </div>
      <div className="w-12 sm:w-16 text-right">
        <span className="text-base sm:text-lg font-mono font-bold text-white">{percentage}%</span>
      </div>
    </div>
  );
}

const PARTICLES = [
  { delay: 0, size: 4, x: 9, y: 18, duration: 7 },
  { delay: 0.8, size: 6, x: 22, y: 71, duration: 9 },
  { delay: 1.6, size: 3, x: 35, y: 38, duration: 8 },
  { delay: 2.4, size: 5, x: 48, y: 86, duration: 10 },
  { delay: 3.2, size: 4, x: 61, y: 24, duration: 6 },
  { delay: 4, size: 7, x: 73, y: 64, duration: 9 },
  { delay: 4.8, size: 3, x: 84, y: 42, duration: 7 },
  { delay: 5.6, size: 5, x: 94, y: 79, duration: 8 },
] as const;

function FloatingParticle({ delay, size, x, y, duration }: { delay: number; size: number; x: number; y: number; duration: number }) {
  return (
    <div
      className="absolute rounded-full bg-blue-500/20 animate-float-particle"
      style={{
        width: size,
        height: size,
        left: `${x}%`,
        top: `${y}%`,
        animationDelay: `${delay}s`,
        animationDuration: `${duration}s`,
      }}
    />
  );
}

export default function LandingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useI18n();

  useEffect(() => {
    if (session) router.push("/dashboard");
  }, [session, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-500">{t("loading")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#0a0a0f]">
      {/* Animated background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-blue-600/8 rounded-full blur-[80px] sm:blur-[120px] animate-float" />
        <div className="absolute bottom-0 right-1/4 w-[400px] sm:w-[600px] h-[400px] sm:h-[600px] bg-cyan-500/6 rounded-full blur-[80px] sm:blur-[120px] animate-float" style={{ animationDelay: "3s" }} />
        <div className="absolute top-1/3 right-1/3 w-[250px] sm:w-[400px] h-[250px] sm:h-[400px] bg-purple-500/5 rounded-full blur-[60px] sm:blur-[100px] animate-float" style={{ animationDelay: "5s" }} />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:40px_40px] sm:bg-[size:60px_60px]" />
        {PARTICLES.map((particle) => (
          <FloatingParticle key={`${particle.x}-${particle.y}`} {...particle} />
        ))}
      </div>

      <header className="relative z-20 flex items-center justify-center px-6 md:px-12 py-5 max-w-7xl mx-auto">
        <Logo />
      </header>

      <main className="relative z-10">
        <section className="flex flex-col items-center justify-center text-center px-4 sm:px-6 pt-8 sm:pt-16 md:pt-24 pb-16 sm:pb-20">
          <div className="animate-fade-in">
            <div className="inline-flex items-center gap-2 sm:gap-2.5 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 text-xs sm:text-sm font-medium mb-8 sm:mb-10">
              <span className="relative flex h-2 w-2 sm:h-2.5 sm:w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 sm:h-2.5 sm:w-2.5 bg-blue-500" />
              </span>
              <span className="text-blue-300">{t("theFutureOfSocial")}</span>
            </div>
          </div>

          <h1 className="animate-slide-up">
            <span className="block text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight leading-[1.1]">
              {t("predictThe")}
            </span>
            <span className="block text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight leading-[1.1] mt-2">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-300% animate-gradient">
                {t("unpredictable")}
              </span>
            </span>
          </h1>

          <p className="mt-6 sm:mt-8 text-base sm:text-lg md:text-xl text-gray-400 max-w-2xl leading-relaxed animate-slide-up px-2" style={{ animationDelay: "0.15s" }}>
            {t("landingSubtitle")}
          </p>

          <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center gap-4 animate-slide-up w-full sm:w-auto px-4 sm:px-0" style={{ animationDelay: "0.25s" }}>
            <div className="w-full sm:w-auto">
              <GoogleSignInButton />
            </div>
            <a href="#how-it-works" className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1 group">
              {t("seeHowItWorks")}
              <svg className="w-4 h-4 transition-transform group-hover:translate-y-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </a>
          </div>

          <div className="mt-12 sm:mt-16 flex items-center gap-6 sm:gap-8 md:gap-16 animate-slide-up" style={{ animationDelay: "0.35s" }}>
            {[
              { value: 1000, label: t("startingBalanceStat"), prefix: CURRENCY_SYMBOL },
              { value: 100, label: t("securePrivate"), suffix: "%" },
              { value: 0, label: t("zeroFees"), suffix: "" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-xl sm:text-2xl md:text-3xl font-bold font-mono text-white">
                  {stat.value > 0 ? (
                    <AnimatedCounter end={stat.value} prefix={stat.prefix || ""} />
                  ) : "0"}
                  {stat.suffix}
                </div>
                <div className="text-[10px] sm:text-xs text-gray-500 mt-1 uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Live Market Demo */}
        <section className="px-4 sm:px-6 pb-16 sm:pb-24 max-w-4xl mx-auto">
          <div className="animate-slide-up" style={{ animationDelay: "0.5s" }}>
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600/20 via-cyan-500/20 to-blue-600/20 rounded-3xl blur-xl transition-all duration-500 group-hover:from-blue-600/30 group-hover:via-cyan-500/30 group-hover:to-blue-600/30" />
              <div className="relative bg-gray-900/70 backdrop-blur-2xl border border-gray-700/50 rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-2xl shadow-blue-900/10">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] sm:text-xs font-mono text-gray-400 uppercase tracking-widest">{t("liveMarket")}</span>
                  </div>
                  <span className="px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-bold rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                    {t("open")}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl md:text-2xl font-bold mb-1 sm:mb-2">{t("whoWillWin")}</h3>
                <p className="text-xs sm:text-sm text-gray-500 mb-4 sm:mb-6">{t("liveMarketDesc")}</p>
                <div className="space-y-2 sm:space-y-3">
                  <LiveOddsBar label="Team Alpha" percentage={45} color="bg-gradient-to-r from-blue-600 to-blue-500" delay={800} />
                  <LiveOddsBar label="Team Beta" percentage={32} color="bg-gradient-to-r from-cyan-600 to-cyan-500" delay={1000} />
                  <LiveOddsBar label="Team Gamma" percentage={23} color="bg-gradient-to-r from-purple-600 to-purple-500" delay={1200} />
                </div>
                <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-gray-800/50 flex items-center justify-between">
                  <div className="flex items-center gap-4 sm:gap-6">
                    <div>
                      <div className="text-[10px] sm:text-xs text-gray-500">{t("totalPool")}</div>
                      <div className="text-base sm:text-lg font-mono font-bold text-white">{CURRENCY_SYMBOL}2,450</div>
                    </div>
                    <div>
                      <div className="text-[10px] sm:text-xs text-gray-500">{t("yourPotential")}</div>
                      <div className="text-base sm:text-lg font-mono font-bold text-green-400">+{CURRENCY_SYMBOL}340</div>
                    </div>
                  </div>
                  <button className="btn-primary text-xs sm:text-sm !py-2 !px-3 sm:!py-2.5 sm:!px-5">
                    {t("placeBet")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="px-4 sm:px-6 pb-16 sm:pb-24 max-w-6xl mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold">{t("howItWorks")}</h2>
            <p className="text-gray-400 mt-3 sm:mt-4 max-w-lg mx-auto text-sm sm:text-base">{t("threeSimpleSteps")}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-8">
            {[
              { step: "01", title: t("createAGroup"), description: t("createAGroupDesc"), icon: <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg> },
              { step: "02", title: t("setAQuestion"), description: t("setAQuestionDesc"), icon: <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
              { step: "03", title: t("betAndWin"), description: t("betAndWinDesc"), icon: <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg> },
            ].map((item) => (
              <div key={item.step} className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600/0 to-cyan-600/0 group-hover:from-blue-600/20 group-hover:to-cyan-600/20 rounded-2xl blur transition-all duration-500" />
                <div className="relative glass p-6 sm:p-8 h-full transition-all duration-300 hover:border-blue-500/30 hover:translate-y-[-2px]">
                  <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-5">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/10 flex items-center justify-center text-blue-400">{item.icon}</div>
                    <span className="text-xs font-mono text-gray-600 tracking-widest">{t("step")} {item.step}</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-white mb-2 sm:mb-3">{item.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Features grid */}
        <section className="px-4 sm:px-6 pb-16 sm:pb-24 max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {[
              { color: "green", title: t("privateAndSecure"), desc: t("privateAndSecureDesc"), icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
              { color: "blue", title: t("realTimeOdds"), desc: t("realTimeOddsDesc"), icon: "M13 10V3L4 14h7v7l9-11h-7z" },
              { color: "purple", title: t("fairPayouts"), desc: t("fairPayoutsDesc"), icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
              { color: "amber", title: t("betOnAnything"), desc: t("betOnAnythingDesc"), icon: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" },
            ].map((item) => (
              <div key={item.title} className="glass p-6 sm:p-8 md:p-10 group hover:border-gray-700 transition-all duration-300 hover:translate-y-[-2px]">
                <div className={`w-10 h-10 rounded-lg bg-${item.color}-500/10 flex items-center justify-center mb-4 sm:mb-5 group-hover:scale-110 transition-transform duration-300`}>
                  <svg className={`w-5 h-5 text-${item.color}-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                  </svg>
                </div>
                <h3 className="text-lg sm:text-xl font-bold mb-2">{item.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-4 sm:px-6 pb-20 sm:pb-32 max-w-3xl mx-auto text-center">
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-r from-blue-600/10 via-cyan-500/10 to-blue-600/10 rounded-3xl blur-2xl animate-pulse-slow" />
            <div className="relative glass p-8 sm:p-12 md:p-16">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">{t("readyToPredict")}</h2>
              <p className="text-gray-400 mb-6 sm:mb-8 max-w-md mx-auto text-sm sm:text-base">{t("readyToPredictDesc")}</p>
              <div className="max-w-xs mx-auto"><GoogleSignInButton /></div>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-gray-800/50 py-6 sm:py-8 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
          <Logo />
          <p className="text-xs sm:text-sm text-gray-600">&copy; 2024 Amit&apos;s Market. {t("allRightsReserved")}</p>
        </div>
      </footer>
    </div>
  );
}

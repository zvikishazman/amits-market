import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function timeAgo(date: Date, t?: (key: any) => string): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (t) {
    if (seconds < 60) return t("justNow");
    if (seconds < 3600) return `${Math.floor(seconds / 60)}${t("minutesAgo")}`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}${t("hoursAgo")}`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}${t("daysAgo")}`;
  } else {
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  }
  return date.toLocaleDateString();
}

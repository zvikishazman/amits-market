import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number;
  color?: 'blue' | 'green' | 'red';
  className?: string;
  label?: string;
}

const colorClasses = {
  blue: 'from-blue-500 to-cyan-400',
  green: 'from-emerald-500 to-green-400',
  red: 'from-red-500 to-rose-400',
};

export default function ProgressBar({
  value,
  color = 'blue',
  className,
  label,
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">{label}</span>
          <span className="font-medium text-gray-300">{Math.round(clamped)}%</span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className={cn(
            'h-full rounded-full bg-gradient-to-r transition-all duration-500 ease-out',
            colorClasses[color]
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

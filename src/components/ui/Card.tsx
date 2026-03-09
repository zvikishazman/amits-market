import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface CardProps {
  className?: string;
  children: ReactNode;
  hover?: boolean;
}

export default function Card({ className, children, hover = false }: CardProps) {
  return (
    <div
      className={cn(
        'glass rounded-xl p-6',
        hover && 'glass-hover',
        className
      )}
    >
      {children}
    </div>
  );
}

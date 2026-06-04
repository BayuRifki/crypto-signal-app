import type { ReactNode } from 'react';

type Props = {
  className?: string;
  width?: string;
  height?: string;
  rounded?: string;
  children?: ReactNode;
};

export function Skeleton({ className = '', width = '100%', height = '12px', rounded = '4px' }: Props) {
  return <div className={`shimmer ${className}`} style={{ width, height, borderRadius: rounded }} />;
}

export const SkeletonText = ({ width = '100%' }: { width?: string }) => (
  <Skeleton width={width} height="10px" />
);

export const SkeletonCard = ({ rows = 3 }: { rows?: number }) => (
  <div className="card p-4 space-y-2">
    {Array.from({ length: rows }).map((_, i) => (
      <Skeleton key={i} width={i === 0 ? '40%' : i === rows - 1 ? '60%' : '85%'} height="10px" />
    ))}
  </div>
);

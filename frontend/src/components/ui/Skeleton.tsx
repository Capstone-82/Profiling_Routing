

interface SkeletonProps {
  className?: string;
  rows?: number;
}

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`skeleton rounded ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonText({ rows = 3 }: SkeletonProps) {
  return (
    <div className="space-y-2.5" aria-busy="true" aria-label="Loading...">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-3.5 ${i === rows - 1 ? 'w-3/5' : 'w-full'}`}
        />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-[#D9E4F0] p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-lg" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <SkeletonText rows={3} />
    </div>
  );
}

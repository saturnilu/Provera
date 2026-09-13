export function SkeletonBlock({ className = '' }) {
  return <div className={`animate-pulse bg-border/70 rounded-md ${className}`} />;
}

export function SkeletonLine({ width = 'w-full', className = '' }) {
  return <div className={`animate-pulse bg-border/70 rounded h-3 ${width} ${className}`} />;
}

export function RoomDetailSkeleton() {
  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-8">
      <SkeletonLine width="w-40" className="h-3" />

      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <SkeletonLine width="w-56" className="h-6" />
          <SkeletonLine width="w-32" className="h-3" />
        </div>
        <div className="flex gap-2">
          <SkeletonBlock className="h-9 w-28" />
          <SkeletonBlock className="h-9 w-28" />
        </div>
      </div>

      <section>
        <SkeletonLine width="w-24" className="h-4 mb-3" />
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <SkeletonBlock key={i} className="h-12 w-full" />
          ))}
        </div>
      </section>

      <section>
        <SkeletonLine width="w-32" className="h-4 mb-3" />
        <SkeletonBlock className="h-12 w-56" />
      </section>
    </div>
  );
}

export function AdminSkeleton() {
  return (
    <div className="max-w-5xl mx-auto py-10 px-4 space-y-8">
      <div className="space-y-2">
        <SkeletonLine width="w-24" className="h-6" />
        <SkeletonLine width="w-64" className="h-3" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonBlock key={i} className="h-20 w-full" />
        ))}
      </div>
      <div className="space-y-2">
        <SkeletonLine width="w-32" className="h-4" />
        <SkeletonBlock className="h-40 w-full" />
      </div>
      <div className="space-y-2">
        <SkeletonLine width="w-32" className="h-4" />
        <SkeletonBlock className="h-40 w-full" />
      </div>
    </div>
  );
}

export function RecapSkeleton() {
  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <SkeletonLine width="w-32" className="h-3 mb-4" />
      <SkeletonLine width="w-64" className="h-6 mb-2" />
      <SkeletonLine width="w-full" className="h-3 mb-1" />
      <SkeletonLine width="w-3/4" className="h-3 mb-6" />

      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4">
            <div className="flex justify-between items-center">
              <SkeletonLine width="w-32" className="h-4" />
              <SkeletonLine width="w-16" className="h-3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ExamSkeleton() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <SkeletonLine width="w-48" className="h-6" />
        <SkeletonBlock className="h-8 w-20" />
      </div>
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1">
          <SkeletonBlock className="h-56 w-full" />
        </div>
        <div className="col-span-2 space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-2">
              <SkeletonLine width="w-16" className="h-3" />
              <SkeletonLine width="w-full" className="h-4" />
              <SkeletonLine width="w-2/3" className="h-4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
/**
 * Instant navigation feedback for every /dashboard/* route.
 *
 * Without a loading boundary, the App Router paints NOTHING when a sidebar link
 * is clicked until the server finishes rendering the next page + its data
 * fetches — so clicks feel frozen / unresponsive. This Suspense fallback paints
 * immediately on click (the sidebar + header stay put; only this content area
 * swaps to a skeleton) while the real page streams in.
 */
export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* page hero / header band */}
      <div className="h-32 rounded-3xl bg-[#eef0f2]" />

      {/* stat tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 rounded-2xl border border-line-soft bg-white"
          />
        ))}
      </div>

      {/* main content blocks */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="h-80 rounded-2xl border border-line-soft bg-white lg:col-span-2" />
        <div className="h-80 rounded-2xl border border-line-soft bg-white" />
      </div>
    </div>
  )
}

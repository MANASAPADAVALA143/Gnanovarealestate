export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 rounded bg-slate-200" />
      <div className="h-4 w-full max-w-md rounded bg-slate-200" />
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-xl border border-slate-200 bg-white shadow-sm" />
        ))}
      </div>
    </div>
  )
}

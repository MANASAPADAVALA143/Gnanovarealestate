export default function ScoredLeadsLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-56 rounded bg-slate-200" />
      <div className="h-10 w-full max-w-xl rounded-lg bg-slate-200" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-xl border border-slate-200 bg-white" />
        ))}
      </div>
      <div className="h-64 rounded-xl border border-slate-200 bg-white" />
    </div>
  )
}

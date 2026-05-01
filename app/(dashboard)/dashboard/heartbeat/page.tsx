/**
 * Zero-JS sanity check: if you see this in the browser, Next routing + HTML work.
 * Main dashboard is a client page; use this route to rule out "blank" tooling issues.
 */
export default function HeartbeatPage() {
  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center space-y-2">
      <h1 className="text-xl font-bold text-green-900">Next.js is serving pages</h1>
      <p className="text-sm text-green-800">
        If the main dashboard is blank but this page works, the problem is almost always the
        embedded browser or a client-side error — use Chrome and check the console (F12).
      </p>
      <a
        href="/dashboard"
        className="inline-block text-sm font-semibold text-blue-700 underline hover:text-blue-900"
      >
        Go to Dashboard
      </a>
    </div>
  )
}

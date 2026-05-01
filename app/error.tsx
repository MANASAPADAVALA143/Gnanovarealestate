'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[app/error]', error)
  }, [error])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 p-8 text-center">
      <h1 className="text-lg font-semibold text-slate-900">Something went wrong</h1>
      <p className="text-sm text-slate-600 max-w-md">{error.message || 'Unknown error'}</p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
      >
        Try again
      </button>
    </div>
  )
}

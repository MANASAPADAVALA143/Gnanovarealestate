import { Component, type ErrorInfo, type ReactNode } from 'react'

type State = { error: Error | null }

/**
 * Catches render errors so the page is not a blank white screen.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[AppErrorBoundary]', error.message, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100vh',
            padding: '2rem',
            fontFamily: 'system-ui, sans-serif',
            maxWidth: 560,
            margin: '0 auto',
            color: '#0f172a',
          }}
        >
          <h1 style={{ color: '#b91c1c', fontSize: '1.25rem', marginBottom: 12 }}>App failed to render</h1>
          <p style={{ marginBottom: 8 }}>{this.state.error.message}</p>
          <p style={{ fontSize: 14, color: '#64748b', marginTop: 16 }}>
            Open DevTools (F12) → Console for the full stack trace. After fixing the code, refresh the page.
          </p>
        </div>
      )
    }
    return this.props.children
  }
}

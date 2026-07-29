/**
 * Auth/redirect helpers shared by App.tsx ProtectedRoute and Vitest (node) tests.
 * Mirrors agents.is_manager / public.is_deal_manager() for client-side route gates.
 */

export type AuthGateState = 'loading' | 'allow' | 'redirect-login'

/** Vite dashboard ProtectedRoute decision (session presence). */
export function resolveProtectedRouteAccess(opts: {
  loading: boolean
  userId: string | null
}): AuthGateState {
  if (opts.loading) return 'loading'
  if (opts.userId) return 'allow'
  return 'redirect-login'
}

/**
 * Manager/owner routes (Integrations, Admin).
 * Mirrors public.is_deal_manager() after 030 (is_manager OR is_owner).
 */
export function shouldAllowManagerRoute(opts: {
  isManager: boolean
  /** Owner is a superset of manager for route access. */
  isOwner?: boolean
  /** Dev dashboard preview may explore manager screens without a real flag. */
  previewMode?: boolean
}): boolean {
  if (opts.previewMode) return true
  return opts.isManager || Boolean(opts.isOwner)
}

/**
 * After signOut, AuthContext keeps a preview session when dashboard preview is enabled
 * (dev default). That means ProtectedRoute still sees a user — intentional local UX,
 * not a production auth bypass (preview is off in production builds unless forced).
 */
export function resolvePostSignOutSession(opts: {
  previewEnabled: boolean
}): 'preview-user' | 'signed-out' {
  return opts.previewEnabled ? 'preview-user' : 'signed-out'
}

/** Login page: already-authenticated users should go to dashboard. */
export function resolveLoginPageRedirect(opts: {
  authLoading: boolean
  userId: string | null
}): 'wait' | 'dashboard' | 'show-form' {
  if (opts.authLoading) return 'wait'
  if (opts.userId) return 'dashboard'
  return 'show-form'
}

/**
 * Next.js app/(dashboard) has no middleware / auth check today.
 * Documented so Phase 3 flags the gap until a guard exists.
 */
export function nextDashboardHasServerAuthGuard(layoutSource: string): boolean {
  const src = layoutSource.toLowerCase()
  return (
    src.includes('getuser') ||
    src.includes('getsession') ||
    src.includes('createserverclient') ||
    (src.includes('redirect(') && src.includes('login')) ||
    src.includes('unauthorized')
  )
}

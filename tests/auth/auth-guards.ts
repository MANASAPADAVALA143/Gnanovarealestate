/**
 * Re-export production helpers so Vitest imports a single path.
 * Implementation lives in src/lib/authGuards.ts (used by App.tsx).
 */
export {
  resolveProtectedRouteAccess,
  shouldAllowManagerRoute,
  resolvePostSignOutSession,
  resolveLoginPageRedirect,
  nextDashboardHasServerAuthGuard,
  type AuthGateState,
} from '../../src/lib/authGuards'

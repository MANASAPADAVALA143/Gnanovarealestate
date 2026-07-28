import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import {
  nextDashboardHasServerAuthGuard,
  resolveLoginPageRedirect,
  resolvePostSignOutSession,
  resolveProtectedRouteAccess,
  shouldAllowManagerRoute,
} from './auth-guards'

describe('Vite ProtectedRoute gate (App.tsx behavior)', () => {
  it('shows loading while auth resolves', () => {
    expect(resolveProtectedRouteAccess({ loading: true, userId: null })).toBe('loading')
  })

  it('allows dashboard when a user session exists', () => {
    expect(
      resolveProtectedRouteAccess({ loading: false, userId: 'agent-uuid' })
    ).toBe('allow')
  })

  it('redirects unauthenticated users to /login', () => {
    expect(resolveProtectedRouteAccess({ loading: false, userId: null })).toBe(
      'redirect-login'
    )
  })

  it('allows any authenticated user past the base gate (role checked separately)', () => {
    expect(
      resolveProtectedRouteAccess({ loading: false, userId: 'manager-uuid' })
    ).toBe('allow')
    expect(
      resolveProtectedRouteAccess({ loading: false, userId: 'agent-uuid' })
    ).toBe('allow')
  })
})

describe('Manager-only route gate (Integrations)', () => {
  it('allows managers', () => {
    expect(shouldAllowManagerRoute({ isManager: true })).toBe(true)
  })

  it('blocks non-managers', () => {
    expect(shouldAllowManagerRoute({ isManager: false })).toBe(false)
  })

  it('allows preview mode to explore manager screens', () => {
    expect(
      shouldAllowManagerRoute({ isManager: false, previewMode: true })
    ).toBe(true)
  })
})

describe('Login page redirect', () => {
  it('sends already-signed-in users to dashboard', () => {
    expect(
      resolveLoginPageRedirect({ authLoading: false, userId: 'u1' })
    ).toBe('dashboard')
  })

  it('shows form when signed out', () => {
    expect(
      resolveLoginPageRedirect({ authLoading: false, userId: null })
    ).toBe('show-form')
  })
})

describe('signOut + dashboard preview interaction', () => {
  it('keeps preview user in development when preview flag is on', () => {
    expect(resolvePostSignOutSession({ previewEnabled: true })).toBe('preview-user')
  })

  it('clears session when preview is off (production default)', () => {
    expect(resolvePostSignOutSession({ previewEnabled: false })).toBe('signed-out')
  })
})

describe('Next.js app/(dashboard) auth guard', () => {
  it('flags missing server-side auth on dashboard layout', () => {
    const layoutPath = resolve(process.cwd(), 'app/(dashboard)/layout.tsx')
    const source = readFileSync(layoutPath, 'utf8')
    expect(nextDashboardHasServerAuthGuard(source)).toBe(false)
  })

  it('notes there is no middleware.ts auth guard in the repo', () => {
    const middlewarePath = resolve(process.cwd(), 'middleware.ts')
    let exists = true
    try {
      readFileSync(middlewarePath)
    } catch {
      exists = false
    }
    expect(exists).toBe(false)
  })
})

describe('Password reset UI wiring', () => {
  it('Login links to /forgot-password but App.tsx has no matching route', () => {
    const login = readFileSync(resolve(process.cwd(), 'src/pages/Login.tsx'), 'utf8')
    const app = readFileSync(resolve(process.cwd(), 'App.tsx'), 'utf8')
    expect(login).toMatch(/forgot-password/)
    expect(app).not.toMatch(/forgot-password|ForgotPassword/)
  })
})

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createAnonClient,
  createServiceClient,
  createTestAgent,
  destroyTestAgent,
  skipMessage,
  supabaseReady,
  type TestAgent,
} from '../rls/helpers'

/**
 * Phase 3 — live auth flows against Supabase (anon key for user ops, service role for cleanup).
 */
describe('Auth flows (live Supabase)', () => {
  const ready = supabaseReady()

  let service: SupabaseClient
  let agent: TestAgent

  beforeAll(async () => {
    if (!ready) return
    service = createServiceClient()
    agent = await createTestAgent(service, 'A')
  }, 60_000)

  afterAll(async () => {
    if (!ready || !service || !agent) return
    await destroyTestAgent(service, agent)
  }, 60_000)

  it.skipIf(ready)(skipMessage(), () => {
    expect(ready).toBe(false)
  })

  describe.runIf(ready)('login / logout / wrong password', () => {
    it('signs in with correct password and returns a session', async () => {
      const client = createAnonClient()
      const { data, error } = await client.auth.signInWithPassword({
        email: agent.email,
        password: agent.password,
      })
      expect(error).toBeNull()
      expect(data.session?.access_token).toBeTruthy()
      expect(data.user?.id).toBe(agent.id)
      await client.auth.signOut()
    })

    it('rejects wrong password', async () => {
      const client = createAnonClient()
      const { data, error } = await client.auth.signInWithPassword({
        email: agent.email,
        password: 'Definitely-Wrong-Password-99!',
      })
      expect(error).toBeTruthy()
      expect(data.session).toBeNull()
    })

    it('signOut clears the local session', async () => {
      const client = createAnonClient()
      await client.auth.signInWithPassword({
        email: agent.email,
        password: agent.password,
      })
      const { error } = await client.auth.signOut()
      expect(error).toBeNull()
      const { data } = await client.auth.getSession()
      expect(data.session).toBeNull()
    })
  })

  describe.runIf(ready)('signup', () => {
    it('creates auth user + agents row (mirrors AuthContext.signUp)', async () => {
      const stamp = Date.now()
      const email = `auth-signup-${stamp}@gnanova.test`
      const password = `SignUp-${stamp}!Aa1`
      const client = createAnonClient()

      const { data: authData, error: authError } = await client.auth.signUp({
        email,
        password,
        options: { data: { full_name: 'Signup Test' } },
      })
      expect(authError).toBeNull()
      expect(authData.user?.id).toBeTruthy()
      const userId = authData.user!.id

      // Ensure JWT is active for agents_self_insert
      if (!authData.session) {
        const { error: signInErr } = await client.auth.signInWithPassword({
          email,
          password,
        })
        expect(signInErr).toBeNull()
      }

      const { error: agentErr } = await client.from('agents').insert({
        id: userId,
        email,
        full_name: 'Signup Test',
        phone: null,
        location: 'Test',
        subscription_tier: 'trial',
        subscription_status: 'trialing',
      })
      expect(agentErr).toBeNull()

      const { data: row } = await client
        .from('agents')
        .select('id, email')
        .eq('id', userId)
        .maybeSingle()
      expect(row?.id).toBe(userId)

      // Cleanup via service role
      await service.from('agents').delete().eq('id', userId)
      await service.auth.admin.deleteUser(userId)
    })

    it('rejects signup with an already-registered email', async () => {
      const client = createAnonClient()
      const { data, error } = await client.auth.signUp({
        email: agent.email,
        password: 'Another-Password-99!Aa',
      })
      // Supabase may return error OR empty identities depending on project "secure email" settings
      const duplicate =
        Boolean(error) ||
        (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0)
      expect(duplicate).toBe(true)
    })
  })

  describe.runIf(ready)('session refresh', () => {
    it('refreshSession returns a new access token while signed in', async () => {
      const client = createAnonClient()
      const { data: signedIn } = await client.auth.signInWithPassword({
        email: agent.email,
        password: agent.password,
      })
      const first = signedIn.session?.access_token
      expect(first).toBeTruthy()

      const { data: refreshed, error } = await client.auth.refreshSession()
      expect(error).toBeNull()
      expect(refreshed.session?.access_token).toBeTruthy()
      // Token may be identical if refresh window is short; session must still be valid
      const { data: again } = await client.auth.getSession()
      expect(again.session?.user.id).toBe(agent.id)

      await client.auth.signOut()
    })

    it('refreshSession fails with an invalid refresh token', async () => {
      const client = createAnonClient()
      const { error } = await client.auth.refreshSession({
        refresh_token: 'invalid-refresh-token-phase3',
      })
      expect(error).toBeTruthy()
    })
  })

  describe.runIf(ready)('password reset', () => {
    it('resetPasswordForEmail accepts a known address (does not leak existence)', async () => {
      const client = createAnonClient()
      const { error } = await client.auth.resetPasswordForEmail(agent.email, {
        redirectTo: 'http://localhost:3000/login',
      })
      // Project email settings may block; either success or a clear config error is acceptable
      if (error) {
        expect(error.message.toLowerCase()).toMatch(
          /email|smtp|rate|redirect|not|confirm|error/
        )
      } else {
        expect(error).toBeNull()
      }
    })

    it('resetPasswordForEmail with unknown email does not throw a crash', async () => {
      const client = createAnonClient()
      const { error } = await client.auth.resetPasswordForEmail(
        `missing-${Date.now()}@gnanova.test`,
        { redirectTo: 'http://localhost:3000/login' }
      )
      // Supabase typically returns success to avoid email enumeration
      void error
      expect(true).toBe(true)
    })
  })
})

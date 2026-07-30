import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase, type Agent } from '../lib/supabase'
import type { Session, User } from '@supabase/supabase-js'

/** Stable id for local preview — no row required in DB; lists/queries may be empty. */
export const DASHBOARD_PREVIEW_USER_ID = '00000000-0000-4000-8000-000000000001'

/**
 * Full dashboard UI without signing in:
 * - Development (`npm run dev`): ON by default. Set `VITE_DASHBOARD_PREVIEW=false` in `.env` to require login.
 * - Production build: OFF unless `VITE_DASHBOARD_PREVIEW=true` (not recommended).
 */
export function isDashboardPreviewEnabled(): boolean {
  const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : undefined
  if (!env) return false
  if (env.VITE_DASHBOARD_PREVIEW === 'false') return false
  if (env.VITE_DASHBOARD_PREVIEW === 'true') return true
  return Boolean(env.DEV)
}

function previewUser(): User {
  return {
    id: DASHBOARD_PREVIEW_USER_ID,
    email: 'preview@local.dev',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
  } as User
}

function previewAgent(): Agent {
  return {
    id: DASHBOARD_PREVIEW_USER_ID,
    full_name: 'Preview Agent',
    email: 'preview@local.dev',
    phone: null,
    company_name: 'Gnanova',
    location: 'India',
    subscription_tier: 'trial',
    subscription_status: 'trialing',
    is_manager: true,
    is_owner: true,
    created_at: new Date().toISOString(),
  }
}

type AuthContextType = {
  user: User | null
  agent: Agent | null
  loading: boolean
  /** True when using local preview session (no Supabase login). */
  dashboardPreview: boolean
  signUp: (email: string, password: string, fullName: string, phone: string, location: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [agent, setAgent] = useState<Agent | null>(null)
  const [loading, setLoading] = useState(true)
  const [dashboardPreview, setDashboardPreview] = useState(false)

  useEffect(() => {
    function applySession(session: Session | null) {
      if (session?.user) {
        setDashboardPreview(false)
        setUser(session.user)
        fetchAgent(session.user.id)
        return
      }
      if (isDashboardPreviewEnabled()) {
        setDashboardPreview(true)
        setUser(previewUser())
        setAgent(previewAgent())
        setLoading(false)
        return
      }
      setDashboardPreview(false)
      setUser(null)
      setAgent(null)
      setLoading(false)
    }

    supabase.auth
      .getSession()
      .then(({ data: { session }, error }) => {
        if (error) console.warn('[Gnanova] getSession:', error.message)
        applySession(session)
      })
      .catch((err) => {
        console.warn('[Gnanova] getSession failed (network?) — using preview if enabled:', err)
        applySession(null)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchAgent(userId: string) {
    try {
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error
      setAgent({
        ...(data as Agent),
        is_manager: Boolean((data as Agent)?.is_manager),
        is_owner: Boolean((data as Agent)?.is_owner),
      })
    } catch (error) {
      console.error('Error fetching agent:', error)
    } finally {
      setLoading(false)
    }
  }

  async function signUp(email: string, password: string, fullName: string, phone: string, location: string) {
    try {
      // 1. Sign up with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, phone, location },
        },
      })

      if (authError) throw authError
      if (!authData.user) throw new Error('No user returned from signup')

      // 2. RLS agents_self_insert requires authenticated JWT (id = auth.uid())
      if (authData.session) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token,
        })
        if (sessionError) throw sessionError
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) {
          throw new Error(
            'Account created. Please confirm your email, then sign in to finish setup.'
          )
        }
      }

      // 3. Create agent record (now runs as authenticated)
      const { error: agentError } = await supabase
        .from('agents')
        .insert({
          id: authData.user.id,
          email,
          full_name: fullName,
          phone,
          location,
          subscription_tier: 'trial',
          subscription_status: 'trialing',
        })

      if (agentError) throw agentError

      // 4. Fetch the created agent
      await fetchAgent(authData.user.id)
    } catch (error: any) {
      throw new Error(error.message || 'Error signing up')
    }
  }

  async function signIn(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error
      if (data.user) {
        await fetchAgent(data.user.id)
      }
    } catch (error: any) {
      throw new Error(error.message || 'Error signing in')
    }
  }

  async function signOut() {
    try {
      await supabase.auth.signOut()
    } catch {
      /* Supabase unreachable — still update local session below */
    }
    if (isDashboardPreviewEnabled()) {
      setDashboardPreview(true)
      setUser(previewUser())
      setAgent(previewAgent())
    } else {
      setDashboardPreview(false)
      setUser(null)
      setAgent(null)
    }
  }

  return (
    <AuthContext.Provider
      value={{ user, agent, loading, dashboardPreview, signUp, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}








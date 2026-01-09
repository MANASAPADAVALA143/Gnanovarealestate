import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase, type Agent } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

type AuthContextType = {
  user: User | null
  agent: Agent | null
  loading: boolean
  signUp: (email: string, password: string, fullName: string, phone: string, location: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [agent, setAgent] = useState<Agent | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchAgent(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchAgent(session.user.id)
      } else {
        setAgent(null)
        setLoading(false)
      }
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
      setAgent(data)
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
      })

      if (authError) throw authError
      if (!authData.user) throw new Error('No user returned from signup')

      // 2. Create agent record
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

      // 3. Fetch the created agent
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
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setUser(null)
    setAgent(null)
  }

  return (
    <AuthContext.Provider value={{ user, agent, loading, signUp, signIn, signOut }}>
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








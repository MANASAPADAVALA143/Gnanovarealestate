'use client'

import { useEffect, useState } from 'react'
import {
  DEFAULT_WORKSPACE_SLUG,
  getWorkspaceConfig,
  isWorkspaceSlug,
  type WorkspaceConfig,
  type WorkspaceSlug,
} from './workspaces'

const STORAGE_KEY = 'gnanova.workspace'

export function getSelectedWorkspaceSlug(): WorkspaceSlug {
  if (typeof window === 'undefined') return DEFAULT_WORKSPACE_SLUG
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return isWorkspaceSlug(stored) ? stored : DEFAULT_WORKSPACE_SLUG
}

export function setSelectedWorkspaceSlug(slug: WorkspaceSlug): void {
  window.localStorage.setItem(STORAGE_KEY, slug)
}

/** Selected workspace config; re-renders after mount so SSR markup matches the default. */
export function useWorkspace(): WorkspaceConfig {
  const [slug, setSlug] = useState<WorkspaceSlug>(DEFAULT_WORKSPACE_SLUG)
  useEffect(() => {
    setSlug(getSelectedWorkspaceSlug())
  }, [])
  return getWorkspaceConfig(slug)
}

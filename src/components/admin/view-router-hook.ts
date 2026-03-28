'use client'

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { resolveViewRoute, type ViewTarget } from './view-router'

/**
 * Hook for programmatic view navigation.
 * The AI agent calls this through the chat interface to navigate views.
 */
export function useViewRouter() {
  const router = useRouter()

  const navigate = useCallback((target: ViewTarget) => {
    const path = resolveViewRoute(target)
    router.push(path)
  }, [router])

  return { navigate, resolveViewRoute }
}

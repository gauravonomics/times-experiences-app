'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { SWRConfig } from 'swr'
import { toast } from 'sonner'
import { TopNav } from '@/components/admin/top-nav'
import { ContextPanel } from '@/components/admin/context-panel'
import { ChatDrawer } from '@/components/admin/chat-drawer'
import { Toaster } from '@/components/ui/sonner'
import { useCurrentView } from '@/hooks/use-current-view'
import { resolveViewRoute, type ViewTarget } from '@/components/admin/view-router'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DRAWER_STORAGE_KEY = 'times-experiences-drawer-open'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AdminLayoutProps {
  children: React.ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter()

  // Drawer toggle — persisted via localStorage
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  // External message to send to chat drawer (from suggestion card clicks)
  const [externalMessage, setExternalMessage] = useState<string | null>(null)

  // Current view detection from URL
  const { currentView, currentViewData } = useCurrentView()

  // Load drawer state from localStorage on mount
  useEffect(() => {
    setMounted(true)
    try {
      const stored = localStorage.getItem(DRAWER_STORAGE_KEY)
      if (stored === 'true') setDrawerOpen(true)
    } catch {
      // localStorage unavailable — use default
    }
  }, [])

  // Persist drawer state
  useEffect(() => {
    if (!mounted) return
    try {
      localStorage.setItem(DRAWER_STORAGE_KEY, String(drawerOpen))
    } catch {
      // localStorage unavailable
    }
  }, [drawerOpen, mounted])

  const toggleDrawer = useCallback(() => setDrawerOpen((prev) => !prev), [])

  // Cmd+K (Mac) / Ctrl+K (Windows) to toggle chat drawer
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        toggleDrawer()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [toggleDrawer])

  // Navigate context panel when agent routes to a view
  const handleViewChange = useCallback(
    (target: ViewTarget) => {
      const path = resolveViewRoute(target)
      router.push(path)
    },
    [router]
  )

  // Handle suggestion card clicks — open drawer and send message
  const handleSuggestionClick = useCallback(
    (action: string) => {
      setExternalMessage(action)
      if (!drawerOpen) setDrawerOpen(true)
    },
    [drawerOpen]
  )

  // Callback for ChatDrawer to signal it has consumed the external message
  const handleExternalMessageConsumed = useCallback(() => {
    setExternalMessage(null)
  }, [])

  // Listen for suggestion click custom events from child pages (e.g. dashboard)
  useSuggestionClickListener(handleSuggestionClick)

  return (
    <SWRConfig value={{ onError: (err: Error) => toast.error(err.message || 'Failed to load data') }}>
      <div className="flex h-screen flex-col">
        <TopNav
          drawerOpen={drawerOpen}
          onToggleDrawer={toggleDrawer}
        />

        <div
          className="grid flex-1 overflow-hidden transition-[grid-template-columns] duration-200"
          style={{
            gridTemplateColumns: mounted && drawerOpen ? 'minmax(500px, 1fr) 400px' : '1fr',
          }}
        >
          <ContextPanel>{children}</ContextPanel>

          {drawerOpen && (
            <ChatDrawer
              onClose={() => setDrawerOpen(false)}
              currentView={currentView}
              currentViewData={currentViewData}
              onViewChange={handleViewChange}
              externalMessage={externalMessage}
              onExternalMessageConsumed={handleExternalMessageConsumed}
            />
          )}
        </div>
        <Toaster />
      </div>
    </SWRConfig>
  )
}

// Re-export for dashboard page use
export { type AdminLayoutProps }
export type { ViewTarget }
export { useCurrentView } from '@/hooks/use-current-view'

// Context for suggestion card clicks — exposed via a custom event
// so dashboard page can trigger it without prop drilling
const SUGGESTION_CLICK_EVENT = 'times-experiences:suggestion-click'

export function dispatchSuggestionClick(action: string) {
  window.dispatchEvent(
    new CustomEvent(SUGGESTION_CLICK_EVENT, { detail: action })
  )
}

export function useSuggestionClickListener(
  handler: (action: string) => void
) {
  useEffect(() => {
    function onEvent(e: Event) {
      const custom = e as CustomEvent<string>
      handler(custom.detail)
    }
    window.addEventListener(SUGGESTION_CLICK_EVENT, onEvent)
    return () => window.removeEventListener(SUGGESTION_CLICK_EVENT, onEvent)
  }, [handler])
}

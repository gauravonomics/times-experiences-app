'use client'

import { useState } from 'react'
import { TopNav } from '@/components/admin/top-nav'
import { ContextPanel } from '@/components/admin/context-panel'
import { ChatDrawer } from '@/components/admin/chat-drawer'

interface AdminLayoutProps {
  children: React.ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="flex h-screen flex-col">
      <TopNav
        drawerOpen={drawerOpen}
        onToggleDrawer={() => setDrawerOpen((prev) => !prev)}
      />

      <div
        className="grid flex-1 overflow-hidden transition-[grid-template-columns] duration-200"
        style={{
          gridTemplateColumns: drawerOpen ? '1fr 400px' : '1fr',
        }}
      >
        <ContextPanel>{children}</ContextPanel>

        {drawerOpen && <ChatDrawer onClose={() => setDrawerOpen(false)} />}
      </div>
    </div>
  )
}

'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

interface ContextPanelProps {
  children: React.ReactNode
}

export function ContextPanel({ children }: ContextPanelProps) {
  const pathname = usePathname()
  const [visible, setVisible] = useState(true)

  // Trigger a fade-in whenever the pathname changes
  useEffect(() => {
    setVisible(false)
    // Use requestAnimationFrame to ensure the opacity:0 frame renders before transitioning to 1
    const raf = requestAnimationFrame(() => {
      setVisible(true)
    })
    return () => cancelAnimationFrame(raf)
  }, [pathname])

  return (
    <main className="flex min-w-0 flex-col overflow-hidden bg-background">
      <div
        className="flex-1 overflow-y-auto p-6 transition-opacity duration-200"
        style={{ opacity: visible ? 1 : 0 }}
      >
        {children}
      </div>
    </main>
  )
}

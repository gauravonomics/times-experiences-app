'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Calendar,
  Plus,
  BarChart3,
  FileText,
  Palette,
  MessageSquare,
  LogOut,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { href: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/events', icon: Calendar, label: 'Events' },
  { href: '/admin/events/new', icon: Plus, label: 'New Event' },
  { href: '/admin/brands', icon: Palette, label: 'Brands' },
  { href: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
  { href: '/admin/templates', icon: FileText, label: 'Templates' },
]

interface TopNavProps {
  drawerOpen: boolean
  onToggleDrawer: () => void
}

export function TopNav({ drawerOpen, onToggleDrawer }: TopNavProps) {
  const pathname = usePathname()
  const router = useRouter()

  function isActive(href: string) {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  async function handleLogout() {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } finally {
      router.push('/login')
      router.refresh()
    }
  }

  return (
    <header className="flex h-14 shrink-0 items-center border-b border-border bg-background px-4">
      <Link href="/admin" className="mr-6 text-lg font-semibold tracking-tight">
        Times Experiences
      </Link>

      <Separator orientation="vertical" className="mr-4 h-6" />

      <nav aria-label="Admin navigation" className="flex items-center gap-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant={active ? 'secondary' : 'ghost'}
                size="sm"
                className="gap-2"
              >
                <Icon className="h-4 w-4" />
                <span className="hidden md:inline">{item.label}</span>
              </Button>
            </Link>
          )
        })}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <Button
          variant={drawerOpen ? 'secondary' : 'ghost'}
          size="sm"
          onClick={onToggleDrawer}
          className="gap-2"
        >
          <MessageSquare className="h-4 w-4" />
          <span className="hidden md:inline">Assistant</span>
        </Button>

        <Separator orientation="vertical" className="h-6" />

        <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2">
          <LogOut className="h-4 w-4" />
          <span className="hidden md:inline">Sign out</span>
        </Button>
      </div>
    </header>
  )
}

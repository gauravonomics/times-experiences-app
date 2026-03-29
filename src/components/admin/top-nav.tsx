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
    <header className="flex h-14 shrink-0 items-center bg-primary px-4">
      <Link href="/admin" className="mr-6 font-heading text-lg font-semibold tracking-tight text-primary-foreground">
        Times Experiences
      </Link>

      <Separator orientation="vertical" className="mr-4 h-6 bg-primary-foreground/20" />

      <nav aria-label="Admin navigation" className="flex items-center gap-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant="ghost"
                size="sm"
                className={`gap-2 ${
                  active
                    ? 'bg-gold/20 text-gold hover:bg-gold/25 hover:text-gold'
                    : 'text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground'
                }`}
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
          variant="ghost"
          size="sm"
          onClick={onToggleDrawer}
          className={`gap-2 ${
            drawerOpen
              ? 'bg-gold/20 text-gold hover:bg-gold/25 hover:text-gold'
              : 'text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground'
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          <span className="hidden md:inline">Assistant</span>
        </Button>

        <Separator orientation="vertical" className="h-6 bg-primary-foreground/20" />

        <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2 text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground">
          <LogOut className="h-4 w-4" />
          <span className="hidden md:inline">Sign out</span>
        </Button>
      </div>
    </header>
  )
}

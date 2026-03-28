'use client'

import { Loader2, Check, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from '@/components/ui/card'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConfirmationCardProps {
  toolName: string
  preview: Record<string, unknown>
  onConfirm: () => void
  onCancel: () => void
  disabled?: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toolNameToTitle(name: string): string {
  return name
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function keyToLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

const INTERNAL_KEYS = new Set(['tool', '__type', '__internal'])
const MAX_STRING_LENGTH = 120

function formatValue(value: unknown): string | null {
  if (value === null || value === undefined) return null

  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return String(value)

  if (typeof value === 'string') {
    if (!value.trim()) return null
    // Try to format dates
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      try {
        const date = new Date(value)
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString('en-IN', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        }
      } catch {
        // Fall through to string truncation
      }
    }
    return value.length > MAX_STRING_LENGTH
      ? value.slice(0, MAX_STRING_LENGTH) + '...'
      : value
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return null
    return value.map((v) => String(v)).join(', ')
  }

  if (typeof value === 'object') {
    return JSON.stringify(value, null, 0).slice(0, MAX_STRING_LENGTH)
  }

  return String(value)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConfirmationCard({
  toolName,
  preview,
  onConfirm,
  onCancel,
  disabled = false,
}: ConfirmationCardProps) {
  const entries = Object.entries(preview)
    .filter(([key]) => !INTERNAL_KEYS.has(key))
    .map(([key, value]) => ({ label: keyToLabel(key), value: formatValue(value) }))
    .filter((e): e is { label: string; value: string } => e.value !== null)

  return (
    <Card role="alertdialog" aria-label={`Confirm: ${toolNameToTitle(toolName)}`} className="border-amber-300 bg-amber-50/50 ring-amber-200/60 dark:border-amber-700 dark:bg-amber-950/30 dark:ring-amber-800/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-amber-900 dark:text-amber-100">
          Confirm: {toolNameToTitle(toolName)}
        </CardTitle>
      </CardHeader>

      {entries.length > 0 && (
        <CardContent className="pb-2">
          <dl className="space-y-1.5">
            {entries.map(({ label, value }) => (
              <div key={label} className="flex gap-2 text-xs">
                <dt className="shrink-0 font-medium text-muted-foreground">
                  {label}:
                </dt>
                <dd className="text-foreground break-words">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      )}

      <CardFooter className="gap-2 border-amber-200 bg-amber-50/80 dark:border-amber-800 dark:bg-amber-950/50">
        <Button
          size="sm"
          onClick={onConfirm}
          disabled={disabled}
          className="h-7 gap-1.5 text-xs"
        >
          {disabled ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Check className="h-3 w-3" />
          )}
          Proceed
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onCancel}
          disabled={disabled}
          className="h-7 gap-1.5 text-xs"
        >
          <XIcon className="h-3 w-3" />
          Cancel
        </Button>
      </CardFooter>
    </Card>
  )
}

'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Sparkles, X, ArrowRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { fetcher } from '@/lib/admin/fetcher'

interface SuggestionCard {
  id: string
  title: string
  description: string
  action: string
}

interface SuggestionsResponse {
  suggestions: SuggestionCard[]
}

interface SuggestionCardsProps {
  onSuggestionClick: (action: string) => void
}

export function SuggestionCards({ onSuggestionClick }: SuggestionCardsProps) {
  const { data, isLoading, error } = useSWR<SuggestionsResponse>(
    '/api/agent/suggestions',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    }
  )

  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  function handleDismiss(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    setDismissed((prev) => new Set(prev).add(id))
  }

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  // Error or no data
  if (error || !data?.suggestions?.length) {
    return (
      <div className="rounded-lg border border-dashed border-border py-8 text-center">
        <Sparkles className="mx-auto h-5 w-5 text-muted-foreground/50" />
        <p className="mt-2 text-sm text-muted-foreground">
          No suggestions right now. Check back after creating events.
        </p>
      </div>
    )
  }

  const visible = data.suggestions.filter((s) => !dismissed.has(s.id))

  if (visible.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border py-8 text-center">
        <p className="text-sm text-muted-foreground">
          All suggestions dismissed. New ones will appear as events progress.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {visible.map((suggestion) => (
        <Card
          key={suggestion.id}
          className="group cursor-pointer transition-colors hover:bg-muted/50"
          onClick={() => onSuggestionClick(suggestion.action)}
        >
          <CardContent className="flex items-start gap-3 pt-0">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-snug">
                {suggestion.title}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {suggestion.description}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              <button
                type="button"
                className="rounded-sm p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                onClick={(e) => handleDismiss(e, suggestion.id)}
                aria-label={`Dismiss suggestion: ${suggestion.title}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

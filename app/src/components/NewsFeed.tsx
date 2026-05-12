"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Sparkles, ExternalLink, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { api } from "@/lib/apiClient"
import type { NewsItem, GeneratedMarket } from "@/lib/apiClient"

function formatRelativeTime(published: string): string {
  try {
    const date = new Date(published)
    const diffH = Math.floor((Date.now() - date.getTime()) / 3_600_000)
    if (diffH < 1) return "just now"
    if (diffH < 24) return `${diffH}h ago`
    return `${Math.floor(diffH / 24)}d ago`
  } catch {
    return ""
  }
}

export function NewsFeed() {
  const router = useRouter()
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [generatingFor, setGeneratingFor] = useState<string | null>(null)
  const [previews, setPreviews] = useState<Record<string, GeneratedMarket>>({})
  const [genErrors, setGenErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    api.news.list().then(({ data, error }) => {
      setLoading(false)
      if (error || !data) {
        setFetchError(error?.message ?? "Failed to load news")
        return
      }
      setNews(data)
    })
  }, [])

  const handleCreateBet = async (item: NewsItem) => {
    setGeneratingFor(item.id)
    setGenErrors((prev) => { const n = { ...prev }; delete n[item.id]; return n })
    const { data, error } = await api.ai.generateMarket(item.title)
    setGeneratingFor(null)
    if (error || !data) {
      setGenErrors((prev) => ({ ...prev, [item.id]: error?.message ?? "Generation failed" }))
      return
    }
    setPreviews((prev) => ({ ...prev, [item.id]: data }))
  }

  const dismissPreview = (id: string) =>
    setPreviews((prev) => { const n = { ...prev }; delete n[id]; return n })

  const handleConfirm = (preview: GeneratedMarket) => {
    const deadline = new Date()
    deadline.setDate(deadline.getDate() + preview.suggested_resolution_days)
    sessionStorage.setItem(
      "newsgen_prefill",
      JSON.stringify({
        question: preview.question_text,
        description: preview.description,
        sideALabel: preview.side_a_label,
        sideBLabel: preview.side_b_label,
        deadline: deadline.toISOString(),
        deadlineTime: "18:00",
      })
    )
    router.push("/create")
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading news...</p>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="rounded-2xl border border-dashed border-border/50 bg-card/30 py-16 text-center">
        <p className="text-muted-foreground">{fetchError}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {news.map((item) => {
        const preview = previews[item.id]
        const isGenerating = generatingFor === item.id
        const genError = genErrors[item.id]

        return (
          <div key={item.id} className="space-y-1">
            <Card className="p-4">
              <div className="mb-3">
                <div className="mb-1.5 flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">{item.source}</Badge>
                  {item.published_at && (
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(item.published_at)}
                    </span>
                  )}
                </div>
                <p className="font-medium leading-snug">{item.title}</p>
                {item.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {item.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 rounded-xl"
                  onClick={() => handleCreateBet(item)}
                  disabled={isGenerating || !!preview}
                >
                  {isGenerating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {isGenerating ? "Generating..." : "Create Bet"}
                </Button>
                <a href={item.url} target="_blank" rel="noopener noreferrer">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 rounded-xl text-muted-foreground"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Read
                  </Button>
                </a>
              </div>
              {genError && <p className="mt-2 text-sm text-destructive">{genError}</p>}
            </Card>

            {preview && (
              <Card className="border-primary/20 bg-primary/5 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-primary">Generated Bet</span>
                  </div>
                  <button
                    onClick={() => dismissPreview(item.id)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="mb-2 font-medium leading-snug">{preview.question_text}</p>
                {preview.description && (
                  <p className="mb-3 text-sm text-muted-foreground">{preview.description}</p>
                )}
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-sm font-medium text-primary">
                    {preview.side_a_label}
                  </span>
                  <span className="rounded-lg bg-destructive/10 px-2.5 py-1 text-sm font-medium text-destructive">
                    {preview.side_b_label}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    Resolves in {preview.suggested_resolution_days}d
                  </span>
                </div>
                <Button
                  size="sm"
                  className="w-full gap-1.5 rounded-xl"
                  onClick={() => handleConfirm(preview)}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Create this bet
                </Button>
              </Card>
            )}
          </div>
        )
      })}
    </div>
  )
}

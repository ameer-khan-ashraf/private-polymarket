"use client"

import { useEffect, useState } from "react"
import { Plus, Clock, CheckCircle2, Lock, Trophy, TrendingUp, Wallet, Loader2, AlertTriangle, Wifi, WifiOff } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { BetCard } from "@/components/bet-card"
import { cn } from "@/lib/utils"
import { useWallet } from "@/lib/wallet-context"
import { supabase } from "@/lib/supabaseClient"
import { mockBets, mockUserBets } from "@/lib/mock-data"
import type { Bet, UserBet, Participant } from "@/lib/mock-data"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { Badge } from "@/components/ui/badge"

type Filter = "all" | "active" | "locked" | "resolved"

export default function HomePage() {
  const [filter, setFilter] = useState<Filter>("all")
  const { isConnected, balance } = useWallet()
  const [bets, setBets] = useState<Bet[]>([])
  const [userBets, setUserBets] = useState<UserBet[]>([])
  const [loading, setLoading] = useState(true)
  const [dbStatus, setDbStatus] = useState<"online" | "offline">("online")

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const { data: markets, error: marketsError } = await supabase
          .from("markets")
          .select("*")
          .order("created_at", { ascending: false })

        if (marketsError) {
          console.error("Supabase Error Details:", {
            code: marketsError.code,
            message: marketsError.message,
            details: marketsError.details,
            hint: marketsError.hint
          })
          throw marketsError
        }

        setDbStatus("online")
        if (!markets || markets.length === 0) {
          setBets(mockBets)
          setUserBets(mockUserBets)
          return
        }

        const mappedBets: Bet[] = (markets || []).map((m) => {
          const now = new Date()
          const deadline = new Date(m.resolution_time)
          let status: "open" | "locked" | "resolved" = "open"
          
          if (m.resolved) {
            status = "resolved"
          } else if (now >= deadline) {
            status = "locked"
          }

          const creator: Participant = {
            id: m.creator_address || "0x000...",
            name: (m.creator_address || "0x000").slice(0, 6) + "..." + (m.creator_address || "0000").slice(-4),
            avatar: "👤",
            walletAddress: m.creator_address || "0x000..."
          }

          return {
            id: m.id,
            question: m.question_text || "No question provided",
            description: m.description || "",
            creator,
            resolver: creator,
            deadline,
            status,
            minStake: m.min_stake || 0.1,
            maxStake: m.max_stake,
            sideA: {
              label: m.side_a_label || "YES",
              totalStake: 0,
              participants: []
            },
            sideB: {
              label: m.side_b_label || "NO",
              totalStake: 0,
              participants: []
            },
            resolvedOutcome: m.resolved ? (m.outcome ? "A" : "B") : undefined,
            inviteCode: m.invite_code || m.id.slice(0, 6).toUpperCase(),
            createdAt: new Date(m.created_at || Date.now())
          }
        })

        setBets(mappedBets)
        setUserBets(mockUserBets)
      } catch (err: any) {
        console.warn("Supabase fetch failed, using mock data fallback.", err?.message || err)
        setDbStatus("offline")
        setBets(mockBets)
        setUserBets(mockUserBets)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const filteredBets = bets.filter((bet) => {
    if (filter === "all") return true
    if (filter === "active") return bet.status === "open"
    if (filter === "locked") return bet.status === "locked"
    if (filter === "resolved") return bet.status === "resolved"
    return true
  })

  const userBetsMap = new Map(userBets.map((ub) => [ub.betId, ub]))

  const activeBetsCount = bets.filter((b) => b.status === "open" || b.status === "locked").length
  const totalStaked = userBets.reduce((sum, ub) => sum + ub.stake, 0)
  const claimable = userBets.filter((ub) => ub.status === "claimable").reduce((sum, ub) => sum + ub.potentialWinnings, 0)
  const wonBets = userBets.filter((ub) => ub.status === "claimable" || ub.status === "won").length

  const filters: { value: Filter; label: string; icon: React.ReactNode; count?: number }[] = [
    { value: "all", label: "All Bets", icon: null, count: bets.length },
    { value: "active", label: "Open", icon: <Clock className="h-3.5 w-3.5" />, count: bets.filter(b => b.status === "open").length },
    { value: "locked", label: "Locked", icon: <Lock className="h-3.5 w-3.5" />, count: bets.filter(b => b.status === "locked").length },
    { value: "resolved", label: "Settled", icon: <CheckCircle2 className="h-3.5 w-3.5" />, count: bets.filter(b => b.status === "resolved").length },
  ]

  if (!isConnected) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <Wallet className="h-10 w-10 text-primary" />
          </div>
          <h1 className="mb-2 text-2xl font-bold">Connect to get started</h1>
          <p className="mb-6 text-muted-foreground">
            Connect your wallet to create and join bets with friends.
          </p>
          <div className="flex justify-center">
            <ConnectButton />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] px-4 py-6 md:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="mb-1 text-2xl font-bold tracking-tight">My Bets</h1>
            <p className="text-sm text-muted-foreground">
              Track your bets and see who owes who
            </p>
          </div>
          <Badge variant="outline" className={cn(
            "gap-1.5 py-1 px-3 rounded-full border-0",
            dbStatus === "online" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          )}>
            {dbStatus === "online" ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {dbStatus === "online" ? "Live" : "Mock Mode"}
          </Badge>
        </div>

        <div className="mb-6 grid grid-cols-4 gap-2">
          <div className="rounded-xl bg-card p-3 border border-border/50">
            <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              Active
            </div>
            <div className="text-xl font-bold">{activeBetsCount}</div>
          </div>
          <div className="rounded-xl bg-card p-3 border border-border/50">
            <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              <Wallet className="h-3 w-3" />
              Staked
            </div>
            <div className="text-xl font-bold font-mono">{totalStaked}</div>
          </div>
          <div className="rounded-xl bg-card p-3 border border-border/50">
            <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              <Trophy className="h-3 w-3" />
              Won
            </div>
            <div className="text-xl font-bold">{wonBets}</div>
          </div>
          {claimable > 0 ? (
            <div className="rounded-xl bg-primary/10 p-3 border border-primary/30">
              <div className="mb-1 text-[10px] uppercase tracking-wider text-primary">
                Claim
              </div>
              <div className="text-xl font-bold text-primary font-mono">{claimable.toFixed(0)}</div>
            </div>
          ) : (
            <div className="rounded-xl bg-card p-3 border border-border/50">
              <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                Balance
              </div>
              <div className="text-xl font-bold font-mono">{balance.toFixed(1)}</div>
            </div>
          )}
        </div>

        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex gap-1 overflow-x-auto rounded-xl bg-secondary/50 p-1">
            {filters.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                  filter === f.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f.icon}
                <span>{f.label}</span>
                {f.count !== undefined && f.count > 0 && (
                  <span className={cn(
                    "ml-0.5 text-xs",
                    filter === f.value ? "text-muted-foreground" : "text-muted-foreground/60"
                  )}>
                    {f.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <Link href="/create">
            <Button size="sm" className="gap-1.5 rounded-xl shrink-0">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Bet</span>
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Loading bets...</p>
          </div>
        ) : filteredBets.length > 0 ? (
          <div className="space-y-4">
            {filteredBets.map((bet) => (
              <BetCard 
                key={bet.id} 
                bet={bet} 
                userBet={userBetsMap.get(bet.id)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 bg-card/30 py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
              <Clock className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="mb-1 font-semibold">No bets here</h3>
            <p className="mb-5 max-w-xs text-sm text-muted-foreground">
              {filter === "all" 
                ? "Create your first bet or join one from a friend." 
                : `You don't have any ${filter} bets.`}
            </p>
            <div className="flex gap-3">
              <Link href="/create">
                <Button className="gap-2 rounded-xl">
                  <Plus className="h-4 w-4" />
                  Create Bet
                </Button>
              </Link>
              <Link href="/join">
                <Button variant="outline" className="rounded-xl">
                  Join with Code
                </Button>
              </Link>
            </div>
          </div>
        )}

        {!loading && filteredBets.length > 0 && (
          <div className="mt-6 flex justify-center">
            <Link href="/join">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                Have an invite code? Join a bet
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

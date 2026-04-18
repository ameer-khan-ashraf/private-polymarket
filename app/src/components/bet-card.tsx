"use client"

import Link from "next/link"
import { Clock, Users, Lock, CheckCircle2, Trophy, Flame } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Bet, UserBet } from "@/lib/mock-data"
import { useCountdown } from "@/hooks/use-countdown"

interface BetCardProps {
  bet: Bet
  userBet?: UserBet
}

function ParticipantStack({ 
  participants, 
  side,
  maxShow = 4 
}: { 
  participants: { avatar: string; name: string }[]
  side: "A" | "B"
  maxShow?: number
}) {
  const overflow = participants.length - maxShow
  
  if (participants.length === 0) {
    return (
      <div className="flex h-8 items-center text-xs text-muted-foreground">
        No one yet
      </div>
    )
  }
  
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex -space-x-1.5">
        {participants.slice(0, maxShow).map((p, i) => (
          <div
            key={i}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full border-2 border-background text-xs font-semibold shadow-sm",
              side === "A" 
                ? "bg-primary/20 text-primary ring-1 ring-primary/30" 
                : "bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/30"
            )}
            title={p.name}
          >
            {p.avatar}
          </div>
        ))}
      </div>
      {overflow > 0 && (
        <span className="text-xs text-muted-foreground">+{overflow}</span>
      )}
    </div>
  )
}

function StatusIndicator({ status, countdown }: { status: Bet["status"]; countdown: { formatted: string; isExpired: boolean } }) {
  if (status === "resolved") {
    return (
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <CheckCircle2 className="h-3.5 w-3.5" />
        <span>Settled</span>
      </div>
    )
  }
  
  if (status === "locked") {
    return (
      <div className="flex items-center gap-1.5 text-xs font-medium text-warning">
        <Lock className="h-3.5 w-3.5" />
        <span>Locked</span>
      </div>
    )
  }
  
  return (
    <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
      <Clock className="h-3.5 w-3.5" />
      <span>{countdown.formatted}</span>
    </div>
  )
}

export function BetCard({ bet, userBet }: BetCardProps) {
  const countdown = useCountdown(bet.deadline)
  const totalParticipants = bet.sideA.participants.length + bet.sideB.participants.length
  const totalPot = bet.sideA.totalStake + bet.sideB.totalStake
  
  const sideAPercent = totalPot > 0 ? (bet.sideA.totalStake / totalPot) * 100 : 50
  const sideBPercent = totalPot > 0 ? (bet.sideB.totalStake / totalPot) * 100 : 50

  const userWon = userBet?.status === "claimable" || userBet?.status === "won"
  const userLost = userBet?.status === "lost"

  return (
    <Link href={`/bet/${bet.id}`} className="block">
      <div className={cn(
        "group relative rounded-2xl border bg-card transition-all duration-200",
        "hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5",
        userWon && "border-primary/50 bg-primary/5",
        userLost && "border-muted opacity-60",
        !userWon && !userLost && "border-border/60"
      )}>
        {/* Win/Loss Ribbon */}
        {userWon && (
          <div className="absolute -right-1 -top-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
            <Trophy className="h-4 w-4" />
          </div>
        )}

        <div className="p-4">
          {/* Header Row */}
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                <span>{totalParticipants} {totalParticipants === 1 ? "person" : "people"}</span>
              </div>
              {totalPot >= 100 && (
                <div className="flex items-center gap-1 text-xs text-orange-400">
                  <Flame className="h-3.5 w-3.5" />
                  <span>High stakes</span>
                </div>
              )}
            </div>
            <StatusIndicator status={bet.status} countdown={countdown} />
          </div>

          {/* Question */}
          <h3 className="mb-4 text-base font-semibold leading-snug tracking-tight text-balance">
            {bet.question}
          </h3>

          {/* Sides Visualization */}
          <div className="mb-3 space-y-3">
            {/* Side A */}
            <div className={cn(
              "relative rounded-xl p-3 transition-colors",
              bet.resolvedOutcome === "A" && "ring-2 ring-primary ring-offset-2 ring-offset-background",
              userBet?.side === "A" && bet.status !== "resolved" && "bg-primary/10",
              userBet?.side !== "A" && "bg-secondary/50"
            )}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn(
                      "inline-flex h-5 items-center rounded px-1.5 text-[10px] font-bold uppercase tracking-wider",
                      userBet?.side === "A" 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-primary/20 text-primary"
                    )}>
                      {userBet?.side === "A" ? "Your pick" : "Side A"}
                    </span>
                    {bet.resolvedOutcome === "A" && (
                      <span className="text-xs font-medium text-primary">Winner</span>
                    )}
                  </div>
                  <p className="text-sm font-medium truncate">{bet.sideA.label}</p>
                </div>
                <ParticipantStack participants={bet.sideA.participants} side="A" />
              </div>
            </div>

            {/* VS Divider */}
            <div className="flex items-center gap-2 px-3">
              <div className="h-px flex-1 bg-border/50" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">vs</span>
              <div className="h-px flex-1 bg-border/50" />
            </div>

            {/* Side B */}
            <div className={cn(
              "relative rounded-xl p-3 transition-colors",
              bet.resolvedOutcome === "B" && "ring-2 ring-orange-500 ring-offset-2 ring-offset-background",
              userBet?.side === "B" && bet.status !== "resolved" && "bg-orange-500/10",
              userBet?.side !== "B" && "bg-secondary/50"
            )}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn(
                      "inline-flex h-5 items-center rounded px-1.5 text-[10px] font-bold uppercase tracking-wider",
                      userBet?.side === "B" 
                        ? "bg-orange-500 text-white" 
                        : "bg-orange-500/20 text-orange-400"
                    )}>
                      {userBet?.side === "B" ? "Your pick" : "Side B"}
                    </span>
                    {bet.resolvedOutcome === "B" && (
                      <span className="text-xs font-medium text-orange-400">Winner</span>
                    )}
                  </div>
                  <p className="text-sm font-medium truncate">{bet.sideB.label}</p>
                </div>
                <ParticipantStack participants={bet.sideB.participants} side="B" />
              </div>
            </div>
          </div>

          {/* Pot Distribution Bar */}
          <div className="mb-3">
            <div className="flex h-2 overflow-hidden rounded-full bg-muted">
              <div 
                className="bg-primary transition-all duration-500" 
                style={{ width: `${sideAPercent}%` }} 
              />
              <div 
                className="bg-orange-500 transition-all duration-500" 
                style={{ width: `${sideBPercent}%` }} 
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <span className="font-mono font-semibold text-foreground">{totalPot} MATIC</span>
              <span className="text-muted-foreground">total pot</span>
            </div>
            {userBet && (
              <div className="text-muted-foreground">
                You bet <span className="font-mono font-medium text-foreground">{userBet.stake}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

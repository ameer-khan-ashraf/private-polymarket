"use client"

import { useState, use, useEffect, useCallback } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Clock, Users, Copy, Check, Share2, Lock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import { useWallet } from "@/lib/wallet-context"
import { useCountdown } from "@/hooks/use-countdown"
import { api } from "@/lib/apiClient"
import { 
  useReadContract, 
  useWriteContract, 
  useWaitForTransactionReceipt,
  useAccount,
  usePublicClient
} from "wagmi"
import { formatEther, parseEther, parseGwei } from "viem"
import PrivateMarketABI from "@/lib/abi/PrivateMarket.json"
import type { Bet, UserBet, Participant } from "@/lib/mock-data"

function ParticipantRow({ participant, stake, isYou }: { participant: { name: string; avatar: string }; stake?: number; isYou?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-sm font-medium">
          {participant.avatar}
        </div>
        <div>
          <span className="font-medium">{participant.name}</span>
          {isYou && <Badge variant="outline" className="ml-2 text-xs">You</Badge>}
        </div>
      </div>
      {stake && (
        <span className="font-mono text-sm text-muted-foreground">{stake} MATIC</span>
      )}
    </div>
  )
}

export default function BetDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const { isConnected, balance, address } = useWallet()
  
  const [betData, setBetData] = useState<Bet | null>(null)
  const [loadingMetadata, setLoadingMetadata] = useState(true)
  const [selectedSide, setSelectedSide] = useState<"A" | "B" | null>(null)
  const [stakeAmount, setStakeAmount] = useState(0.1)
  const [copied, setCopied] = useState(false)
  const [status, setStatus] = useState("")
  
  const contractAddress = process.env.NEXT_PUBLIC_MARKET_CONTRACT_ADDRESS as `0x${string}`
  const maxPriorityFeePerGas = parseGwei("30")
  const maxFeePerGas = parseGwei("60")

  // 1. Fetch Metadata from Supabase
  useEffect(() => {
    async function fetchMarket() {
      if (!id) return
      try {
        const { data, error } = await api.markets.get(id)

        if (error) throw new Error(error.message)
        
        const creator: Participant = {
          id: data.creator_address || "0x000...",
          name: (data.creator_address || "0x000").slice(0, 6) + "..." + (data.creator_address || "0000").slice(-4),
          avatar: "👤",
          walletAddress: data.creator_address || "0x000..."
        }

        setBetData({
          id: data.id,
          question: data.question_text || "No question provided",
          description: data.description || "",
          creator,
          resolver: creator,
          deadline: new Date(data.resolution_time),
          status: data.resolved ? "resolved" : (new Date() >= new Date(data.resolution_time) ? "locked" : "open"),
          minStake: data.min_stake || 0.01,
          maxStake: data.max_stake || 100,
          sideA: { label: data.side_a_label || "YES", totalStake: 0, participants: [] },
          sideB: { label: data.side_b_label || "NO", totalStake: 0, participants: [] },
          resolvedOutcome: data.resolved ? (data.outcome ? "A" : "B") : undefined,
          inviteCode: data.invite_code || data.id.slice(0, 6).toUpperCase(),
          chain_market_id: data.chain_market_id,
          createdAt: new Date(data.created_at || Date.now())
        } as any)
      } catch (err) {
        console.error("Error fetching market metadata:", err)
      } finally {
        setLoadingMetadata(false)
      }
    }
    fetchMarket()
  }, [id])

  const chainMarketId = betData?.chain_market_id

  // 2. Fetch Contract Data
  const { data: contractMarket, refetch: refetchContractData } = useReadContract({
    address: contractAddress,
    abi: PrivateMarketABI,
    functionName: "getMarket",
    args: chainMarketId !== undefined ? [BigInt(chainMarketId)] : undefined,
    query: { enabled: chainMarketId !== undefined && Number(chainMarketId) >= 0 }
  })

  const { data: contractUserBet, refetch: refetchUserBet } = useReadContract({
    address: contractAddress,
    abi: PrivateMarketABI,
    functionName: "getUserBet",
    args: chainMarketId !== undefined && address ? [BigInt(chainMarketId), address as `0x${string}`] : undefined,
    query: { enabled: chainMarketId !== undefined && !!address && Number(chainMarketId) >= 0 }
  })

  const { data: payoutData, refetch: refetchPayout } = useReadContract({
    address: contractAddress,
    abi: PrivateMarketABI,
    functionName: "calculatePayout",
    args: chainMarketId !== undefined && address ? [BigInt(chainMarketId), address as `0x${string}`] : undefined,
    query: { enabled: chainMarketId !== undefined && !!address && Number(chainMarketId) >= 0 }
  })

  // 3. Write Contract Actions
  const { writeContract, data: hash, isPending: isWritePending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })

  useEffect(() => {
    if (isConfirmed) {
      refetchContractData()
      refetchUserBet()
      refetchPayout()
      setStatus("Success! Action confirmed.")
    }
  }, [isConfirmed, refetchContractData, refetchUserBet, refetchPayout])

  const handlePlaceBet = () => {
    if (!betData || !selectedSide || !isConnected) return
    setStatus("Confirming transaction...")
    writeContract({
      address: contractAddress,
      abi: PrivateMarketABI,
      functionName: "placeBet",
      args: [BigInt(chainMarketId), selectedSide === "A"],
      value: parseEther(stakeAmount.toString()),
      maxPriorityFeePerGas,
      maxFeePerGas,
    })
  }

  const handleClaim = () => {
    if (!betData || !isConnected) return
    setStatus("Claiming winnings...")
    writeContract({
      address: contractAddress,
      abi: PrivateMarketABI,
      functionName: "claimWinnings",
      args: [BigInt(chainMarketId)],
      maxPriorityFeePerGas,
      maxFeePerGas,
    })
  }

  const handleResolve = (outcome: boolean) => {
    if (!betData || !isConnected) return
    setStatus("Resolving market...")
    writeContract({
      address: contractAddress,
      abi: PrivateMarketABI,
      functionName: "resolveMarket",
      args: [BigInt(chainMarketId), outcome],
      maxPriorityFeePerGas,
      maxFeePerGas,
    }, {
      onSuccess: async () => {
        await api.markets.update(id, { resolved: true, outcome })
      }
    })
  }

  const countdown = useCountdown(betData?.deadline || new Date())

  if (loadingMetadata) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!betData) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold">Bet not found</h1>
          <Link href="/" className="mt-4 text-primary hover:underline">Go back home</Link>
        </div>
      </div>
    )
  }

  // Contract derived state
  const yesPool = contractMarket ? BigInt((contractMarket as any).totalYesBets) : BigInt(0)
  const noPool = contractMarket ? BigInt((contractMarket as any).totalNoBets) : BigInt(0)
  const totalPot = yesPool + noPool
  
  const userBetAmount = contractUserBet ? BigInt((contractUserBet as any).amount) : BigInt(0)
  const userBetSide = contractUserBet ? ((contractUserBet as any).isYes ? "A" : "B") : null
  const userBetClaimed = contractUserBet ? (contractUserBet as any).claimed : false
  const potentialPayout = payoutData ? BigInt(payoutData as any) : BigInt(0)

  const isCreator = address && betData.creator.id.toLowerCase() === address.toLowerCase()
  const hasJoined = userBetAmount > BigInt(0)
  const betResolved = betData.status === "resolved" || (contractMarket as any)?.resolved
  const canJoin = !betResolved && !hasJoined && isConnected && (new Date() < betData.deadline)

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(`${window.location.origin}/join?code=${betData.inviteCode}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] px-4 py-6 md:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to bets
        </Link>

        <div className="mb-4 flex items-center justify-between">
          <Badge
            variant="outline"
            className={cn(
              "gap-1.5 rounded-lg border-0 px-3 py-1 text-sm",
              !betResolved && "bg-primary/10 text-primary",
              betResolved && "bg-muted text-muted-foreground"
            )}
          >
            {betResolved ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
            {betResolved ? "Resolved" : "Open for bets"}
          </Badge>
          {!betResolved && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{countdown.formatted}</span>
            </div>
          )}
        </div>

        <h1 className="mb-2 text-2xl font-semibold leading-tight text-balance">{betData.question}</h1>
        {betData.description && (
          <p className="mb-6 text-muted-foreground">{betData.description}</p>
        )}

        <Card className="mb-6 flex items-center justify-between gap-4 border-dashed bg-card/50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Share2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-sm font-medium">Invite friends</div>
              <div className="font-mono text-xs text-muted-foreground">{betData.inviteCode}</div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleCopyInvite} className="gap-2 rounded-xl">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy Link"}
          </Button>
        </Card>

        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <Card
            className={cn(
              "cursor-pointer border-2 p-4 transition-all",
              selectedSide === "A" ? "border-primary bg-primary/5" : "border-transparent hover:border-border",
              betData.resolvedOutcome === "A" && "border-primary bg-primary/10",
              (!canJoin) && "cursor-default"
            )}
            onClick={() => canJoin && setSelectedSide("A")}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="font-semibold text-primary">{betData.sideA.label}</span>
              {betData.resolvedOutcome === "A" && <Badge className="bg-primary text-primary-foreground">Winner</Badge>}
            </div>
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total staked</span>
              <span className="font-mono font-medium">{formatEther(yesPool)} MATIC</span>
            </div>
          </Card>

          <Card
            className={cn(
              "cursor-pointer border-2 p-4 transition-all",
              selectedSide === "B" ? "border-destructive bg-destructive/5" : "border-transparent hover:border-border",
              betData.resolvedOutcome === "B" && "border-destructive bg-destructive/10",
              (!canJoin) && "cursor-default"
            )}
            onClick={() => canJoin && setSelectedSide("B")}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="font-semibold text-destructive">{betData.sideB.label}</span>
              {betData.resolvedOutcome === "B" && <Badge className="bg-destructive text-destructive-foreground">Winner</Badge>}
            </div>
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total staked</span>
              <span className="font-mono font-medium">{formatEther(noPool)} MATIC</span>
            </div>
          </Card>
        </div>

        {canJoin && selectedSide && (
          <Card className="mb-6 p-5">
            <h3 className="mb-4 font-semibold">Place your bet</h3>
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Stake amount</span>
                <span className="font-mono">{stakeAmount} MATIC</span>
              </div>
              <Slider
                value={[stakeAmount]}
                onValueChange={([v]) => setStakeAmount(v)}
                min={0.01}
                max={Math.min(balance, 100)}
                step={0.01}
                className="mb-2"
              />
            </div>
            <Button 
              className="w-full gap-2 rounded-xl" 
              size="lg"
              onClick={handlePlaceBet}
              disabled={isWritePending || isConfirming || stakeAmount > balance}
            >
              {isWritePending || isConfirming ? "Confirming..." : `Join for ${stakeAmount} MATIC`}
            </Button>
          </Card>
        )}

        {hasJoined && !betResolved && (
          <Card className="mb-6 border-primary/20 bg-primary/5 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Check className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">You&apos;re in!</h3>
                <p className="text-sm text-muted-foreground">
                  You bet <span className="font-mono font-medium">{formatEther(userBetAmount)} MATIC</span> on{" "}
                  <span className={userBetSide === "A" ? "text-primary" : "text-destructive"}>
                    {userBetSide === "A" ? betData.sideA.label : betData.sideB.label}
                  </span>
                </p>
              </div>
            </div>
          </Card>
        )}

        {hasJoined && betResolved && potentialPayout > BigInt(0) && !userBetClaimed && (
          <Card className="mb-6 border-primary/30 bg-primary/10 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-primary">You won!</h3>
                <p className="text-sm text-muted-foreground">
                  Claim your winnings of{" "}
                  <span className="font-mono font-medium text-primary">{formatEther(potentialPayout)} MATIC</span>
                </p>
              </div>
              <Button onClick={handleClaim} disabled={isWritePending || isConfirming} className="rounded-xl">
                {isWritePending || isConfirming ? "Processing..." : "Claim"}
              </Button>
            </div>
          </Card>
        )}

        {isCreator && !betResolved && (new Date() >= betData.deadline) && (
          <Card className="mb-6 border-warning/20 bg-warning/5 p-5">
            <div className="mb-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-warning" />
              <div>
                <h3 className="font-semibold">You are the resolver</h3>
                <p className="text-sm text-muted-foreground">Choose the winning side.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => handleResolve(true)} disabled={isWritePending || isConfirming} variant="outline" className="flex-1 rounded-xl border-primary text-primary hover:bg-primary/10">
                {betData.sideA.label} Wins
              </Button>
              <Button onClick={() => handleResolve(false)} disabled={isWritePending || isConfirming} variant="outline" className="flex-1 rounded-xl border-destructive text-destructive hover:bg-destructive/10">
                {betData.sideB.label} Wins
              </Button>
            </div>
          </Card>
        )}

        <div className="rounded-2xl bg-card p-5 border border-border/50">
          <h3 className="mb-4 font-semibold">Pot Summary</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total pot</span>
              <span className="font-mono font-semibold">{formatEther(totalPot)} MATIC</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Created by</span>
              <span className="font-medium">{betData.creator.name}</span>
            </div>
          </div>
        </div>

        {status && <p className="mt-4 text-center text-sm text-muted-foreground">{status}</p>}
      </div>
    </div>
  )
}

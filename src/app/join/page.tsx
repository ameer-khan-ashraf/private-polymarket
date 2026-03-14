"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Link2, Search, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { supabase } from "@/lib/supabaseClient"

function JoinContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [code, setCode] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const codeParam = searchParams.get("code")
    if (codeParam) {
      setCode(codeParam)
      handleJoin(codeParam)
    }
  }, [searchParams])

  const handleJoin = async (searchCode: string) => {
    const targetCode = searchCode || code
    if (!targetCode) return

    setIsSearching(true)
    setError("")

    try {
      const { data, error: fetchError } = await supabase
        .from("markets")
        .select("id")
        .eq("invite_code", targetCode.toUpperCase())
        .single()

      if (fetchError || !data) {
        throw new Error("Invalid invite code. Please check and try again.")
      }

      router.push(`/bet/${data.id}`)
    } catch (err: any) {
      setError(err.message)
      setIsSearching(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <div className="mb-8">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Link2 className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold">Join a Bet</h1>
        </div>
        <p className="text-muted-foreground">Enter the invite code from your friend.</p>
      </div>

      <Card className="p-6">
        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium">Invite Code</label>
          <div className="relative">
            <Input
              placeholder="e.g., XJ92LK"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="h-12 rounded-xl bg-input pl-10 font-mono text-lg tracking-widest"
              onKeyDown={(e) => e.key === "Enter" && handleJoin(code)}
            />
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          </div>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </div>

        <Button 
          className="w-full h-12 rounded-xl text-base font-semibold" 
          onClick={() => handleJoin(code)}
          disabled={isSearching || !code}
        >
          {isSearching ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Finding Bet...
            </>
          ) : (
            "Join Bet"
          )}
        </Button>
      </Card>
    </div>
  )
}

export default function JoinBetPage() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] px-4 py-12 md:px-6 lg:px-8">
      <Suspense fallback={
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }>
        <JoinContent />
      </Suspense>
    </div>
  )
}

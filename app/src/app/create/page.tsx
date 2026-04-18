"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Wallet, Sparkles, CheckCircle2, Copy, Check, CalendarIcon, HelpCircle } from "lucide-react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useWallet } from "@/lib/wallet-context"
import { useCreateMarket } from "@/hooks/useCreateMarket"
import { cn } from "@/lib/utils"

interface FormData {
  question: string
  description: string
  sideALabel: string
  sideBLabel: string
  deadline: Date | undefined
  deadlineTime: string
  minStake: number
  maxStake: number
  resolverType: "creator" | "custom"
  resolverAddress: string
}

interface FormErrors {
  question?: string
  sideALabel?: string
  sideBLabel?: string
  deadline?: string
}

export default function CreateBetPage() {
  const router = useRouter()
  const { isConnected, connect } = useWallet()
  const [step, setStep] = useState(1)
  const { createMarket, isLoading: isSubmitting, status: createStatus, error: createError } = useCreateMarket()
  const [createdBetCode, setCreatedBetCode] = useState("")
  const [createdBetId, setCreatedBetId] = useState("")
  const [copied, setCopied] = useState(false)
  
  const [formData, setFormData] = useState<FormData>({
    question: "",
    description: "",
    sideALabel: "Yes",
    sideBLabel: "No",
    deadline: undefined,
    deadlineTime: "18:00",
    minStake: 0.1,
    maxStake: 10,
    resolverType: "creator",
    resolverAddress: "",
  })
  const [errors, setErrors] = useState<FormErrors>({})

  const validateStep1 = (): boolean => {
    const newErrors: FormErrors = {}
    if (!formData.question.trim()) newErrors.question = "What are you betting on?"
    if (!formData.sideALabel.trim()) newErrors.sideALabel = "Required"
    if (!formData.sideBLabel.trim()) newErrors.sideBLabel = "Required"
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const validateStep2 = (): boolean => {
    const newErrors: FormErrors = {}
    if (!formData.deadline) {
      newErrors.deadline = "Pick a deadline"
    } else {
      const [h, m] = formData.deadlineTime.split(":").map(Number)
      const selectedDate = new Date(formData.deadline)
      selectedDate.setHours(h, m, 0, 0)
      if (selectedDate <= new Date()) {
        newErrors.deadline = "Deadline must be in the future"
      }
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = async () => {
    if (step === 1 && validateStep1()) {
      setStep(2)
    } else if (step === 2 && validateStep2()) {
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase()
      const [h, m] = formData.deadlineTime.split(":").map(Number)
      const resDate = new Date(formData.deadline!)
      resDate.setHours(h, m, 0, 0)

      const result = await createMarket({
        question: formData.question,
        description: formData.description,
        sideALabel: formData.sideALabel,
        sideBLabel: formData.sideBLabel,
        resolutionDate: resDate.toISOString(),
        minStake: formData.minStake,
        maxStake: formData.maxStake,
        inviteCode
      })

      if (result.success) {
        setCreatedBetCode(inviteCode)
        setCreatedBetId(result.supabaseId!)
        setStep(3)
      }
    }
  }

  const handleChange = (field: keyof FormData, value: string | number | Date | undefined) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(`${window.location.origin}/join?code=${createdBetCode}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!isConnected) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <Wallet className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="mb-2 text-xl font-semibold">Connect Your Wallet</h1>
          <p className="mb-6 text-muted-foreground">Connect to create a bet with friends.</p>
          <Button onClick={connect} size="lg" className="gap-2 rounded-xl">
            <Wallet className="h-4 w-4" />
            Connect Wallet
          </Button>
        </div>
      </div>
    )
  }

  if (step === 3) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <CheckCircle2 className="h-8 w-8 text-primary" />
          </div>
          <h1 className="mb-2 text-2xl font-semibold">Bet Created!</h1>
          <p className="mb-6 text-muted-foreground">Share this invite code with your friends.</p>
          <Card className="mb-6 p-6">
            <div className="mb-4 font-mono text-3xl font-bold tracking-widest">{createdBetCode}</div>
            <Button onClick={handleCopyInvite} variant="outline" className="w-full gap-2 rounded-xl">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied!" : "Copy Invite Link"}
            </Button>
          </Card>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => router.push("/")}>View My Bets</Button>
            <Button className="flex-1 rounded-xl" onClick={() => router.push(`/bet/${createdBetId}`)}>View This Bet</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="min-h-[calc(100vh-3.5rem)] px-4 py-6 md:px-6 lg:px-8">
        <div className="mx-auto max-w-lg">
          <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <div className="mb-8">
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <h1 className="text-2xl font-semibold">New Bet</h1>
            </div>
            <p className="text-muted-foreground">Create a bet and invite friends to pick their side.</p>
          </div>
          <div className="mb-8 flex gap-2">
            <div className={cn("h-1 flex-1 rounded-full", step >= 1 ? "bg-primary" : "bg-muted")} />
            <div className={cn("h-1 flex-1 rounded-full", step >= 2 ? "bg-primary" : "bg-muted")} />
          </div>

          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="mb-2 block text-sm font-medium">What are you betting on?</label>
                <Textarea
                  placeholder="e.g., Will Mike show up on time to the wedding?"
                  value={formData.question}
                  onChange={(e) => handleChange("question", e.target.value)}
                  className={cn("min-h-[100px] rounded-xl bg-input", errors.question && "border-destructive")}
                />
                {errors.question && <p className="mt-1 text-sm text-destructive">{errors.question}</p>}
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Additional context (optional)</label>
                <Textarea
                  placeholder="Any extra details or rules for the bet..."
                  value={formData.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  className="min-h-[80px] rounded-xl bg-input"
                />
              </div>
              <div>
                <label className="mb-3 block text-sm font-medium">The two sides</label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="mb-1 text-xs text-primary font-medium">Side A</div>
                    <Input placeholder="e.g., Yes" value={formData.sideALabel} onChange={(e) => handleChange("sideALabel", e.target.value)} className="rounded-xl bg-input" />
                  </div>
                  <div>
                    <div className="mb-1 text-xs text-destructive font-medium">Side B</div>
                    <Input placeholder="e.g., No" value={formData.sideBLabel} onChange={(e) => handleChange("sideBLabel", e.target.value)} className="rounded-xl bg-input" />
                  </div>
                </div>
              </div>
              <Button onClick={handleNext} className="w-full rounded-xl" size="lg">Continue</Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <CalendarIcon className="h-4 w-4" />Deadline
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start rounded-xl bg-input font-normal",
                          !formData.deadline && "text-muted-foreground",
                          errors.deadline && "border-destructive"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.deadline ? format(formData.deadline, "dd/MM/yyyy") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.deadline}
                        onSelect={(date) => handleChange("deadline", date as any)}
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <Input
                    type="time"
                    value={formData.deadlineTime}
                    onChange={(e) => handleChange("deadlineTime", e.target.value)}
                    className="rounded-xl bg-input"
                  />
                </div>
                {errors.deadline && <p className="mt-1 text-sm text-destructive">{errors.deadline}</p>}
              </div>
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-medium">Stake range</label>
                <Card className="p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Min: {formData.minStake} MATIC</span>
                    <span className="text-sm text-muted-foreground">Max: {formData.maxStake} MATIC</span>
                  </div>
                  <Slider value={[formData.minStake]} onValueChange={([v]) => handleChange("minStake", v)} min={0.01} max={formData.maxStake - 0.1} step={0.01} />
                  <Slider value={[formData.maxStake]} onValueChange={([v]) => handleChange("maxStake", v)} min={formData.minStake + 0.1} max={100} step={1} className="mt-4" />
                </Card>
              </div>
              <Button onClick={handleNext} disabled={isSubmitting} className="w-full rounded-xl" size="lg">
                {isSubmitting ? createStatus || "Creating..." : "Create Bet"}
              </Button>
              {createError && <p className="text-center text-sm text-destructive">{createError}</p>}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}

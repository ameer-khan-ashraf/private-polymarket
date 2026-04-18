export interface Participant {
  id: string
  name: string
  avatar: string
  walletAddress: string
}

export interface Bet {
  id: string
  question: string
  description?: string
  status: "open" | "locked" | "resolved"
  createdAt: Date
  deadline: Date
  creator: Participant
  resolver: Participant
  sideA: {
    label: string
    participants: Participant[]
    totalStake: number
  }
  sideB: {
    label: string
    participants: Participant[]
    totalStake: number
  }
  minStake: number
  maxStake?: number
  inviteCode: string
  resolvedOutcome?: "A" | "B"
  chain_market_id?: number
}

export interface UserBet {
  betId: string
  side: "A" | "B"
  stake: number
  potentialWinnings: number
  status: "active" | "won" | "lost" | "claimable"
}

// Mock participants (friends)
export const mockParticipants: Participant[] = [
  { id: "u1", name: "You", avatar: "Y", walletAddress: "0x1234...5678" },
  { id: "u2", name: "Alex", avatar: "A", walletAddress: "0xabcd...efgh" },
  { id: "u3", name: "Jordan", avatar: "J", walletAddress: "0x9876...5432" },
  { id: "u4", name: "Sam", avatar: "S", walletAddress: "0xface...b00k" },
  { id: "u5", name: "Casey", avatar: "C", walletAddress: "0xdead...beef" },
  { id: "u6", name: "Riley", avatar: "R", walletAddress: "0xcafe...babe" },
  { id: "u7", name: "Morgan", avatar: "M", walletAddress: "0xc0de...face" },
  { id: "u8", name: "Taylor", avatar: "T", walletAddress: "0xb0b...a1ice" },
]

export const currentUser = mockParticipants[0]

export const mockBets: Bet[] = [
  {
    id: "bet1",
    question: "Will Mike actually show up on time to the wedding?",
    description: "Mike has a 100% track record of being at least 30 mins late to every event.",
    status: "open",
    createdAt: new Date("2026-03-01"),
    deadline: new Date("2026-04-15"),
    creator: mockParticipants[1],
    resolver: mockParticipants[2],
    sideA: {
      label: "Yes, he'll be on time",
      participants: [mockParticipants[0], mockParticipants[3]],
      totalStake: 50,
    },
    sideB: {
      label: "No way, he'll be late",
      participants: [mockParticipants[1], mockParticipants[2], mockParticipants[4]],
      totalStake: 75,
    },
    minStake: 10,
    maxStake: 50,
    inviteCode: "MIKE2026",
  },
  {
    id: "bet2",
    question: "Will Sarah pass her driving test on the first attempt?",
    status: "locked",
    createdAt: new Date("2026-02-15"),
    deadline: new Date("2026-03-20"),
    creator: mockParticipants[3],
    resolver: mockParticipants[3],
    sideA: {
      label: "She'll pass",
      participants: [mockParticipants[0], mockParticipants[5]],
      totalStake: 40,
    },
    sideB: {
      label: "She'll need another try",
      participants: [mockParticipants[3], mockParticipants[6]],
      totalStake: 40,
    },
    minStake: 20,
    inviteCode: "SARAH-DL",
  },
  {
    id: "bet3",
    question: "Who will win our fantasy football league this season?",
    description: "Final standings to be determined by Dec 31st.",
    status: "open",
    createdAt: new Date("2026-01-10"),
    deadline: new Date("2026-12-31"),
    creator: mockParticipants[0],
    resolver: mockParticipants[0],
    sideA: {
      label: "Team Alpha wins",
      participants: [mockParticipants[1], mockParticipants[2]],
      totalStake: 60,
    },
    sideB: {
      label: "Team Beta wins",
      participants: [mockParticipants[0], mockParticipants[4], mockParticipants[5]],
      totalStake: 90,
    },
    minStake: 30,
    maxStake: 100,
    inviteCode: "FF-2026",
  },
  {
    id: "bet4",
    question: "Will Jake actually finish his marathon under 4 hours?",
    status: "resolved",
    createdAt: new Date("2025-12-01"),
    deadline: new Date("2026-02-15"),
    creator: mockParticipants[4],
    resolver: mockParticipants[4],
    sideA: {
      label: "Under 4 hours",
      participants: [mockParticipants[4]],
      totalStake: 25,
    },
    sideB: {
      label: "4 hours or more",
      participants: [mockParticipants[0], mockParticipants[1], mockParticipants[2]],
      totalStake: 75,
    },
    minStake: 25,
    inviteCode: "JAKE-RUN",
    resolvedOutcome: "B",
  },
  {
    id: "bet5",
    question: "Will it rain on our camping trip next weekend?",
    status: "open",
    createdAt: new Date("2026-03-10"),
    deadline: new Date("2026-03-21"),
    creator: mockParticipants[5],
    resolver: mockParticipants[5],
    sideA: {
      label: "It will rain",
      participants: [mockParticipants[5]],
      totalStake: 15,
    },
    sideB: {
      label: "Clear skies",
      participants: [mockParticipants[6], mockParticipants[7]],
      totalStake: 30,
    },
    minStake: 15,
    maxStake: 30,
    inviteCode: "CAMP-WX",
  },
]

export const mockUserBets: UserBet[] = [
  {
    betId: "bet1",
    side: "A",
    stake: 25,
    potentialWinnings: 62.5,
    status: "active",
  },
  {
    betId: "bet2",
    side: "A",
    stake: 20,
    potentialWinnings: 40,
    status: "active",
  },
  {
    betId: "bet3",
    side: "B",
    stake: 30,
    potentialWinnings: 50,
    status: "active",
  },
  {
    betId: "bet4",
    side: "B",
    stake: 25,
    potentialWinnings: 33.33,
    status: "claimable",
  },
]

export function calculatePotentialWinnings(
  stake: number,
  side: "A" | "B",
  sideATotal: number,
  sideBTotal: number
): number {
  const yourSideTotal = side === "A" ? sideATotal : sideBTotal
  const otherSideTotal = side === "A" ? sideBTotal : sideATotal
  
  // Your share of winnings from the losing pot
  const totalPot = yourSideTotal + otherSideTotal + stake
  const yourShare = stake / (yourSideTotal + stake)
  const winnings = yourShare * totalPot
  
  return Math.round(winnings * 100) / 100
}

export function getImpliedOdds(sideATotal: number, sideBTotal: number): { sideA: number; sideB: number } {
  const total = sideATotal + sideBTotal
  if (total === 0) return { sideA: 50, sideB: 50 }
  
  return {
    sideA: Math.round((sideBTotal / total) * 100),
    sideB: Math.round((sideATotal / total) * 100),
  }
}

export function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

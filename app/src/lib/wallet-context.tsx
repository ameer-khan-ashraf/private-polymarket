"use client"

import { createContext, useContext, type ReactNode } from "react"
import { useAccount, useBalance, useConnect, useDisconnect } from "wagmi"
import { formatEther } from "viem"

interface WalletState {
  isConnected: boolean
  address: string | null
  balance: number
  connect: () => void
  disconnect: () => void
}

const WalletContext = createContext<WalletState | undefined>(undefined)

export function WalletProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount()
  const { data: balanceData } = useBalance({ address })
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()

  const handleConnect = () => {
    // Just connect to the first available connector (usually injected/metamask)
    if (connectors.length > 0) {
      connect({ connector: connectors[0] })
    }
  }

  const balance = balanceData ? parseFloat(formatEther(balanceData.value)) : 0

  return (
    <WalletContext.Provider 
      value={{ 
        isConnected, 
        address: address || null, 
        balance, 
        connect: handleConnect, 
        disconnect 
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const context = useContext(WalletContext)
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider")
  }
  return context
}

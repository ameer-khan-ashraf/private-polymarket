"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Users, LayoutGrid, PlusCircle, Link2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ConnectButton } from "@rainbow-me/rainbowkit"

const navItems = [
  { href: "/", label: "My Bets", icon: LayoutGrid },
  { href: "/join", label: "Join Bet", icon: Link2 },
  { href: "/create", label: "New Bet", icon: PlusCircle },
]

export function Header() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-xl">
      <div className="flex h-14 items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
            <Users className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-lg tracking-tight">Sidebets</span>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || 
              (item.href !== "/" && pathname.startsWith(item.href))
            
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "gap-2 rounded-xl",
                    isActive && "bg-primary/10 text-primary"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Button>
              </Link>
            )
          })}
        </nav>

        {/* Wallet */}
        <div className="flex items-center gap-2">
          <ConnectButton 
            accountStatus="avatar" 
            chainStatus="icon" 
            showBalance={false}
          />
        </div>
      </div>
    </header>
  )
}

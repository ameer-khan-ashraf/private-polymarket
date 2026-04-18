"use client"

import { useState, useEffect } from "react"

interface CountdownResult {
  days: number
  hours: number
  minutes: number
  seconds: number
  isExpired: boolean
  formatted: string
}

export function useCountdown(targetDate: Date): CountdownResult {
  const [timeLeft, setTimeLeft] = useState<CountdownResult>(calculateTimeLeft(targetDate))

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(targetDate))
    }, 1000)

    return () => clearInterval(timer)
  }, [targetDate])

  return timeLeft
}

function calculateTimeLeft(targetDate: Date): CountdownResult {
  const now = new Date().getTime()
  const target = targetDate.getTime()
  const difference = target - now

  if (difference <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isExpired: true,
      formatted: "Expired",
    }
  }

  const days = Math.floor(difference / (1000 * 60 * 60 * 24))
  const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((difference % (1000 * 60)) / 1000)

  let formatted: string
  if (days > 0) {
    formatted = `${days}d ${hours}h`
  } else if (hours > 0) {
    formatted = `${hours}h ${minutes}m`
  } else if (minutes > 0) {
    formatted = `${minutes}m ${seconds}s`
  } else {
    formatted = `${seconds}s`
  }

  return {
    days,
    hours,
    minutes,
    seconds,
    isExpired: false,
    formatted,
  }
}

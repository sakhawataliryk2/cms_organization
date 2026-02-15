'use client'

import { useState, useEffect } from 'react'

interface CountdownTimerProps {
  archivedAt: string | null
  deletionPeriodDays?: number
  className?: string
}

/**
 * Safely parses various backend date formats
 */
function parseFlexibleDate(dateString: string): Date | null {
  if (!dateString) return null

  try {
    let cleaned = dateString.trim()

    // Convert "YYYY-MM-DD HH:mm:ss" → ISO style
    cleaned = cleaned.replace(' ', 'T')

    // Trim microseconds to milliseconds (JS supports only 3 digits)
    if (cleaned.includes('.')) {
      const [base, fraction] = cleaned.split('.')
      cleaned = `${base}.${fraction.slice(0, 3)}`
    }

    const parsed = new Date(cleaned)

    if (isNaN(parsed.getTime())) return null

    return parsed
  } catch {
    return null
  }
}

export default function CountdownTimer({
  archivedAt,
  deletionPeriodDays = 7,
  className = "",
}: CountdownTimerProps) {

  const [timeLeft, setTimeLeft] = useState<{
    days: number
    hours: number
    minutes: number
    seconds: number
    expired: boolean
  } | null>(null)

  useEffect(() => {
    if (!archivedAt) {
      setTimeLeft(null)
      return
    }

    const archivedDate = parseFlexibleDate(archivedAt)

    if (!archivedDate) {
      console.warn("Invalid archivedAt date:", archivedAt)
      setTimeLeft(null)
      return
    }

    const deletionDate = new Date(
      archivedDate.getTime() +
      deletionPeriodDays * 24 * 60 * 60 * 1000
    )

    const calculateTimeLeft = () => {
      const now = new Date()
      const difference = deletionDate.getTime() - now.getTime()

      if (difference <= 0) {
        setTimeLeft({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          expired: true,
        })
        return
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24))
      const hours = Math.floor(
        (difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      )
      const minutes = Math.floor(
        (difference % (1000 * 60 * 60)) / (1000 * 60)
      )
      const seconds = Math.floor(
        (difference % (1000 * 60)) / 1000
      )

      setTimeLeft({
        days,
        hours,
        minutes,
        seconds,
        expired: false,
      })
    }

    calculateTimeLeft()
    const timer = setInterval(calculateTimeLeft, 1000)

    return () => clearInterval(timer)

  }, [archivedAt, deletionPeriodDays])

  if (!archivedAt || !timeLeft) return null

  const isUrgent = timeLeft.days <= 1 && !timeLeft.expired
  const timerColor = timeLeft.expired
    ? 'text-gray-500'
    : isUrgent
      ? 'text-red-600'
      : 'text-orange-600'

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <svg
        className={`w-4 h-4 ${timerColor}`}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
      </svg>

      {timeLeft.expired ? (
        <span className={`text-sm font-medium ${timerColor}`}>
          Expired
        </span>
      ) : (
        <>
          <span className={`text-sm font-medium ${timerColor}`}>
            {timeLeft.days > 0 && `${timeLeft.days}d `}
            {String(timeLeft.hours).padStart(2, '0')}:
            {String(timeLeft.minutes).padStart(2, '0')}:
            {String(timeLeft.seconds).padStart(2, '0')}
          </span>
          <span className={`text-xs ${timerColor}`}>
            until deletion
          </span>
        </>
      )}
    </div>
  )
}

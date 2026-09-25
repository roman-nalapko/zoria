import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from './useSession'

const WARNING_THRESHOLD_MS = 10 * 60 * 1000 // 10 minutes

function formatRemaining(ms: number): string {
  if (ms <= 0) return '00:00'
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

export interface SessionExpiryBannerProps {
  now?: () => number
}

/**
 * T2.3 — Session expiration warning and graceful re-login prompt.
 * Warns participants when token expiration is within 10 minutes.
 */
export function SessionExpiryBanner({
  now = Date.now,
}: SessionExpiryBannerProps) {
  const { info, logout } = useSession()
  const [currentNow, setCurrentNow] = useState(now)

  useEffect(() => {
    if (!info?.expiresAt) return
    const timer = setInterval(() => {
      setCurrentNow(now())
    }, 1000)
    return () => {
      clearInterval(timer)
    }
  }, [info?.expiresAt, now])

  if (!info?.expiresAt) return null

  const expiresAtMs = Date.parse(info.expiresAt)
  const remainingMs = expiresAtMs - currentNow

  if (remainingMs > WARNING_THRESHOLD_MS) {
    return null
  }

  if (remainingMs <= 0) {
    return (
      <div className="session-banner session-banner--expired" role="alert">
        <span>Your session has expired.</span>{' '}
        <button
          type="button"
          className="session-banner__action"
          onClick={() => {
            logout()
          }}
        >
          Sign in again
        </button>
      </div>
    )
  }

  return (
    <div
      className="session-banner session-banner--warning"
      role="status"
      aria-live="polite"
    >
      <span>
        Session expires in <strong>{formatRemaining(remainingMs)}</strong>.
      </span>{' '}
      <Link to="/login" className="session-banner__action">
        Re-authenticate
      </Link>
    </div>
  )
}

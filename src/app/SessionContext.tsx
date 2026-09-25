import { useEffect, useState, type ReactNode } from 'react'
import {
  clearSession,
  getSessionInfo,
  getToken,
  isAuthenticated,
  onSessionChange,
  setSession,
} from '../auth/session-vault'
import type { ParticipantSession } from '../auth/registration'
import { SessionContext } from './sessionTypes'

/**
 * SessionProvider — mirrors vault state into React.
 * Only exports a component so react-refresh hot-reload stays happy.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  // tick causes a re-render whenever the vault notifies listeners.
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const unsub = onSessionChange(() => {
      setTick((t) => t + 1)
    })
    return unsub
  }, [])

  // tick drives re-evaluation; derive vault values fresh each render.
  const info = tick >= 0 ? getSessionInfo() : null
  const token = tick >= 0 ? getToken() : null
  const authenticated = tick >= 0 && isAuthenticated()

  const login = (session: ParticipantSession): void => {
    setSession(session.token, {
      displayName: session.user.displayName,
      expiresAt: session.expiresAt,
      sessionId: session.sessionId,
      username: session.user.username,
    })
  }

  const logout = (): void => {
    clearSession()
  }

  return (
    <SessionContext.Provider
      value={{ authenticated, info, login, logout, token }}
    >
      {children}
    </SessionContext.Provider>
  )
}

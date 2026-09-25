import { useContext } from 'react'
import { SessionContext, type SessionContextValue } from './sessionTypes'

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx) {
    throw new Error('useSession must be used inside <SessionProvider>')
  }
  return ctx
}

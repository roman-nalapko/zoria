import { createContext } from 'react'
import type { SessionInfo } from '../auth/session-vault'
import type { ParticipantSession } from '../auth/registration'

export interface SessionContextValue {
  authenticated: boolean
  info: SessionInfo | null
  /** Consume a ParticipantSession from a login/register response. */
  login: (session: ParticipantSession) => void
  logout: () => void
  /** Bearer token — NEVER log or display. */
  token: string | null
}

/**
 * The React context object for session state.
 * Kept in a non-component file so SessionProvider.tsx (component) and
 * useSession.ts (hook) can each import without violating react-refresh rules.
 */
export const SessionContext = createContext<SessionContextValue | null>(null)

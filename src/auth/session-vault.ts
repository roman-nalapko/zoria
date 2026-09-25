/**
 * In-memory session vault.
 *
 * The bearer token is NEVER written to localStorage, sessionStorage, or any
 * persistent medium. It lives only in the closure of this module for the
 * duration of the page session. All diagnostic output must redact the token.
 */

export interface SessionInfo {
  /** Opaque session identifier (safe to log). */
  sessionId: string
  /** UTC ISO-8601 expiry timestamp. */
  expiresAt: string
  username: string
  displayName: string
}

let _token: string | null = null
let _info: SessionInfo | null = null
let _listeners: Array<() => void> = []

/** Store a bearer token and accompanying session info. */
export function setSession(token: string, info: SessionInfo): void {
  _token = token
  _info = info
  notifyListeners()
}

/** Clear the session (logout). */
export function clearSession(): void {
  _token = null
  _info = null
  notifyListeners()
}

/** Returns the bearer token, or null if not authenticated. Never log this. */
export function getToken(): string | null {
  return _token
}

/** Returns public session metadata (no token). */
export function getSessionInfo(): SessionInfo | null {
  return _info
}

/** Returns true if there is an active, non-expired session. */
export function isAuthenticated(): boolean {
  if (!_token || !_info) return false
  return Date.parse(_info.expiresAt) > Date.now()
}

/**
 * Subscribe to session changes (login / logout).
 * Returns an unsubscribe function.
 */
export function onSessionChange(listener: () => void): () => void {
  _listeners = [..._listeners, listener]
  return () => {
    _listeners = _listeners.filter((l) => l !== listener)
  }
}

function notifyListeners(): void {
  for (const l of _listeners) {
    try {
      l()
    } catch {
      // individual listener failures must not break the vault
    }
  }
}

/** For use in tests only — wipes vault state. */
export function _resetVaultForTest(): void {
  _token = null
  _info = null
  _listeners = []
}

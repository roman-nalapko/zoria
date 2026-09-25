import { describe, it, expect, beforeEach } from 'vitest'
import {
  setSession,
  clearSession,
  getToken,
  getSessionInfo,
  isAuthenticated,
  onSessionChange,
  _resetVaultForTest,
} from './session-vault'

const FUTURE = new Date(Date.now() + 3_600_000).toISOString()
const PAST = new Date(Date.now() - 1000).toISOString()

const SESSION_INFO = {
  sessionId: 's-001',
  expiresAt: FUTURE,
  username: 'roman-nalapko',
  displayName: 'Roman',
}

beforeEach(() => {
  _resetVaultForTest()
})

describe('session-vault', () => {
  it('starts unauthenticated', () => {
    expect(getToken()).toBeNull()
    expect(getSessionInfo()).toBeNull()
    expect(isAuthenticated()).toBe(false)
  })

  it('setSession stores token and info', () => {
    setSession('tok-abc', SESSION_INFO)
    expect(getToken()).toBe('tok-abc')
    expect(getSessionInfo()).toEqual(SESSION_INFO)
    expect(isAuthenticated()).toBe(true)
  })

  it('clearSession wipes token and info', () => {
    setSession('tok-abc', SESSION_INFO)
    clearSession()
    expect(getToken()).toBeNull()
    expect(getSessionInfo()).toBeNull()
    expect(isAuthenticated()).toBe(false)
  })

  it('isAuthenticated returns false for expired session', () => {
    setSession('tok-exp', { ...SESSION_INFO, expiresAt: PAST })
    expect(isAuthenticated()).toBe(false)
  })

  it('notifies subscribers on login', () => {
    const calls: number[] = []
    onSessionChange(() => calls.push(1))
    setSession('tok-abc', SESSION_INFO)
    expect(calls).toHaveLength(1)
  })

  it('notifies subscribers on logout', () => {
    setSession('tok-abc', SESSION_INFO)
    const calls: number[] = []
    onSessionChange(() => calls.push(1))
    clearSession()
    expect(calls).toHaveLength(1)
  })

  it('unsubscribe stops future notifications', () => {
    const calls: number[] = []
    const unsub = onSessionChange(() => calls.push(1))
    unsub()
    setSession('tok-abc', SESSION_INFO)
    expect(calls).toHaveLength(0)
  })

  it('does not crash if a listener throws', () => {
    onSessionChange(() => {
      throw new Error('listener bug')
    })
    expect(() => {
      setSession('tok-abc', SESSION_INFO)
    }).not.toThrow()
  })
})

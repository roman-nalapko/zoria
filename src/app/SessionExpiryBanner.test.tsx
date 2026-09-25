import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { SessionExpiryBanner } from './SessionExpiryBanner'
import { SessionProvider } from './SessionContext'
import { _resetVaultForTest, setSession } from '../auth/session-vault'

afterEach(() => {
  cleanup()
  _resetVaultForTest()
})

beforeEach(() => {
  _resetVaultForTest()
})

describe('SessionExpiryBanner', () => {
  it('renders nothing when unauthenticated', () => {
    render(
      <MemoryRouter>
        <SessionProvider>
          <SessionExpiryBanner />
        </SessionProvider>
      </MemoryRouter>,
    )
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('renders nothing when expiry is more than 10 minutes away', () => {
    const now = 100_000
    const expiresAt = new Date(now + 15 * 60 * 1000).toISOString()
    setSession('tok', {
      displayName: 'Roman',
      expiresAt,
      sessionId: 's1',
      username: 'roman-nalapko',
    })

    render(
      <MemoryRouter>
        <SessionProvider>
          <SessionExpiryBanner now={() => now} />
        </SessionProvider>
      </MemoryRouter>,
    )
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('renders warning when session expires in less than 10 minutes', () => {
    const now = 100_000
    // 5 minutes remaining
    const expiresAt = new Date(now + 5 * 60 * 1000).toISOString()
    setSession('tok', {
      displayName: 'Roman',
      expiresAt,
      sessionId: 's1',
      username: 'roman-nalapko',
    })

    render(
      <MemoryRouter>
        <SessionProvider>
          <SessionExpiryBanner now={() => now} />
        </SessionProvider>
      </MemoryRouter>,
    )
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('05:00')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /re-authenticate/i }),
    ).toBeInTheDocument()
  })

  it('renders alert when session has expired', () => {
    const now = 100_000
    const expiresAt = new Date(now - 1000).toISOString()
    setSession('tok', {
      displayName: 'Roman',
      expiresAt,
      sessionId: 's1',
      username: 'roman-nalapko',
    })

    render(
      <MemoryRouter>
        <SessionProvider>
          <SessionExpiryBanner now={() => now} />
        </SessionProvider>
      </MemoryRouter>,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/your session has expired/i)).toBeInTheDocument()
  })
})

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import {
  API_ORIGINS,
  TRAINING_ETHER_KEY_FINGERPRINT,
} from '../config/environment'
import { SessionProvider } from './SessionContext'
import { AppShell } from './AppShell'
import { _resetVaultForTest, setSession } from '../auth/session-vault'

const config = {
  apiUrl: API_ORIGINS.training,
  environment: 'training' as const,
  etherKeyFingerprint: TRAINING_ETHER_KEY_FINGERPRINT,
}

function renderShell(initialPath = '/login') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <SessionProvider>
        <AppShell config={config} />
      </SessionProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  _resetVaultForTest()
})

beforeEach(() => {
  _resetVaultForTest()
})

describe('AppShell', () => {
  it('shows Sign in link when unauthenticated', () => {
    renderShell()
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument()
  })

  it('shows brand link', () => {
    renderShell()
    expect(
      screen.getByRole('link', { name: /zoria home/i }),
    ).toBeInTheDocument()
  })

  it('shows training environment badge', () => {
    renderShell()
    expect(screen.getByText('training')).toBeInTheDocument()
  })

  it('does not show nav links when unauthenticated', () => {
    renderShell()
    expect(screen.queryByRole('link', { name: /dashboard/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /news/i })).toBeNull()
  })

  it('shows nav links when authenticated', () => {
    setSession('tok', {
      sessionId: 's1',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      username: 'roman-nalapko',
      displayName: 'Roman',
    })
    renderShell('/dashboard')
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /news/i })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /sign out/i }),
    ).toBeInTheDocument()
  })
})

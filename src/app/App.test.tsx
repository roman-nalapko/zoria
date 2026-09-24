import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  API_ORIGINS,
  TRAINING_ETHER_KEY_FINGERPRINT,
} from '../config/environment'
import type { EtherFrame } from '../ether/verifier'
import { AppView } from './App'

const config = {
  apiUrl: API_ORIGINS.training,
  environment: 'training' as const,
  etherKeyFingerprint: TRAINING_ETHER_KEY_FINGERPRINT,
}

const frame: EtherFrame = {
  at: '2026-09-24T03:00:00.000Z',
  fragment: null,
  harbinger: { opensIn: 3600, text: { ru: 'signal', uk: 'signal' } },
  kind: 'signal',
  onAir: 7,
  phase: 'static',
  station: 'zoria',
  v: 1,
  window: null,
}

describe('App', () => {
  it('shows the safe training environment before a signal arrives', () => {
    render(
      <AppView
        config={config}
        nowMs={0}
        snapshot={{
          consecutiveFailures: 0,
          frame: null,
          keyFingerprint: null,
          lastCheckedAt: null,
          message: null,
          nextPollAt: null,
          receivedAt: null,
          status: 'idle',
        }}
      />,
    )
    expect(
      screen.getByRole('heading', { name: /ready to establish contact/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('training')).toBeInTheDocument()
    expect(screen.getByText(API_ORIGINS.training)).toBeInTheDocument()
  })

  it('renders a verified phase and server-adjusted countdown', () => {
    const receivedAt = Date.parse(frame.at) - 5000
    render(
      <AppView
        config={config}
        nowMs={receivedAt}
        snapshot={{
          consecutiveFailures: 0,
          frame,
          keyFingerprint: TRAINING_ETHER_KEY_FINGERPRINT,
          lastCheckedAt: receivedAt,
          message: null,
          nextPollAt: null,
          receivedAt,
          status: 'signal',
        }}
      />,
    )
    expect(
      screen.getByRole('heading', { name: /verified signal/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('static')).toBeInTheDocument()
    expect(screen.getByText('01:00:00')).toBeInTheDocument()
  })
})

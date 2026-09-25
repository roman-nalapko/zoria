import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { DashboardPage } from './DashboardPage'
import { SessionProvider } from './SessionContext'
import { _resetVaultForTest, setSession } from '../auth/session-vault'
import type { ApiTransport } from '../api/transport'
import type { EtherController, EtherSnapshot } from '../ether/controller'
import type { Repository, Summary } from '../participant/service'

const mockRepo: Repository = {
  accessStatus: 'verified',
  checkedAt: '2026-09-25T05:02:40.000Z',
  reason: 'Marker file found in repository',
  reasonCode: 'marker-found',
  updatedAt: '2026-09-25T05:02:40.000Z',
  url: 'https://github.com/roman-nalapko/zoria',
  verifiedElsewhere: false,
}

const mockSummary: Summary = {
  acknowledgedStages: 1,
  latestNews: '2026-09-24T20:00:00.000Z',
  releasedStages: 2,
  repositoryAt: '2026-09-25T05:02:40.000Z',
  serverTime: '2026-09-25T06:00:00.000Z',
  unread: 3,
}

const mockSnapshot: EtherSnapshot = {
  consecutiveFailures: 0,
  frame: {
    at: '2026-09-25T05:00:00.000Z',
    fragment: null,
    harbinger: { opensIn: 1800, text: { en: 'Standby', uk: 'Очікування' } },
    kind: 'signal',
    onAir: 1,
    phase: 'static',
    station: 'zoria',
    v: 1,
    window: null,
  },
  keyFingerprint:
    'f3a436df65614f08635f18fe0f64f145285203f1faa2905ecb25ffb90969a7de',
  lastCheckedAt: 1000,
  message: null,
  nextPollAt: null,
  receivedAt: 1000,
  status: 'signal',
}

afterEach(() => {
  cleanup()
  _resetVaultForTest()
})

beforeEach(() => {
  _resetVaultForTest()
})

describe('DashboardPage', () => {
  it('renders repository admission card, ether status, and summary counters', async () => {
    setSession('tok-abc', {
      displayName: 'Roman Nalapko',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      sessionId: 's1',
      username: 'roman-nalapko',
    })

    const requestMock = vi.fn().mockImplementation((path: string) => {
      if (path === '/me/summary') {
        return Promise.resolve({
          body: JSON.stringify(mockSummary),
          ok: true,
          status: 200,
        })
      }
      if (path === '/me/repository') {
        return Promise.resolve({
          body: JSON.stringify({ repository: mockRepo }),
          ok: true,
          status: 200,
        })
      }
      return Promise.resolve({ body: '{}', ok: true, status: 200 })
    })

    const mockTransport = { request: requestMock } as unknown as ApiTransport

    const mockController = {
      fingerprint:
        'f3a436df65614f08635f18fe0f64f145285203f1faa2905ecb25ffb90969a7de',
      getSnapshot: () => mockSnapshot,
      retain: () => () => {},
      subscribe: () => () => {},
    } as unknown as EtherController

    render(
      <MemoryRouter>
        <SessionProvider>
          <DashboardPage
            transport={mockTransport}
            controller={mockController}
          />
        </SessionProvider>
      </MemoryRouter>,
    )

    // Heading displays participant display name
    expect(
      screen.getByRole('heading', { name: /roman nalapko/i }),
    ).toBeInTheDocument()

    // Ether telemetry displays signal status and phase
    expect(screen.getByText(/verified signal/i)).toBeInTheDocument()
    expect(screen.getByText('static')).toBeInTheDocument()

    // Repository card displays URL and verified status
    await vi.waitFor(() => {
      expect(
        screen.getByText('https://github.com/roman-nalapko/zoria'),
      ).toBeInTheDocument()
      expect(screen.getByText('marker-found')).toBeInTheDocument()
    })

    // Summary counters display counts
    expect(screen.getByText('Unread News')).toBeInTheDocument()
    expect(screen.getByText('Released Stages')).toBeInTheDocument()

    // Refresh button triggers reload
    const refreshBtn = screen.getByRole('button', { name: /refresh/i })
    refreshBtn.click()
    await vi.waitFor(() => {
      expect(requestMock).toHaveBeenCalledWith('/me/summary', expect.anything())
    })
  })
})

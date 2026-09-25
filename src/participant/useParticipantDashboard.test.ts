import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { useParticipantDashboard } from './useParticipantDashboard'
import { SessionProvider } from '../app/SessionContext'
import { _resetVaultForTest, setSession } from '../auth/session-vault'
import type { ApiTransport } from '../api/transport'
import { PollingCoordinator } from '../api/polling'
import type { Repository, Summary } from './service'

const mockSummary: Summary = {
  acknowledgedStages: 0,
  latestNews: '2026-09-24T20:00:00.000Z',
  releasedStages: 1,
  repositoryAt: '2026-09-25T05:02:40.000Z',
  serverTime: '2026-09-25T06:00:00.000Z',
  unread: 2,
}

const mockRepo: Repository = {
  accessStatus: 'verified',
  checkedAt: '2026-09-25T05:02:40.000Z',
  reason: 'Marker found',
  reasonCode: 'marker-found',
  updatedAt: '2026-09-25T05:02:40.000Z',
  url: 'https://github.com/roman-nalapko/zoria',
  verifiedElsewhere: false,
}

beforeEach(() => {
  _resetVaultForTest()
})

function wrapper({ children }: { children: ReactNode }) {
  return createElement(SessionProvider, null, children)
}

describe('useParticipantDashboard', () => {
  it('fetches summary and repository when authenticated', async () => {
    setSession('tok-1', {
      displayName: 'Roman',
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

    const transport = { request: requestMock } as unknown as ApiTransport
    const coordinator = new PollingCoordinator()

    const { result } = renderHook(
      () => useParticipantDashboard(transport, coordinator, 60_000),
      { wrapper },
    )

    await waitFor(() => {
      expect(result.current.summary).toEqual(mockSummary)
      expect(result.current.repository).toEqual(mockRepo)
    })
  })

  it('does not fetch when unauthenticated', () => {
    const requestMock = vi.fn()
    const transport = { request: requestMock } as unknown as ApiTransport
    const coordinator = new PollingCoordinator()

    const { result } = renderHook(
      () => useParticipantDashboard(transport, coordinator, 60_000),
      { wrapper },
    )

    expect(result.current.summary).toBeNull()
    expect(result.current.repository).toBeNull()
    expect(requestMock).not.toHaveBeenCalled()
  })
})

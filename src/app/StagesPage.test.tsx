import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiTransport } from '../api/transport'
import { _resetVaultForTest, setSession } from '../auth/session-vault'
import { SessionProvider } from './SessionContext'
import { StagesPage } from './StagesPage'

const mockSummary = {
  acknowledgedAt: null,
  errataAt: '2026-09-22T10:00:00Z',
  excerpt: 'Phase 1 tasks excerpt description',
  id: 'stg-1',
  position: 1,
  publishedAt: '2026-09-21T06:00:00Z',
  releasedAt: '2026-09-21T06:00:00Z',
  title: 'Part 1: The Gathering',
}

const mockStage = {
  acknowledgedAt: null,
  body: '## Tasks\nFollow the instructions.',
  errata: 'Clarification regarding repository marker.',
  errataAt: '2026-09-22T10:00:00Z',
  id: 'stg-1',
  position: 1,
  publishedAt: '2026-09-21T06:00:00Z',
  releasedAt: '2026-09-21T06:00:00Z',
  title: 'Part 1: The Gathering',
}

afterEach(() => {
  cleanup()
  _resetVaultForTest()
})

beforeEach(() => {
  _resetVaultForTest()
})

describe('StagesPage', () => {
  it('renders stages list and displays detail with errata banner', async () => {
    setSession('tok-stages', {
      displayName: 'Roman',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      sessionId: 's1',
      username: 'roman-nalapko',
    })

    const requestMock = vi.fn().mockImplementation((path: string) => {
      if (path === '/stages') {
        return Promise.resolve({
          body: JSON.stringify({ items: [mockSummary] }),
          ok: true,
          status: 200,
        })
      }
      if (path === '/stages/stg-1') {
        return Promise.resolve({
          body: JSON.stringify({ stage: mockStage }),
          ok: true,
          status: 200,
        })
      }
      return Promise.resolve({ body: '{}', ok: true, status: 200 })
    })

    const transport = { request: requestMock } as unknown as ApiTransport

    render(
      <SessionProvider>
        <StagesPage transport={transport} />
      </SessionProvider>,
    )

    await vi.waitFor(() => {
      expect(screen.getByText('Part 1: The Gathering')).toBeInTheDocument()
      expect(screen.getByText(/Official Errata Notice/i)).toBeInTheDocument()
      expect(
        screen.getByText('Clarification regarding repository marker.'),
      ).toBeInTheDocument()
      expect(screen.getByText('Tasks')).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /acknowledge stage/i }),
      ).toBeInTheDocument()
    })
  })

  it('acknowledges a stage on button click', async () => {
    setSession('tok-stages', {
      displayName: 'Roman',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      sessionId: 's1',
      username: 'roman-nalapko',
    })

    const ackedStage = {
      ...mockStage,
      acknowledgedAt: '2026-09-25T11:00:00Z',
    }

    const requestMock = vi.fn().mockImplementation((path: string) => {
      if (path === '/stages') {
        return Promise.resolve({
          body: JSON.stringify({ items: [mockSummary] }),
          ok: true,
          status: 200,
        })
      }
      if (path === '/stages/stg-1') {
        return Promise.resolve({
          body: JSON.stringify({ stage: mockStage }),
          ok: true,
          status: 200,
        })
      }
      if (path === '/stages/stg-1/ack') {
        return Promise.resolve({
          body: JSON.stringify({ stage: ackedStage }),
          ok: true,
          status: 200,
        })
      }
      return Promise.resolve({ body: '{}', ok: true, status: 200 })
    })

    const transport = { request: requestMock } as unknown as ApiTransport

    render(
      <SessionProvider>
        <StagesPage transport={transport} />
      </SessionProvider>,
    )

    await vi.waitFor(() => {
      expect(
        screen.getByRole('button', { name: /acknowledge stage/i }),
      ).toBeInTheDocument()
    })

    const ackBtn = screen.getByRole('button', { name: /acknowledge stage/i })
    ackBtn.click()

    await vi.waitFor(() => {
      expect(requestMock).toHaveBeenCalledWith(
        '/stages/stg-1/ack',
        expect.objectContaining({
          method: 'POST',
          token: 'tok-stages',
        }),
      )
      expect(
        screen.queryByRole('button', { name: /acknowledge stage/i }),
      ).toBeNull()
      expect(screen.getAllByText(/acknowledged/i).length).toBeGreaterThan(0)
    })
  })
})

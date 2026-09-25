import { describe, expect, it, vi } from 'vitest'
import type { ApiTransport } from '../api/transport'
import {
  acknowledgeStage,
  fetchStage,
  fetchStages,
  type Stage,
  type StageSummary,
} from './service'

const mockSummary: StageSummary = {
  acknowledgedAt: null,
  errataAt: null,
  excerpt: 'Phase 1 tasks excerpt',
  id: '00000000-0000-0000-0000-000000000001',
  position: 1,
  publishedAt: '2026-09-21T06:00:00Z',
  releasedAt: '2026-09-21T06:00:00Z',
  title: 'Part 1: The Gathering',
}

const mockStage: Stage = {
  acknowledgedAt: null,
  body: '# Technical Specification\nComplete the registration and client.',
  errata: null,
  errataAt: null,
  id: '00000000-0000-0000-0000-000000000001',
  position: 1,
  publishedAt: '2026-09-21T06:00:00Z',
  releasedAt: '2026-09-21T06:00:00Z',
  title: 'Part 1: The Gathering',
}

describe('stages service', () => {
  it('fetchStages queries /stages with token', async () => {
    const requestMock = vi.fn().mockResolvedValue({
      body: JSON.stringify({ items: [mockSummary] }),
      ok: true,
      status: 200,
    })
    const transport = { request: requestMock } as unknown as ApiTransport

    const res = await fetchStages(transport, 'tok-stages')
    expect(requestMock).toHaveBeenCalledWith(
      '/stages',
      expect.objectContaining({
        method: 'GET',
        token: 'tok-stages',
      }),
    )
    expect(res.items).toEqual([mockSummary])
  })

  it('fetchStage queries /stages/{id}', async () => {
    const requestMock = vi.fn().mockResolvedValue({
      body: JSON.stringify({ stage: mockStage }),
      ok: true,
      status: 200,
    })
    const transport = { request: requestMock } as unknown as ApiTransport

    const res = await fetchStage(transport, mockStage.id, 'tok-stages')
    expect(requestMock).toHaveBeenCalledWith(
      `/stages/${mockStage.id}`,
      expect.objectContaining({
        method: 'GET',
        token: 'tok-stages',
      }),
    )
    expect(res).toEqual(mockStage)
  })

  it('acknowledgeStage sends POST /stages/{id}/ack', async () => {
    const updatedStage: Stage = {
      ...mockStage,
      acknowledgedAt: '2026-09-25T10:00:00Z',
    }
    const requestMock = vi.fn().mockResolvedValue({
      body: JSON.stringify({ stage: updatedStage }),
      ok: true,
      status: 200,
    })
    const transport = { request: requestMock } as unknown as ApiTransport

    const res = await acknowledgeStage(transport, mockStage.id, 'tok-stages')
    expect(requestMock).toHaveBeenCalledWith(
      `/stages/${mockStage.id}/ack`,
      expect.objectContaining({
        body: {},
        method: 'POST',
        token: 'tok-stages',
      }),
    )
    expect(res).toEqual(updatedStage)
  })
})

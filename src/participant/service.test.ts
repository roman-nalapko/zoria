import { describe, expect, it, vi } from 'vitest'
import {
  fetchRepository,
  fetchSummary,
  formatBucharest,
  type Repository,
  type Summary,
} from './service'
import type { ApiTransport } from '../api/transport'

describe('participant service', () => {
  describe('formatBucharest', () => {
    it('returns dash for null or undefined or invalid', () => {
      expect(formatBucharest(null)).toBe('—')
      expect(formatBucharest(undefined)).toBe('—')
      expect(formatBucharest('invalid-date')).toBe('—')
    })

    it('formats UTC ISO timestamp in Europe/Bucharest timezone', () => {
      const formatted = formatBucharest('2026-09-25T05:02:40.000Z')
      // UTC 05:02:40 + 3 hours DST = 08:02:40
      expect(formatted).toContain('08:02:40')
    })
  })

  describe('fetchRepository', () => {
    it('fetches and unwraps repository object', async () => {
      const mockRepo: Repository = {
        accessStatus: 'verified',
        checkedAt: '2026-09-25T05:02:40.000Z',
        reason: 'verified marker',
        reasonCode: 'marker-found',
        updatedAt: '2026-09-25T05:02:40.000Z',
        url: 'https://github.com/roman-nalapko/zoria',
        verifiedElsewhere: false,
      }

      const requestMock = vi.fn().mockResolvedValue({
        body: JSON.stringify({ repository: mockRepo }),
        ok: true,
        status: 200,
      })
      const transport = {
        request: requestMock,
      } as unknown as ApiTransport

      const result = await fetchRepository(transport, 'tok-123')
      expect(result).toEqual(mockRepo)
      expect(requestMock).toHaveBeenCalledWith('/me/repository', {
        method: 'GET',
        token: 'tok-123',
      })
    })

    it('returns null on non-200 or invalid json', async () => {
      const transport = {
        request: vi.fn().mockResolvedValue({
          body: 'Not found',
          ok: false,
          status: 404,
        }),
      } as unknown as ApiTransport

      const result = await fetchRepository(transport)
      expect(result).toBeNull()
    })
  })

  describe('fetchSummary', () => {
    it('fetches and parses summary object', async () => {
      const mockSummary: Summary = {
        acknowledgedStages: 0,
        latestNews: '2026-09-24T20:00:00.000Z',
        releasedStages: 1,
        repositoryAt: '2026-09-25T05:02:40.000Z',
        serverTime: '2026-09-25T06:00:00.000Z',
        unread: 2,
      }

      const requestMock = vi.fn().mockResolvedValue({
        body: JSON.stringify(mockSummary),
        ok: true,
        status: 200,
      })
      const transport = {
        request: requestMock,
      } as unknown as ApiTransport

      const result = await fetchSummary(transport)
      expect(result).toEqual(mockSummary)
      expect(requestMock).toHaveBeenCalledWith('/me/summary', {
        method: 'GET',
      })
    })
  })
})

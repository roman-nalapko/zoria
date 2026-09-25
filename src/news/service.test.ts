import { describe, expect, it, vi } from 'vitest'
import { fetchNews, type News } from './service'
import type { ApiTransport } from '../api/transport'

const mockNewsItem: News = {
  archivedAt: null,
  body: '# Welcome to Zoria\nCompetition begins soon.',
  createdAt: '2026-09-24T12:00:00.000Z',
  id: 'news-1',
  publishedAt: '2026-09-24T12:00:00.000Z',
  title: 'Welcome to Zoria 2026',
  updatedAt: '2026-09-24T12:00:00.000Z',
}

describe('news service', () => {
  it('fetches news with default pagination', async () => {
    const requestMock = vi.fn().mockResolvedValue({
      body: JSON.stringify({
        items: [mockNewsItem],
        nextOffset: 10,
      }),
      ok: true,
      status: 200,
    })
    const transport = { request: requestMock } as unknown as ApiTransport

    const result = await fetchNews(transport)

    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toEqual(mockNewsItem)
    expect(result.nextOffset).toBe(10)
    expect(requestMock).toHaveBeenCalledWith('/news', expect.anything())
  })

  it('passes limit and offset query parameters', async () => {
    const requestMock = vi.fn().mockResolvedValue({
      body: JSON.stringify({ items: [], nextOffset: null }),
      ok: true,
      status: 200,
    })
    const transport = { request: requestMock } as unknown as ApiTransport

    await fetchNews(transport, { limit: 5, offset: 15, token: 'secret' })

    expect(requestMock).toHaveBeenCalledWith(
      '/news?limit=5&offset=15',
      expect.objectContaining({
        token: 'secret',
      }),
    )
  })

  it('throws descriptive error on failure', async () => {
    const requestMock = vi.fn().mockResolvedValue({
      error: { code: 'origin-quiet' },
      ok: false,
      status: 503,
    })
    const transport = { request: requestMock } as unknown as ApiTransport

    await expect(fetchNews(transport)).rejects.toThrow('origin-quiet')
  })
})

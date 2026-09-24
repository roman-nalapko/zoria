import { describe, expect, it, vi } from 'vitest'
import { ApiTransport, QuietPeriodError } from './transport'

describe('ApiTransport', () => {
  it('captures arbitrary bodies and request IDs without assuming JSON', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('<html>noise</html>', {
        status: 503,
        headers: { 'X-Request-Id': 'req-123' },
      }),
    )
    const transport = new ApiTransport('https://stand.zoria.net/api/v1', {
      fetch: fetchMock,
    })

    const response = await transport.request('/ether')

    expect(response.body).toBe('<html>noise</html>')
    expect(response.requestId).toBe('req-123')
    expect(response.error).toEqual({
      code: null,
      field: null,
      requestId: 'req-123',
      status: 503,
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://stand.zoria.net/api/v1/ether',
      expect.objectContaining({ credentials: 'omit' }),
    )
  })

  it('silences all subsequent traffic after jammed', async () => {
    let now = 1000
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(
        new Response('{"error":{"code":"jammed"}}', {
          status: 429,
          headers: { 'Retry-After': '30' },
        }),
      ),
    )
    const transport = new ApiTransport('https://stand.zoria.net/api/v1', {
      fetch: fetchMock,
      now: () => now,
    })

    await transport.request('/ether')
    await expect(transport.request('/public/config')).rejects.toEqual(
      expect.objectContaining<Partial<QuietPeriodError>>({
        remainingMs: 30_000,
      }),
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)

    now = 31_001
    await transport.request('/ether')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

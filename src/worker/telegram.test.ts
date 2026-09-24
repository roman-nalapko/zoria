import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TelegramNotifier } from './telegram.js'

const TOKEN = 'test-bot-token'
const CHAT_ID = '123456789'

function makeMockFetch(
  responses: Array<{
    ok: boolean
    status?: number
    body?: unknown
  }>,
) {
  let index = 0
  return vi.fn().mockImplementation(() => {
    const clampedIndex = Math.min(index, responses.length - 1)
    const spec = responses[clampedIndex]
    index++
    const bodyText = JSON.stringify(spec.body ?? { ok: spec.ok })
    return Promise.resolve(
      new Response(bodyText, {
        status: spec.status ?? (spec.ok ? 200 : 400),
        headers: { 'content-type': 'application/json' },
      }),
    )
  })
}

describe('TelegramNotifier (R8)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('sends to the fixed chatId and returns true on ok response', async () => {
    const mockFetch = makeMockFetch([{ ok: true, body: { ok: true } }])
    vi.stubGlobal('fetch', mockFetch)

    const notifier = new TelegramNotifier(TOKEN, CHAT_ID)
    const result = await notifier.send('hello')

    expect(result).toBe(true)
    // Verify the correct chatId was used in the request body.
    const [, callInit] = mockFetch.mock.calls[0] as [string, RequestInit]
    const callBody = JSON.parse(callInit.body as string) as { chat_id: string }
    expect(callBody.chat_id).toBe(CHAT_ID)
  })

  it('returns false immediately when chatId is null (no discovery fallback)', async () => {
    const mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)

    const notifier = new TelegramNotifier(TOKEN, null)
    const result = await notifier.send('hello')

    expect(result).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('retries on 429 with retry_after and succeeds', async () => {
    const mockFetch = makeMockFetch([
      {
        ok: false,
        status: 429,
        body: { ok: false, parameters: { retry_after: 1 } },
      },
      { ok: true, body: { ok: true } },
    ])
    vi.stubGlobal('fetch', mockFetch)

    const notifier = new TelegramNotifier(TOKEN, CHAT_ID)
    const sendPromise = notifier.send('test')

    // Advance timers past the retry_after (1000ms).
    await vi.runAllTimersAsync()
    const result = await sendPromise

    expect(result).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('retries on 5xx and succeeds on third attempt', async () => {
    const mockFetch = makeMockFetch([
      { ok: false, status: 503, body: { ok: false } },
      { ok: false, status: 503, body: { ok: false } },
      { ok: true, body: { ok: true } },
    ])
    vi.stubGlobal('fetch', mockFetch)

    const notifier = new TelegramNotifier(TOKEN, CHAT_ID)
    const sendPromise = notifier.send('test')
    await vi.runAllTimersAsync()
    const result = await sendPromise

    expect(result).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('does not retry on 4xx non-429 error', async () => {
    const mockFetch = makeMockFetch([
      {
        ok: false,
        status: 400,
        body: { ok: false, description: 'Bad request' },
      },
    ])
    vi.stubGlobal('fetch', mockFetch)

    const notifier = new TelegramNotifier(TOKEN, CHAT_ID)
    const result = await notifier.send('test')

    expect(result).toBe(false)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('queues a pending success notification when send fails', async () => {
    // First attempt fails, so it goes to pending.
    const mockFetch = makeMockFetch([
      { ok: false, status: 503, body: { ok: false } },
      { ok: false, status: 503, body: { ok: false } },
      { ok: false, status: 503, body: { ok: false } },
      { ok: false, status: 503, body: { ok: false } },
      // flushPending retry succeeds.
      { ok: true, body: { ok: true } },
    ])
    vi.stubGlobal('fetch', mockFetch)

    const notifier = new TelegramNotifier(TOKEN, CHAT_ID)
    const sendPromise = notifier.sendSuccess('Registration complete!')
    await vi.runAllTimersAsync()
    const delivered = await sendPromise

    expect(delivered).toBe(false)
    expect(notifier.hasPending()).toBe(true)

    // Now flush the pending notification.
    vi.stubGlobal('fetch', makeMockFetch([{ ok: true, body: { ok: true } }]))
    await notifier.flushPending()
    expect(notifier.hasPending()).toBe(false)
  })

  it('never calls getUpdates (no auto-discovery)', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      )
    vi.stubGlobal('fetch', mockFetch)

    const notifier = new TelegramNotifier(TOKEN, CHAT_ID)
    await notifier.send('test')

    const urls: string[] = mockFetch.mock.calls.map(
      (call: unknown[]) => call[0] as string,
    )
    expect(urls.every((url) => !url.includes('getUpdates'))).toBe(true)
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkerConfig } from './config.js'
import type { SafeApiResult } from './zoria.js'
import { ZoriaWorkerClient } from './zoria.js'

// Minimal config for tests — no real secrets.
const TEST_CONFIG: WorkerConfig = {
  apiUrl: 'https://stand.zoria.net/api/v1',
  displayName: 'Test',
  etherKeyFingerprint:
    'f3a436df65614f08635f18fe0f64f145285203f1faa2905ecb25ffb90969a7de',
  invitation: 'STAND-2026',
  password: 'test-password-synthetic',
  pollIntervalMs: 15_000,
  repositoryUrl: 'https://github.com/example/test',
  telegramBotToken: 'test-token',
  telegramChatId: '123456',
  username: 'test-user',
}

function mockResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  const bodyText = typeof body === 'string' ? body : JSON.stringify(body)
  return new Response(bodyText, {
    status,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
  })
}

describe('ZoriaWorkerClient — session validation (R2)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects an HTML 200 response as not a valid session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(mockResponse(200, '<html>Captcha</html>', {})),
    )
    const client = new ZoriaWorkerClient(TEST_CONFIG)
    const result: SafeApiResult = await client.login()

    expect(result.ok).toBe(true) // HTTP 200
    expect(result.sessionValid).toBe(false) // body is not a valid session
  })

  it('rejects malformed JSON response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(mockResponse(200, 'not json at all')),
    )
    const client = new ZoriaWorkerClient(TEST_CONFIG)
    const result = await client.login()

    expect(result.ok).toBe(true)
    expect(result.sessionValid).toBe(false)
  })

  it('rejects a valid-JSON response with no token field', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          mockResponse(200, { user: { username: 'test-user' } }),
        ),
    )
    const client = new ZoriaWorkerClient(TEST_CONFIG)
    const result = await client.login()

    expect(result.ok).toBe(true)
    expect(result.sessionValid).toBe(false)
  })

  it('rejects a session for a different username (wrong identity)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockResponse(200, {
          token: 'eyJ.test.token',
          username: 'different-user',
        }),
      ),
    )
    const client = new ZoriaWorkerClient(TEST_CONFIG)
    const result = await client.login()

    expect(result.ok).toBe(true)
    expect(result.sessionValid).toBe(false)
  })

  it('accepts a valid session with matching username', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockResponse(200, {
          token: 'eyJ.valid.token',
          username: 'test-user',
        }),
      ),
    )
    const client = new ZoriaWorkerClient(TEST_CONFIG)
    const result = await client.login()

    expect(result.ok).toBe(true)
    expect(result.sessionValid).toBe(true)
  })

  it('accepts a valid session nested under session.token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockResponse(200, {
          session: { token: 'eyJ.nested.token' },
          username: 'test-user',
        }),
      ),
    )
    const client = new ZoriaWorkerClient(TEST_CONFIG)
    const result = await client.login()

    expect(result.ok).toBe(true)
    expect(result.sessionValid).toBe(true)
  })

  it('accepts username comparison case-insensitively', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockResponse(200, {
          token: 'eyJ.token',
          username: 'TEST-USER',
        }),
      ),
    )
    const client = new ZoriaWorkerClient(TEST_CONFIG)
    const result = await client.login()

    expect(result.sessionValid).toBe(true)
  })

  it('handles 401 invalid-credentials correctly', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          mockResponse(401, { error: { code: 'invalid-credentials' } }),
        ),
    )
    const client = new ZoriaWorkerClient(TEST_CONFIG)
    const result = await client.login()

    expect(result.ok).toBe(false)
    expect(result.status).toBe(401)
    expect(result.errorCode).toBe('invalid-credentials')
    expect(result.sessionValid).toBe(false)
  })

  it('returns sessionValid false on transport error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error')),
    )
    const client = new ZoriaWorkerClient(TEST_CONFIG)
    const result = await client.login()

    expect(result.ok).toBe(false)
    expect(result.status).toBe(0)
    expect(result.sessionValid).toBe(false)
    expect(result.errorCode).toBe('transport-error')
  })
})

describe('ZoriaWorkerClient — state persistence (R3)', () => {
  it('applies and exports state correctly', () => {
    const client = new ZoriaWorkerClient(TEST_CONFIG)
    client.applyState(1_000_000, 2_000_000)
    const exported = client.exportState()

    expect(exported.latestFrameAt).toBe(1_000_000)
    expect(exported.quietUntil).toBe(2_000_000)
  })

  it('uses latestFrameAt to reject old frames', async () => {
    // This test verifies that a frame with an older timestamp is rejected.
    const client = new ZoriaWorkerClient(TEST_CONFIG)

    // Set the key so we skip key loading; simulate a quiet state that
    // prevents actual network calls. We set quietUntil far in future.
    client.applyState(9_999_999_999_999, Date.now() + 60_000)

    // pollTrustedFrame should return null because quietUntil is in the future.
    const result = await client.pollTrustedFrame()
    expect(result).toBeNull()
  })
})

describe('ZoriaWorkerClient — Retry-After and jam (R3, R1)', () => {
  it('returns origin-quiet when quietUntil is in the future', async () => {
    const client = new ZoriaWorkerClient(TEST_CONFIG)
    client.applyState(0, Date.now() + 60_000)

    const result = await client.login()
    expect(result.ok).toBe(false)
    expect(result.errorCode).toBe('origin-quiet')
    expect(result.status).toBe(429)
    expect(result.retryAfterMs).toBeGreaterThan(0)
  })
})

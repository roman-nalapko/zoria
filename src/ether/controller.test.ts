import { describe, expect, it, vi } from 'vitest'
import type { RawApiResponse } from '../api/transport'
import { TRAINING_ETHER_KEY_FINGERPRINT } from '../config/environment'
import { EtherController, type EtherTransport } from './controller'

const TRAINING_KEY = JSON.stringify({
  algorithm: 'Ed25519',
  publicKey: 'GQgsc8G1w5aXEnExpTBE597_7acc0vGKMAT5wUW4L5g',
  fingerprint: TRAINING_ETHER_KEY_FINGERPRINT,
  key: 'f3a436df65614f08',
})

const FRAME_A =
  '{"frame":"{\\"v\\":1,\\"kind\\":\\"signal\\",\\"station\\":\\"zoria\\",\\"at\\":\\"2026-09-24T03:00:00.000Z\\",\\"phase\\":\\"static\\",\\"window\\":null,\\"harbinger\\":{\\"opensIn\\":21600,\\"text\\":{\\"uk\\":\\"...тріск... у шумі несуча... слабка, рівна... хтось тримає канал...\\",\\"ru\\":\\"...треск... в шуме несущая... слабая, ровная... кто-то держит канал...\\"}},\\"fragment\\":{\\"n\\":3,\\"of\\":12,\\"text\\":\\"навчальний уривок\\"},\\"onAir\\":0}","seal":"NEcYfpe3oNX3SMBFWWFgWbkhLGKIoLELoaQn62BtuElLU213zmgzXBUPtQbJMhGf4jxbPjIf9oKXIFOpuYrgCw","key":"f3a436df65614f08"}'

function response(
  body: string,
  options: Partial<RawApiResponse> = {},
): RawApiResponse {
  return {
    body,
    error: null,
    headers: new Headers(),
    ok: true,
    requestId: null,
    retryAfterMs: null,
    status: 200,
    ...options,
  }
}

function queuedTransport(responses: RawApiResponse[]): EtherTransport & {
  request: ReturnType<typeof vi.fn<(path: string) => Promise<RawApiResponse>>>
} {
  const request = vi.fn<(path: string) => Promise<RawApiResponse>>(() => {
    const next = responses.shift()
    if (!next) return Promise.reject(new Error('No queued response'))
    return Promise.resolve(next)
  })
  return {
    request,
  }
}

describe('EtherController', () => {
  it('publishes only a frame verified with the pinned key', async () => {
    const transport = queuedTransport([
      response(TRAINING_KEY),
      response(FRAME_A),
    ])
    const controller = new EtherController(
      transport,
      TRAINING_ETHER_KEY_FINGERPRINT,
      { now: () => Date.parse('2026-09-24T03:00:01.000Z') },
    )

    await controller.refresh()

    expect(transport.request.mock.calls.map(([path]) => path)).toEqual([
      '/ether/key',
      '/ether',
    ])
    expect(controller.getSnapshot()).toMatchObject({
      frame: { phase: 'static', station: 'zoria' },
      keyFingerprint: TRAINING_ETHER_KEY_FINGERPRINT,
      message: null,
      status: 'signal',
    })
  })

  it('rejects an unpinned key without requesting the ether', async () => {
    const candidate = JSON.parse(TRAINING_KEY) as Record<string, unknown>
    candidate.fingerprint = '0'.repeat(64)
    candidate.key = '0'.repeat(16)
    const transport = queuedTransport([response(JSON.stringify(candidate))])
    const controller = new EtherController(
      transport,
      TRAINING_ETHER_KEY_FINGERPRINT,
    )

    await controller.refresh()

    expect(transport.request.mock.calls).toHaveLength(1)
    expect(controller.getSnapshot()).toMatchObject({
      frame: null,
      message: 'untrusted-ether-key',
      status: 'noise',
    })
  })

  it('surfaces a jam as a quiet period instead of parsing it as noise', async () => {
    const transport = queuedTransport([
      response(TRAINING_KEY),
      response('{"error":{"code":"jammed"}}', {
        error: {
          code: 'jammed',
          field: null,
          requestId: 'req-1',
          status: 429,
        },
        ok: false,
        requestId: 'req-1',
        retryAfterMs: 30_000,
        status: 429,
      }),
    ])
    const controller = new EtherController(
      transport,
      TRAINING_ETHER_KEY_FINGERPRINT,
    )

    await controller.refresh()

    expect(controller.getSnapshot()).toMatchObject({
      frame: null,
      message: 'jammed',
      status: 'quiet',
    })
  })

  it('shares one scheduled poll across multiple subscribers', () => {
    const setTimer = vi.fn(() => 1)
    const clearTimer = vi.fn()
    const controller = new EtherController(
      queuedTransport([]),
      TRAINING_ETHER_KEY_FINGERPRINT,
      { clearTimeout: clearTimer, setTimeout: setTimer },
    )

    const releaseA = controller.retain()
    const releaseB = controller.retain()
    expect(setTimer).toHaveBeenCalledTimes(1)

    releaseA()
    expect(clearTimer).not.toHaveBeenCalled()
    releaseB()
    expect(clearTimer).toHaveBeenCalledTimes(1)
  })
})

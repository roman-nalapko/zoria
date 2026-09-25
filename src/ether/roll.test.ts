import { describe, expect, it, vi } from 'vitest'
import { PollingCoordinator } from '../api/polling'
import {
  canPollEtherRoll,
  claimEtherRollPoll,
  fetchEtherRoll,
  type EtherRollTransport,
} from './roll'
import type { EtherKey } from './verifier'

const TRAINING_KEY: EtherKey = {
  algorithm: 'Ed25519',
  fingerprint:
    'f3a436df65614f08635f18fe0f64f145285203f1faa2905ecb25ffb90969a7de',
  key: 'f3a436df65614f08',
  publicKey: 'GQgsc8G1w5aXEnExpTBE597_7acc0vGKMAT5wUW4L5g',
}

const ROLL_FRAME =
  '{"frame":"{\\"v\\":1,\\"kind\\":\\"roll\\",\\"station\\":\\"zoria\\",\\"at\\":\\"2026-09-24T03:00:00.000Z\\",\\"phase\\":\\"window\\",\\"window\\":null,\\"harbinger\\":null,\\"fragment\\":null,\\"onAir\\":1,\\"roll\\":[{\\"at\\":\\"2026-09-24T03:00:00.000Z\\",\\"n\\":1,\\"name\\":\\"alpha\\",\\"sinceOpen\\":0}]}","seal":"rD-8uB1qg71G2P6vH_G5Q_z-3XwK0sE7wzWzVwPzXwM-3XwK0sE7wzWzVwPzXwM-3XwK0sE7wzWzVwPzXwM=","key":"f3a436df65614f08"}'

describe('ether roll service', () => {
  it('enforces 60s rate limit on roll polling', () => {
    const polling = new PollingCoordinator()
    const t0 = 1_000_000

    expect(canPollEtherRoll(polling, t0)).toBe(true)
    expect(claimEtherRollPoll(polling, t0)).toBe(true)

    // Cannot poll 30 seconds later
    expect(canPollEtherRoll(polling, t0 + 30_000)).toBe(false)
    expect(claimEtherRollPoll(polling, t0 + 30_000)).toBe(false)

    // Can poll 60 seconds later
    expect(canPollEtherRoll(polling, t0 + 60_000)).toBe(true)
    expect(claimEtherRollPoll(polling, t0 + 60_000)).toBe(true)
  })

  it('handles response errors gracefully', async () => {
    const transport: EtherRollTransport = {
      request: vi.fn().mockResolvedValue({
        body: '{"error":{"code":"not-found"}}',
        ok: false,
        status: 404,
      }),
    }

    const res = await fetchEtherRoll(transport, TRAINING_KEY)
    expect(res.entries).toEqual([])
    expect(res.error).toBe('http-404')
  })

  it('rejects forged roll envelope without crashing', async () => {
    const transport: EtherRollTransport = {
      request: vi.fn().mockResolvedValue({
        body: ROLL_FRAME,
        ok: true,
        status: 200,
      }),
    }

    const res = await fetchEtherRoll(transport, TRAINING_KEY)
    expect(res.entries).toEqual([])
    expect(res.error).toContain('unverified-envelope')
  })
})

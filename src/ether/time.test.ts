import { describe, expect, it } from 'vitest'
import type { EtherFrame } from './verifier'
import { deriveEtherTiming, formatCountdown } from './time'

const baseFrame: EtherFrame = {
  at: '2026-09-24T03:00:00.000Z',
  fragment: null,
  harbinger: { opensIn: 21_600, text: { uk: 'x', en: 'x' } },
  kind: 'signal',
  onAir: 0,
  phase: 'static',
  station: 'zoria',
  v: 1,
  window: null,
}

describe('ether time', () => {
  it('derives server offset and harbinger opening from the signed frame', () => {
    const frameAt = Date.parse(baseFrame.at)
    expect(deriveEtherTiming(baseFrame, frameAt - 4000)).toEqual({
      closesAtMs: null,
      opensAtMs: frameAt + 21_600_000,
      serverOffsetMs: 4000,
    })
  })

  it('formats a non-negative countdown', () => {
    expect(formatCountdown(90_061_000, 0)).toBe('1d 01:01:01')
    expect(formatCountdown(0, 1000)).toBe('00:00:00')
  })
})

import { describe, expect, it } from 'vitest'
import {
  fullJitterDelayMs,
  OriginQuietPeriod,
  parseRetryAfterMs,
} from './retry'

describe('retry timing', () => {
  it('parses seconds and HTTP dates', () => {
    expect(parseRetryAfterMs('5', 0)).toBe(5000)
    expect(parseRetryAfterMs('Thu, 01 Jan 1970 00:00:10 GMT', 4000)).toBe(6000)
    expect(parseRetryAfterMs('invalid', 0)).toBeNull()
  })

  it('uses full jitter capped at sixty seconds', () => {
    expect(fullJitterDelayMs(0, () => 0.5)).toBe(500)
    expect(fullJitterDelayMs(10, () => 0.5)).toBe(30_000)
  })

  it('never shortens an active quiet period', () => {
    const quiet = new OriginQuietPeriod()
    quiet.silenceFor(30_000, 1000)
    quiet.silenceFor(5000, 2000)
    expect(quiet.untilMs).toBe(31_000)
    expect(quiet.remainingMs(4000)).toBe(27_000)
  })
})

import { describe, expect, it } from 'vitest'
import { initialEtherState, reduceVerifiedFrame } from './state'
import type { EtherFrame } from './verifier'

function frame(at: string, phase: EtherFrame['phase']): EtherFrame {
  return {
    at,
    fragment: null,
    harbinger: null,
    kind: 'signal',
    onAir: 0,
    phase,
    station: 'zoria',
    v: 1,
    window: null,
  }
}

describe('reduceVerifiedFrame', () => {
  it('does not let an older signed echo roll state back', () => {
    const current = reduceVerifiedFrame(
      initialEtherState,
      frame('2026-09-24T09:00:00.000Z', 'window'),
    ).state
    const stale = reduceVerifiedFrame(
      current,
      frame('2026-09-24T08:59:59.000Z', 'static'),
    )

    expect(stale.accepted).toBe(false)
    expect(stale.state.frame?.phase).toBe('window')
  })
})

import { describe, expect, it } from 'vitest'
import { calculateDrawSalt, DrawPrng, shuffleParticipants } from './draw.js'

describe('Verifiable Draw (Appendix A)', () => {
  it('calculates salt from secret and round randomness', () => {
    const secret = '00'.repeat(32)
    const randomness = '11'.repeat(32)
    const salt = calculateDrawSalt(secret, randomness)
    expect(salt).toHaveLength(64)
    expect(/^[0-9a-f]{64}$/.test(salt)).toBe(true)
  })

  it('rejects invalid secret or randomness lengths', () => {
    expect(() => calculateDrawSalt('abc', '123')).toThrow()
  })

  it('generates deterministic integers from salt', () => {
    const prng1 = new DrawPrng('test-salt-123')
    const prng2 = new DrawPrng('test-salt-123')

    const seq1 = [prng1.nextInt(10), prng1.nextInt(50), prng1.nextInt(100)]
    const seq2 = [prng2.nextInt(10), prng2.nextInt(50), prng2.nextInt(100)]

    expect(seq1).toEqual(seq2)
  })

  it('deterministic shuffle on participant list', () => {
    const participants = ['charlie', 'alice', 'bob', 'david', 'roman-nalapko']
    const salt = 'a'.repeat(64)

    const result1 = shuffleParticipants(participants, salt)
    const result2 = shuffleParticipants(participants, salt)

    expect(result1).toEqual(result2)
    expect(result1).toHaveLength(participants.length)
    expect(new Set(result1)).toEqual(new Set(participants))
  })
})

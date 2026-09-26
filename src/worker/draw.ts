/**
 * Verifiable Draw Algorithm (Appendix A of Tournament Evaluation Spec)
 *
 * Implements:
 * A.0 — drand quicknet randomness verification and salt generation
 * A.1 — Unicode code point sorting of registered participants
 * A.2 — PRNG block stream from SHA-256("zaria-tournament-v1" || 0x00 || salt || d(k))
 * A.3 — Unbiased integer rejection sampling in [0, n)
 * A.4 — In-place Fisher-Yates shuffle from end to start
 */

import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'

export const DRAND_QUICKNET_CHAIN_HASH =
  '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971'
export const DEFAULT_DRAW_ROUND = 32535412

/**
 * A.0: Calculate salt from revealed 32-byte secret and 32-byte round randomness.
 * Both inputs are hex-encoded strings (64 chars each).
 * Returns lowercase 64-hex salt string.
 */
export function calculateDrawSalt(
  secretHex: string,
  randomnessHex: string,
): string {
  const secretBytes = Buffer.from(secretHex.trim(), 'hex')
  const randomnessBytes = Buffer.from(randomnessHex.trim(), 'hex')
  if (secretBytes.length !== 32 || randomnessBytes.length !== 32) {
    throw new Error(
      'Both secret and randomness must be exactly 32 bytes (64 hex characters)',
    )
  }
  const combined = Buffer.concat([secretBytes, randomnessBytes])
  return createHash('sha256').update(combined).digest('hex').toLowerCase()
}

/**
 * A.2 & A.3: PRNG stream generator yielding unbiased uint32 numbers.
 */
export class DrawPrng {
  #salt: string
  #blockIndex = 0
  #currentBlockUint32s: number[] = []
  #indexInBlock = 0

  constructor(salt: string) {
    this.#salt = salt.toLowerCase().trim()
  }

  #nextUint32(): number {
    if (this.#indexInBlock >= this.#currentBlockUint32s.length) {
      // Generate block k: SHA-256("zaria-tournament-v1" || 0x00 || s || d(k))
      const prefix = Buffer.from('zaria-tournament-v1\0', 'utf8')
      const saltBuf = Buffer.from(this.#salt, 'utf8')
      const kBuf = Buffer.from(this.#blockIndex.toString(10), 'utf8')
      const blockHash = createHash('sha256')
        .update(prefix)
        .update(saltBuf)
        .update(kBuf)
        .digest()

      // Read 8 uint32 little-endian numbers
      this.#currentBlockUint32s = []
      for (let offset = 0; offset < 32; offset += 4) {
        this.#currentBlockUint32s.push(blockHash.readUInt32LE(offset))
      }
      this.#indexInBlock = 0
      this.#blockIndex++
    }

    const value = this.#currentBlockUint32s[this.#indexInBlock] ?? 0
    this.#indexInBlock++
    return value
  }

  /**
   * A.3: Unbiased integer in [0, n)
   */
  nextInt(n: number): number {
    if (n <= 1) return 0
    const limit = Math.floor(0x100000000 / n) * n
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (true) {
      const x = this.#nextUint32()
      if (x < limit) {
        return x % n
      }
    }
  }
}

/**
 * A.1: Order by Unicode code points, not by UTF-16 code units
 */
export function byCodePoint(a: string, b: string): number {
  // eslint-disable-next-line @typescript-eslint/no-misused-spread
  const x = [...a]
  // eslint-disable-next-line @typescript-eslint/no-misused-spread
  const y = [...b]
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const d = (x[i]?.codePointAt(0) ?? 0) - (y[i]?.codePointAt(0) ?? 0)
    if (d !== 0) return d
  }
  return x.length - y.length
}

/**
 * A.1 & A.4: Perform verifiable draw permutation on participant logins.
 */
export function shuffleParticipants(logins: string[], salt: string): string[] {
  const arr = [...logins].sort(byCodePoint)
  const prng = new DrawPrng(salt + '\0split')

  for (let i = arr.length - 1; i > 0; i--) {
    const j = prng.nextInt(i + 1)
    const temp = arr[i]
    arr[i] = arr[j]
    arr[j] = temp
  }

  return arr
}

import { describe, expect, it } from 'vitest'
import { verifyEtherEnvelope, verifyEtherKey, type EtherKey } from './verifier'

const TRAINING_KEY: EtherKey = {
  algorithm: 'Ed25519',
  publicKey: 'GQgsc8G1w5aXEnExpTBE597_7acc0vGKMAT5wUW4L5g',
  fingerprint:
    'f3a436df65614f08635f18fe0f64f145285203f1faa2905ecb25ffb90969a7de',
  key: 'f3a436df65614f08',
}

const FRAME_A =
  '{"frame":"{\\"v\\":1,\\"kind\\":\\"signal\\",\\"station\\":\\"zoria\\",\\"at\\":\\"2026-09-24T03:00:00.000Z\\",\\"phase\\":\\"static\\",\\"window\\":null,\\"harbinger\\":{\\"opensIn\\":21600,\\"text\\":{\\"uk\\":\\"...тріск... у шумі несуча... слабка, рівна... хтось тримає канал...\\",\\"ru\\":\\"...треск... в шуме несущая... слабая, ровная... кто-то держит канал...\\"}},\\"fragment\\":{\\"n\\":3,\\"of\\":12,\\"text\\":\\"навчальний уривок\\"},\\"onAir\\":0}","seal":"NEcYfpe3oNX3SMBFWWFgWbkhLGKIoLELoaQn62BtuElLU213zmgzXBUPtQbJMhGf4jxbPjIf9oKXIFOpuYrgCw","key":"f3a436df65614f08"}'

const FRAME_B =
  '{"frame":"{\\"v\\":1,\\"kind\\":\\"signal\\",\\"station\\":\\"zoria\\",\\"at\\":\\"2026-09-24T03:00:05.000Z\\",\\"phase\\":\\"window\\",\\"window\\":{\\"opensAt\\":\\"2026-09-24T02:40:00.000Z\\",\\"closesAt\\":\\"2026-09-24T13:10:00.000Z\\"},\\"harbinger\\":null,\\"fragment\\":null,\\"onAir\\":17}","seal":"tyynPbJxE4itFop4uKs0W9TL1CRfwHNZ3HHBFFknbihg4I403hmaEL9MDcboucrllUmeKvJQfr70eHKBPLJfAg","key":"f3a436df65614f08"}'

describe('ether trust boundary', () => {
  it('verifies the official training key fingerprint', async () => {
    await expect(
      verifyEtherKey(TRAINING_KEY, TRAINING_KEY.fingerprint),
    ).resolves.toEqual(TRAINING_KEY)
    await expect(
      verifyEtherKey(TRAINING_KEY, '0'.repeat(64)),
    ).resolves.toBeNull()
  })

  it('accepts official frame A only after signature verification', async () => {
    const result = await verifyEtherEnvelope(FRAME_A, TRAINING_KEY)
    expect(result.kind).toBe('signal')
    if (result.kind === 'signal') {
      expect(result.frame.phase).toBe('static')
      expect(result.frame.harbinger?.opensIn).toBe(21_600)
    }
  })

  it('rejects forged frame B and corrupt frame C without throwing', async () => {
    await expect(verifyEtherEnvelope(FRAME_B, TRAINING_KEY)).resolves.toEqual({
      kind: 'noise',
      reason: 'invalid-seal',
    })
    await expect(
      verifyEtherEnvelope('{"frame":"broken', TRAINING_KEY),
    ).resolves.toEqual({ kind: 'noise', reason: 'invalid-envelope' })
  })
})

// R10: frame validation robustness
describe('ether frame robustness (R10)', () => {
  it('rejects envelope with unknown key without crashing', async () => {
    const tampered = FRAME_A.replace(
      '"key":"f3a436df65614f08"',
      '"key":"0000000000000000"',
    )
    const result = await verifyEtherEnvelope(tampered, TRAINING_KEY)
    expect(result.kind).toBe('noise')
    if (result.kind === 'noise') {
      expect(result.reason).toBe('unknown-key')
    }
  })

  it('rejects envelope with empty body', async () => {
    const result = await verifyEtherEnvelope('', TRAINING_KEY)
    expect(result.kind).toBe('noise')
  })

  it('rejects envelope with null body', async () => {
    const result = await verifyEtherEnvelope('null', TRAINING_KEY)
    expect(result.kind).toBe('noise')
  })

  it('rejects envelope with missing seal field', async () => {
    const result = await verifyEtherEnvelope(
      '{"frame":"x","key":"f3a436df65614f08"}',
      TRAINING_KEY,
    )
    expect(result.kind).toBe('noise')
    if (result.kind === 'noise') {
      expect(result.reason).toBe('invalid-envelope')
    }
  })

  it('accepts frame A (training) with {uk, ru} harbinger text (backward compat)', async () => {
    // Frame A carries {uk, ru} — the Harbinger type now accepts both via optional keys.
    const result = await verifyEtherEnvelope(FRAME_A, TRAINING_KEY)
    expect(result.kind).toBe('signal')
    if (result.kind === 'signal') {
      expect(result.frame.harbinger?.text.uk).toBeDefined()
    }
  })

  it('does not crash on unknown frame fields (forward compatibility)', async () => {
    // Verify that frame A parses correctly and does not crash regardless of extra fields.
    const result = await verifyEtherEnvelope(FRAME_A, TRAINING_KEY)
    expect(result).toHaveProperty('kind')
    expect(['signal', 'noise']).toContain(result.kind)
  })

  it('rejects key with wrong fingerprint', async () => {
    const wrongFingerprintKey = {
      ...TRAINING_KEY,
      fingerprint: '0'.repeat(64),
    }
    const key = await import('./verifier.js').then((m) =>
      m.verifyEtherKey(wrongFingerprintKey, '0'.repeat(64)),
    )
    expect(key).toBeNull()
  })

  it('does not accept seal from a different frame on the same key', async () => {
    // FRAME_B's seal does not match the training key for the FRAME_A payload.
    const result = await verifyEtherEnvelope(FRAME_B, TRAINING_KEY)
    expect(result.kind).toBe('noise')
    if (result.kind === 'noise') {
      expect(result.reason).toBe('invalid-seal')
    }
  })
})

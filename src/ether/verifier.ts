export interface EtherKey {
  algorithm: 'Ed25519'
  fingerprint: string
  key: string
  publicKey: string
}

export interface EtherEnvelope {
  frame: string
  key: string
  seal: string
}

export interface EtherWindow {
  closesAt: string
  opensAt: string
}

export interface Harbinger {
  opensIn: number
  text: {
    ru: string
    uk: string
  }
}

export interface EtherFragment {
  n: number
  of: number
  text: string
}

export interface RollEntry {
  at: string
  n: number
  name: string
  sinceOpen: number
}

export interface EtherFrame {
  at: string
  fragment: EtherFragment | null
  harbinger: Harbinger | null
  kind: 'signal' | 'roll'
  onAir: number
  phase: 'static' | 'window' | 'after'
  roll?: RollEntry[]
  station: 'zoria'
  v: 1
  window: EtherWindow | null
}

export type EtherVerificationResult =
  | { kind: 'signal'; envelope: EtherEnvelope; frame: EtherFrame }
  | { kind: 'noise'; reason: string }

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/
const HEX_16_PATTERN = /^[a-f0-9]{16}$/
const HEX_64_PATTERN = /^[a-f0-9]{64}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  if (!BASE64URL_PATTERN.test(value)) return null

  try {
    const padding = '='.repeat((4 - (value.length % 4)) % 4)
    const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/') + padding)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index)
    }
    return bytes
  } catch {
    return null
  }
}

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function parseEnvelope(rawBody: string): EtherEnvelope | null {
  try {
    const value: unknown = JSON.parse(rawBody)
    if (
      !isRecord(value) ||
      typeof value.frame !== 'string' ||
      typeof value.seal !== 'string' ||
      typeof value.key !== 'string' ||
      !HEX_16_PATTERN.test(value.key) ||
      fromBase64Url(value.seal)?.length !== 64
    ) {
      return null
    }
    return { frame: value.frame, key: value.key, seal: value.seal }
  } catch {
    return null
  }
}

function parseFrame(frameJson: string): EtherFrame | null {
  try {
    const value: unknown = JSON.parse(frameJson)
    if (
      !isRecord(value) ||
      value.v !== 1 ||
      value.station !== 'zoria' ||
      (value.kind !== 'signal' && value.kind !== 'roll') ||
      (value.phase !== 'static' &&
        value.phase !== 'window' &&
        value.phase !== 'after') ||
      !isIsoDate(value.at) ||
      !Number.isInteger(value.onAir) ||
      (value.window !== null && !isRecord(value.window)) ||
      (value.harbinger !== null && !isRecord(value.harbinger)) ||
      (value.fragment !== null && !isRecord(value.fragment))
    ) {
      return null
    }

    return value as unknown as EtherFrame
  } catch {
    return null
  }
}

export async function verifyEtherKey(
  candidate: unknown,
  expectedFingerprint: string,
): Promise<EtherKey | null> {
  if (
    !isRecord(candidate) ||
    candidate.algorithm !== 'Ed25519' ||
    typeof candidate.key !== 'string' ||
    typeof candidate.publicKey !== 'string' ||
    typeof candidate.fingerprint !== 'string' ||
    !HEX_16_PATTERN.test(candidate.key) ||
    !HEX_64_PATTERN.test(candidate.fingerprint) ||
    candidate.fingerprint !== expectedFingerprint.toLowerCase() ||
    candidate.key !== candidate.fingerprint.slice(0, 16)
  ) {
    return null
  }

  const publicKeyBytes = fromBase64Url(candidate.publicKey)
  if (publicKeyBytes?.length !== 32) return null

  const calculated = toHex(
    await crypto.subtle.digest('SHA-256', publicKeyBytes),
  )
  if (calculated !== candidate.fingerprint) return null

  return {
    algorithm: 'Ed25519',
    fingerprint: candidate.fingerprint,
    key: candidate.key,
    publicKey: candidate.publicKey,
  }
}

export async function verifyEtherEnvelope(
  rawBody: string,
  key: EtherKey,
): Promise<EtherVerificationResult> {
  const envelope = parseEnvelope(rawBody)
  if (!envelope) return { kind: 'noise', reason: 'invalid-envelope' }
  if (envelope.key !== key.key) return { kind: 'noise', reason: 'unknown-key' }

  const publicKeyBytes = fromBase64Url(key.publicKey)
  const sealBytes = fromBase64Url(envelope.seal)
  if (publicKeyBytes?.length !== 32 || sealBytes?.length !== 64) {
    return { kind: 'noise', reason: 'invalid-key-or-seal' }
  }

  try {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      publicKeyBytes,
      { name: 'Ed25519' },
      false,
      ['verify'],
    )
    const verified = await crypto.subtle.verify(
      { name: 'Ed25519' },
      cryptoKey,
      sealBytes,
      new TextEncoder().encode(envelope.frame),
    )
    if (!verified) return { kind: 'noise', reason: 'invalid-seal' }
  } catch {
    return { kind: 'noise', reason: 'verification-failed' }
  }

  const frame = parseFrame(envelope.frame)
  if (!frame) return { kind: 'noise', reason: 'invalid-frame' }

  return { kind: 'signal', envelope, frame }
}

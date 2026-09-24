import type { EtherFrame, EtherKey } from '../ether/verifier.js'
import { verifyEtherEnvelope, verifyEtherKey } from '../ether/verifier.js'
import type { WorkerConfig } from './config.js'

export interface SafeApiResult {
  errorCode: string | null
  ok: boolean
  requestId: string | null
  retryAfterMs: number | null
  status: number
}

export class ZoriaWorkerClient {
  readonly #config: WorkerConfig
  #key: EtherKey | null = null
  #latestFrameAt = 0
  #quietUntil = 0

  constructor(config: WorkerConfig) {
    this.#config = config
  }

  async pollTrustedFrame(): Promise<EtherFrame | null> {
    if (Date.now() < this.#quietUntil) return null
    const key = this.#key ?? (await this.#loadKey())
    if (!key) return null

    const response = await this.#request('/ether', false)
    if (!response.ok || response.rawBody === null) return null
    const verified = await verifyEtherEnvelope(response.rawBody, key)
    if (verified.kind !== 'signal') return null

    const frameAt = Date.parse(verified.frame.at)
    if (frameAt <= this.#latestFrameAt) return null
    this.#latestFrameAt = frameAt
    return verified.frame
  }

  async login(): Promise<SafeApiResult> {
    return this.#publicResult(
      await this.#request('/auth/login', true, {
        password: this.#config.password,
        username: this.#config.username,
      }),
    )
  }

  async register(): Promise<SafeApiResult> {
    return this.#publicResult(
      await this.#request('/auth/register', true, {
        displayName: this.#config.displayName,
        invitation: this.#config.invitation,
        lang: 'uk',
        password: this.#config.password,
        repositoryUrl: this.#config.repositoryUrl,
        username: this.#config.username,
      }),
    )
  }

  async #loadKey(): Promise<EtherKey | null> {
    const response = await this.#request('/ether/key', false)
    if (!response.ok || response.rawBody === null) return null
    try {
      const key = await verifyEtherKey(
        JSON.parse(response.rawBody) as unknown,
        this.#config.etherKeyFingerprint,
      )
      if (key) this.#key = key
      return key
    } catch {
      return null
    }
  }

  #publicResult(result: InternalApiResult): SafeApiResult {
    return {
      errorCode: result.errorCode,
      ok: result.ok,
      requestId: result.requestId,
      retryAfterMs: result.retryAfterMs,
      status: result.status,
    }
  }

  async #request(
    path: string,
    isAuthenticationRequest: boolean,
    body?: unknown,
  ): Promise<InternalApiResult> {
    if (Date.now() < this.#quietUntil) return quietResult(this.#quietUntil)
    try {
      const response = await fetch(`${this.#config.apiUrl}${path}`, {
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: 'omit',
        headers:
          body === undefined
            ? undefined
            : { 'content-type': 'application/json' },
        method: body === undefined ? 'GET' : 'POST',
        signal: AbortSignal.timeout(12_000),
      })
      const rawBody = await response.text()
      const retryAfterMs = parseRetryAfter(response.headers.get('retry-after'))
      let errorCode: string | null = null
      try {
        const parsed = JSON.parse(rawBody) as { error?: { code?: unknown } }
        if (typeof parsed.error?.code === 'string')
          errorCode = parsed.error.code
      } catch {
        // Arbitrary bodies are expected before the verified window.
      }

      if (response.status === 429 && retryAfterMs !== null) {
        this.#quietUntil = Date.now() + retryAfterMs
      }
      return {
        errorCode,
        ok: response.ok,
        rawBody: isAuthenticationRequest ? null : rawBody,
        requestId: response.headers.get('x-request-id'),
        retryAfterMs,
        status: response.status,
      }
    } catch {
      return {
        errorCode: 'transport-error',
        ok: false,
        rawBody: null,
        requestId: null,
        retryAfterMs: null,
        status: 0,
      }
    }
  }
}

interface InternalApiResult extends SafeApiResult {
  rawBody: string | null
}

function quietResult(quietUntil: number): InternalApiResult {
  return {
    errorCode: 'origin-quiet',
    ok: false,
    rawBody: null,
    requestId: null,
    retryAfterMs: Math.max(0, quietUntil - Date.now()),
    status: 429,
  }
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000
  const date = Date.parse(value)
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now())
}

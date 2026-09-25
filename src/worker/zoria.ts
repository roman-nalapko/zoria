import type { EtherFrame, EtherKey } from '../ether/verifier.js'
import { verifyEtherEnvelope, verifyEtherKey } from '../ether/verifier.js'
import type { WorkerConfig } from './config.js'

export interface SafeApiResult {
  errorCode: string | null
  ok: boolean
  /** True only when a valid session for the configured username was confirmed. */
  sessionValid: boolean
  requestId: string | null
  retryAfterMs: number | null
  status: number
}

export interface RepositoryStatus {
  accessStatus: string | null
  reason: string | null
  reasonCode: string | null
  checkedAt: string | null
}

export class ZoriaWorkerClient {
  readonly #config: WorkerConfig
  #key: EtherKey | null = null
  #latestFrameAt = 0
  #quietUntil = 0

  constructor(config: WorkerConfig) {
    this.#config = config
  }

  /** Restore persisted non-secret timing state from the caller. */
  applyState(latestFrameAt: number, quietUntil: number): void {
    this.#latestFrameAt = latestFrameAt
    this.#quietUntil = Math.max(this.#quietUntil, quietUntil)
  }

  /** Export current non-secret timing state for persistence. */
  exportState(): { latestFrameAt: number; quietUntil: number } {
    return { latestFrameAt: this.#latestFrameAt, quietUntil: this.#quietUntil }
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

  /**
   * Attempt login and validate the response body.
   * Returns sessionValid=true only when the server returns a valid session
   * for the configured username.
   */
  async login(): Promise<SafeApiResult> {
    const internal = await this.#request('/auth/login', true, {
      password: this.#config.password,
      username: this.#config.username,
    })
    return this.#publicResult(
      internal,
      internal.rawBody ? this.#validateSession(internal.rawBody) : false,
    )
  }

  /**
   * Attempt registration and validate the response body.
   * Returns sessionValid=true only when the server confirms registration with
   * a valid session for the configured username.
   */
  async register(): Promise<SafeApiResult> {
    const internal = await this.#request('/auth/register', true, {
      displayName: this.#config.displayName,
      invitation: this.#config.invitation,
      lang: 'uk',
      password: this.#config.password,
      repositoryUrl: this.#config.repositoryUrl,
      username: this.#config.username,
    })
    return this.#publicResult(
      internal,
      internal.rawBody ? this.#validateSession(internal.rawBody) : false,
    )
  }

  /**
   * Log in and retrieve the participant repository admission status.
   * Extracts the bearer token in memory, performs GET /me/repository,
   * and discards the token. Never logs or persists bearer token.
   */
  async checkMyRepository(): Promise<RepositoryStatus | null> {
    const internal = await this.#request('/auth/login', true, {
      password: this.#config.password,
      username: this.#config.username,
    })
    if (!internal.ok || !internal.rawBody) return null
    if (!this.#validateSession(internal.rawBody)) return null
    const token = this.extractBearerToken(internal.rawBody)
    if (!token) return null
    return this.getRepositoryStatus(token)
  }

  /**
   * Query /me/repository with a confirmed session.
   * Session token must have been confirmed by login/register returning
   * sessionValid=true. We pass the bearer value from environment for
   * this request; we never log it.
   *
   * Returns null on transport failure or missing session.
   */
  async getRepositoryStatus(
    bearerToken: string,
  ): Promise<RepositoryStatus | null> {
    if (!bearerToken) return null
    const internal = await this.#requestWithBearer(
      '/me/repository',
      bearerToken,
    )
    if (!internal.ok || internal.rawBody === null) return null
    try {
      const parsed: unknown = JSON.parse(internal.rawBody)
      if (typeof parsed !== 'object' || parsed === null) return null
      const root = parsed as Record<string, unknown>
      const obj =
        typeof root.repository === 'object' && root.repository !== null
          ? (root.repository as Record<string, unknown>)
          : root
      return {
        accessStatus:
          typeof obj.accessStatus === 'string' ? obj.accessStatus : null,
        reason: typeof obj.reason === 'string' ? obj.reason : null,
        reasonCode: typeof obj.reasonCode === 'string' ? obj.reasonCode : null,
        checkedAt: typeof obj.checkedAt === 'string' ? obj.checkedAt : null,
      }
    } catch {
      return null
    }
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

  /**
   * Validate that the response body is parseable JSON with a token/session
   * and that the session belongs to the configured username.
   * Never surfaces token value in logs or return values.
   */
  #validateSession(rawBody: string): boolean {
    try {
      const parsed: unknown = JSON.parse(rawBody)
      if (typeof parsed !== 'object' || parsed === null) return false
      const obj = parsed as Record<string, unknown>

      // The API may return { token } or { session: { token } } or similar.
      // We require a non-empty token/session field.
      const hasToken =
        (typeof obj.token === 'string' && obj.token.length > 0) ||
        (typeof obj.session === 'object' &&
          obj.session !== null &&
          typeof (obj.session as Record<string, unknown>).token === 'string' &&
          ((obj.session as Record<string, unknown>).token as string).length > 0)

      if (!hasToken) return false

      // Verify identity: username in response must match configured username.
      const username =
        typeof obj.username === 'string'
          ? obj.username
          : typeof obj.user === 'object' &&
              obj.user !== null &&
              typeof (obj.user as Record<string, unknown>).username === 'string'
            ? ((obj.user as Record<string, unknown>).username as string)
            : null

      if (username === null) return false
      return username.toLowerCase() === this.#config.username.toLowerCase()
    } catch {
      return false
    }
  }

  /**
   * Extract a bearer token from a successful auth response body.
   * Returns empty string if no valid token found; NEVER logs the value.
   */
  extractBearerToken(rawBody: string): string {
    try {
      const parsed: unknown = JSON.parse(rawBody)
      if (typeof parsed !== 'object' || parsed === null) return ''
      const obj = parsed as Record<string, unknown>
      if (typeof obj.token === 'string' && obj.token.length > 0) {
        return obj.token
      }
      if (
        typeof obj.session === 'object' &&
        obj.session !== null &&
        typeof (obj.session as Record<string, unknown>).token === 'string'
      ) {
        return (obj.session as Record<string, unknown>).token as string
      }
    } catch {
      // ignore
    }
    return ''
  }

  #publicResult(
    result: InternalApiResult,
    sessionValid: boolean,
  ): SafeApiResult {
    return {
      errorCode: result.errorCode,
      ok: result.ok,
      sessionValid,
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
        // For authentication requests, keep rawBody so we can validate the session.
        // The caller is responsible for not logging rawBody.
        rawBody: isAuthenticationRequest ? rawBody : rawBody,
        requestId: response.headers.get('x-request-id'),
        retryAfterMs,
        sessionValid: false, // computed by caller via #validateSession
        status: response.status,
      }
    } catch {
      return {
        errorCode: 'transport-error',
        ok: false,
        rawBody: null,
        requestId: null,
        retryAfterMs: null,
        sessionValid: false,
        status: 0,
      }
    }
  }

  async #requestWithBearer(
    path: string,
    bearerToken: string,
  ): Promise<InternalApiResult> {
    if (Date.now() < this.#quietUntil) return quietResult(this.#quietUntil)
    try {
      const response = await fetch(`${this.#config.apiUrl}${path}`, {
        credentials: 'omit',
        headers: {
          // Token is passed but never logged; suppress linter warning with cast.
          authorization: `Bearer ${bearerToken}`,
        },
        method: 'GET',
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
        // ignore
      }
      return {
        errorCode,
        ok: response.ok,
        rawBody,
        requestId: response.headers.get('x-request-id'),
        retryAfterMs,
        sessionValid: false,
        status: response.status,
      }
    } catch {
      return {
        errorCode: 'transport-error',
        ok: false,
        rawBody: null,
        requestId: null,
        retryAfterMs: null,
        sessionValid: false,
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
    sessionValid: false,
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

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

export interface SummaryStatus {
  unread: number
  releasedStages: number
  acknowledgedStages: number
  latestNews: string | null
  repositoryAt: string | null
  serverTime: string
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

  /**
   * Log in and retrieve the participant summary (/me/summary).
   * Extracts the bearer token in memory, performs GET /me/summary,
   * and discards the token. Never logs or persists bearer token.
   */
  async checkMySummary(): Promise<SummaryStatus | null> {
    const internal = await this.#request('/auth/login', true, {
      password: this.#config.password,
      username: this.#config.username,
    })
    if (!internal.ok || !internal.rawBody) return null
    if (!this.#validateSession(internal.rawBody)) return null
    const token = this.extractBearerToken(internal.rawBody)
    if (!token) return null
    return this.getSummary(token)
  }

  /**
   * Query /me/summary with a confirmed session.
   * Returns null on transport failure or missing session.
   */
  async getSummary(bearerToken: string): Promise<SummaryStatus | null> {
    if (!bearerToken) return null
    const internal = await this.#requestWithBearer('/me/summary', bearerToken)
    if (!internal.ok || internal.rawBody === null) return null
    try {
      const parsed: unknown = JSON.parse(internal.rawBody)
      if (typeof parsed !== 'object' || parsed === null) return null
      const obj = parsed as Record<string, unknown>
      return {
        acknowledgedStages:
          typeof obj.acknowledgedStages === 'number'
            ? obj.acknowledgedStages
            : 0,
        latestNews: typeof obj.latestNews === 'string' ? obj.latestNews : null,
        releasedStages:
          typeof obj.releasedStages === 'number' ? obj.releasedStages : 0,
        repositoryAt:
          typeof obj.repositoryAt === 'string' ? obj.repositoryAt : null,
        serverTime:
          typeof obj.serverTime === 'string'
            ? obj.serverTime
            : new Date().toISOString(),
        unread: typeof obj.unread === 'number' ? obj.unread : 0,
      }
    } catch {
      return null
    }
  }

  /**
   * Log in and retrieve the participant inbox messages (/inbox).
   * Extracts bearer token in memory, performs GET /inbox, and discards token.
   */
  async checkMyInbox(): Promise<Array<{
    id: string
    title: string
    readAt: string | null
    createdAt: string
  }> | null> {
    const internal = await this.#request('/auth/login', true, {
      password: this.#config.password,
      username: this.#config.username,
    })
    if (!internal.ok || !internal.rawBody) return null
    if (!this.#validateSession(internal.rawBody)) return null
    const token = this.extractBearerToken(internal.rawBody)
    if (!token) return null
    return this.getInbox(token)
  }

  /**
   * Query /inbox with a confirmed session.
   */
  async getInbox(bearerToken: string): Promise<Array<{
    id: string
    title: string
    readAt: string | null
    createdAt: string
  }> | null> {
    if (!bearerToken) return null
    const internal = await this.#requestWithBearer('/inbox', bearerToken)
    if (!internal.ok || internal.rawBody === null) return null
    try {
      const parsed: unknown = JSON.parse(internal.rawBody)
      if (typeof parsed !== 'object' || parsed === null) return null
      const obj = parsed as Record<string, unknown>
      const items = Array.isArray(obj.items) ? obj.items : []
      return items.map((item: Record<string, unknown>) => ({
        createdAt: typeof item.createdAt === 'string' ? item.createdAt : '',
        id: typeof item.id === 'string' ? item.id : '',
        readAt: typeof item.readAt === 'string' ? item.readAt : null,
        title: typeof item.title === 'string' ? item.title : '',
      }))
    } catch {
      return null
    }
  }

  /**
   * Log in and retrieve the in-memory bearer token for this cycle.
   * Returns null if login fails or session is invalid.
   */
  async obtainSessionToken(): Promise<string | null> {
    const internal = await this.#request('/auth/login', true, {
      password: this.#config.password,
      username: this.#config.username,
    })
    if (!internal.ok || !internal.rawBody) return null
    if (!this.#validateSession(internal.rawBody)) return null
    return this.extractBearerToken(internal.rawBody)
  }

  /**
   * Acknowledge letter receipt: POST /inbox/{id}/read
   */
  async markMessageRead(
    bearerToken: string,
    messageId: string,
  ): Promise<boolean> {
    if (!bearerToken || !messageId) return false
    try {
      const response = await fetch(
        `${this.#config.apiUrl}/inbox/${encodeURIComponent(messageId)}/read`,
        {
          body: JSON.stringify({}),
          credentials: 'omit',
          headers: {
            authorization: `Bearer ${bearerToken}`,
            'content-type': 'application/json',
          },
          method: 'POST',
          signal: AbortSignal.timeout(10_000),
        },
      )
      return response.ok
    } catch {
      return false
    }
  }

  /**
   * Retrieve single inbox message details.
   */
  async getMessage(
    bearerToken: string,
    messageId: string,
  ): Promise<{
    id: string
    title: string
    body: string
    createdAt: string
    readAt: string | null
  } | null> {
    if (!bearerToken || !messageId) return null
    const internal = await this.#requestWithBearer(
      `/inbox/${encodeURIComponent(messageId)}`,
      bearerToken,
    )
    if (!internal.ok || internal.rawBody === null) return null
    try {
      const parsed = JSON.parse(internal.rawBody) as Record<string, unknown>
      const msg = parsed.message as Record<string, unknown> | undefined
      if (!msg) return null
      return {
        body: typeof msg.body === 'string' ? msg.body : '',
        createdAt: typeof msg.createdAt === 'string' ? msg.createdAt : '',
        id: typeof msg.id === 'string' ? msg.id : messageId,
        readAt: typeof msg.readAt === 'string' ? msg.readAt : null,
        title: typeof msg.title === 'string' ? msg.title : '',
      }
    } catch {
      return null
    }
  }

  /**
   * Retrieve released stages.
   */
  async getStages(bearerToken: string): Promise<Array<{
    id: string
    title: string
    releasedAt: string
    acknowledgedAt: string | null
  }> | null> {
    if (!bearerToken) return null
    const internal = await this.#requestWithBearer('/stages', bearerToken)
    if (!internal.ok || internal.rawBody === null) return null
    try {
      const parsed = JSON.parse(internal.rawBody) as Record<string, unknown>
      const items = Array.isArray(parsed.items) ? parsed.items : []
      return items.map((item: Record<string, unknown>) => ({
        acknowledgedAt:
          typeof item.acknowledgedAt === 'string' ? item.acknowledgedAt : null,
        id: typeof item.id === 'string' ? item.id : '',
        releasedAt: typeof item.releasedAt === 'string' ? item.releasedAt : '',
        title: typeof item.title === 'string' ? item.title : '',
      }))
    } catch {
      return null
    }
  }

  /**
   * Acknowledge stage: POST /stages/{id}/ack
   */
  async ackStage(bearerToken: string, stageId: string): Promise<boolean> {
    if (!bearerToken || !stageId) return false
    try {
      const response = await fetch(
        `${this.#config.apiUrl}/stages/${encodeURIComponent(stageId)}/ack`,
        {
          body: JSON.stringify({}),
          credentials: 'omit',
          headers: {
            authorization: `Bearer ${bearerToken}`,
            'content-type': 'application/json',
          },
          method: 'POST',
          signal: AbortSignal.timeout(10_000),
        },
      )
      return response.ok
    } catch {
      return false
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

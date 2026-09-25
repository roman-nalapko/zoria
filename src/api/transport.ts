import { parseApiError, type ApiErrorDetails } from './errors'
import { OriginQuietPeriod, parseRetryAfterMs } from './retry'

export interface RawApiResponse {
  body: string
  error: ApiErrorDetails | null
  headers: Headers
  ok: boolean
  requestId: string | null
  retryAfterMs: number | null
  status: number
}

export interface RequestOptions {
  body?: unknown
  method?: string
  signal?: AbortSignal
  token?: string
}

export interface TransportOptions {
  fetch?: typeof fetch
  now?: () => number
  onUnauthorized?: (response: RawApiResponse) => void
  quietPeriod?: OriginQuietPeriod
  timeoutMs?: number
  tokenProvider?: () => string | null
}

export class QuietPeriodError extends Error {
  constructor(readonly remainingMs: number) {
    super(`Zoria API origin is quiet for ${remainingMs.toString()}ms`)
    this.name = 'QuietPeriodError'
  }
}

export class ApiTransport {
  readonly #baseUrl: string
  readonly #fetch: typeof fetch
  readonly #now: () => number
  readonly #quiet: OriginQuietPeriod
  readonly #timeoutMs: number
  #onUnauthorized: ((response: RawApiResponse) => void) | null = null
  #tokenProvider: (() => string | null) | null = null

  constructor(baseUrl: string, options: TransportOptions = {}) {
    this.#baseUrl = baseUrl.replace(/\/$/, '')
    this.#fetch =
      options.fetch ?? ((input, init) => globalThis.fetch(input, init))
    this.#now = options.now ?? Date.now
    this.#quiet = options.quietPeriod ?? new OriginQuietPeriod()
    this.#timeoutMs = options.timeoutMs ?? 10_000
    this.#onUnauthorized = options.onUnauthorized ?? null
    this.#tokenProvider = options.tokenProvider ?? null
  }

  setUnauthorizedHandler(
    handler: ((response: RawApiResponse) => void) | null,
  ): void {
    this.#onUnauthorized = handler
  }

  setTokenProvider(provider: (() => string | null) | null): void {
    this.#tokenProvider = provider
  }

  get quietPeriod(): OriginQuietPeriod {
    return this.#quiet
  }

  async request(
    path: string,
    options: RequestOptions = {},
  ): Promise<RawApiResponse> {
    if (!path.startsWith('/') || path.startsWith('//')) {
      throw new Error('API path must be an origin-relative path')
    }

    const remainingMs = this.#quiet.remainingMs(this.#now())
    if (remainingMs > 0) throw new QuietPeriodError(remainingMs)

    const controller = new AbortController()
    const timeout = setTimeout(() => {
      controller.abort()
    }, this.#timeoutMs)
    const abortFromCaller = () => {
      controller.abort(options.signal?.reason)
    }
    options.signal?.addEventListener('abort', abortFromCaller, { once: true })

    const token = options.token ?? this.#tokenProvider?.() ?? undefined

    const headers = new Headers({ Accept: 'application/json' })
    if (options.body !== undefined)
      headers.set('Content-Type', 'application/json')
    if (token) headers.set('Authorization', `Bearer ${token}`)

    try {
      const requestInit: RequestInit = {
        credentials: 'omit',
        headers,
        method: options.method ?? 'GET',
        signal: controller.signal,
      }
      if (options.body !== undefined) {
        requestInit.body = JSON.stringify(options.body)
      }

      const response = await this.#fetch(`${this.#baseUrl}${path}`, requestInit)
      const body = await response.text()
      const requestId = response.headers.get('X-Request-Id')
      const retryAfterMs = parseRetryAfterMs(
        response.headers.get('Retry-After'),
        this.#now(),
      )
      const error = response.ok
        ? null
        : parseApiError(response.status, body, requestId)

      if (response.status === 429 && error?.code === 'jammed') {
        this.#quiet.silenceFor(retryAfterMs ?? 30_000, this.#now())
      }

      const result: RawApiResponse = {
        body,
        error,
        headers: response.headers,
        ok: response.ok,
        requestId,
        retryAfterMs,
        status: response.status,
      }

      if (
        response.status === 401 &&
        path !== '/auth/login' &&
        path !== '/auth/register'
      ) {
        try {
          this.#onUnauthorized?.(result)
        } catch {
          // handler errors should not break transport
        }
      }

      return result
    } finally {
      clearTimeout(timeout)
      options.signal?.removeEventListener('abort', abortFromCaller)
    }
  }
}

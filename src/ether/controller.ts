import { MINIMUM_POLL_INTERVAL_MS, PollingCoordinator } from '../api/polling'
import { fullJitterDelayMs } from '../api/retry'
import { QuietPeriodError, type RawApiResponse } from '../api/transport'
import { initialEtherState, reduceVerifiedFrame } from './state'
import {
  verifyEtherEnvelope,
  verifyEtherKey,
  type EtherFrame,
  type EtherKey,
} from './verifier'

export type EtherConnectionStatus =
  'idle' | 'connecting' | 'signal' | 'noise' | 'quiet' | 'error'

export interface EtherSnapshot {
  consecutiveFailures: number
  frame: EtherFrame | null
  keyFingerprint: string | null
  lastCheckedAt: number | null
  message: string | null
  nextPollAt: number | null
  receivedAt: number | null
  status: EtherConnectionStatus
}

export interface EtherTransport {
  request(path: string): Promise<RawApiResponse>
}

export interface EtherControllerOptions {
  clearTimeout?: (handle: ReturnType<typeof setTimeout>) => void
  now?: () => number
  polling?: PollingCoordinator
  random?: () => number
  setTimeout?: (
    callback: () => void,
    delayMs: number,
  ) => ReturnType<typeof setTimeout>
}

const initialSnapshot: EtherSnapshot = Object.freeze({
  consecutiveFailures: 0,
  frame: null,
  keyFingerprint: null,
  lastCheckedAt: null,
  message: null,
  nextPollAt: null,
  receivedAt: null,
  status: 'idle',
})

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body) as unknown
  } catch {
    return null
  }
}

export class EtherController {
  readonly #transport: EtherTransport
  readonly #expectedFingerprint: string
  readonly #now: () => number
  readonly #random: () => number
  readonly #polling: PollingCoordinator
  readonly #setTimeout: NonNullable<EtherControllerOptions['setTimeout']>
  readonly #clearTimeout: NonNullable<EtherControllerOptions['clearTimeout']>
  readonly #listeners = new Set<() => void>()

  #snapshot: EtherSnapshot = initialSnapshot
  #etherState = initialEtherState
  #key: EtherKey | null = null
  #timer: ReturnType<typeof setTimeout> | null = null
  #retainCount = 0
  #running = false
  #inFlight: Promise<void> | null = null
  #suggestedDelayMs: number = MINIMUM_POLL_INTERVAL_MS.ether

  constructor(
    transport: EtherTransport,
    expectedFingerprint: string,
    options: EtherControllerOptions = {},
  ) {
    this.#transport = transport
    this.#expectedFingerprint = expectedFingerprint
    this.#now = options.now ?? Date.now
    this.#random = options.random ?? Math.random
    this.#polling = options.polling ?? new PollingCoordinator()
    this.#setTimeout =
      options.setTimeout ??
      ((callback, delayMs) => globalThis.setTimeout(callback, delayMs))
    this.#clearTimeout =
      options.clearTimeout ??
      ((handle) => {
        globalThis.clearTimeout(handle)
      })
  }

  getSnapshot = (): EtherSnapshot => this.#snapshot

  getKey = (): EtherKey | null => this.#key

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  retain = (): (() => void) => {
    this.#retainCount += 1
    if (this.#retainCount === 1) this.#schedule(0)

    let released = false
    return () => {
      if (released) return
      released = true
      this.#retainCount = Math.max(0, this.#retainCount - 1)
      if (this.#retainCount === 0) this.#stop()
    }
  }

  refresh = async (): Promise<void> => {
    if (this.#inFlight) return this.#inFlight
    this.#inFlight = this.#refreshOnce().finally(() => {
      this.#inFlight = null
    })
    return this.#inFlight
  }

  async #refreshOnce(): Promise<void> {
    const checkedAt = this.#now()
    this.#suggestedDelayMs = MINIMUM_POLL_INTERVAL_MS.ether
    this.#update({
      lastCheckedAt: checkedAt,
      message: null,
      status: this.#snapshot.frame ? this.#snapshot.status : 'connecting',
    })

    try {
      const key = this.#key ?? (await this.#loadKey())
      if (!key) return

      const response = await this.#transport.request('/ether')
      if (!response.ok) {
        this.#handleResponseError(response)
        return
      }

      let result = await verifyEtherEnvelope(response.body, key)
      if (result.kind === 'noise' && result.reason === 'unknown-key') {
        this.#key = null
        const refreshedKey = await this.#loadKey()
        if (!refreshedKey) return
        result = await verifyEtherEnvelope(response.body, refreshedKey)
      }

      if (result.kind === 'noise') {
        this.#update({
          consecutiveFailures: 0,
          message: result.reason,
          status: 'noise',
        })
        return
      }

      const reduction = reduceVerifiedFrame(this.#etherState, result.frame)
      if (reduction.accepted) this.#etherState = reduction.state
      const receivedAt = this.#now()
      this.#update({
        consecutiveFailures: 0,
        frame: this.#etherState.frame,
        message: reduction.accepted ? null : 'stale-frame-ignored',
        receivedAt: reduction.accepted ? receivedAt : this.#snapshot.receivedAt,
        status: 'signal',
      })
    } catch (error) {
      if (error instanceof QuietPeriodError) {
        this.#suggestedDelayMs = Math.max(
          MINIMUM_POLL_INTERVAL_MS.ether,
          error.remainingMs,
        )
        this.#update({ message: error.message, status: 'quiet' })
        return
      }
      const failures = this.#snapshot.consecutiveFailures + 1
      this.#update({
        consecutiveFailures: failures,
        message: error instanceof Error ? error.message : 'network-error',
        status: 'error',
      })
    }
  }

  async #loadKey(): Promise<EtherKey | null> {
    const response = await this.#transport.request('/ether/key')
    if (!response.ok) {
      this.#handleResponseError(response)
      return null
    }

    const key = await verifyEtherKey(
      parseJson(response.body),
      this.#expectedFingerprint,
    )
    if (!key) {
      this.#update({ message: 'untrusted-ether-key', status: 'noise' })
      return null
    }

    this.#key = key
    this.#update({ keyFingerprint: key.fingerprint })
    return key
  }

  #handleResponseError(response: RawApiResponse): void {
    if (response.status === 429) {
      this.#suggestedDelayMs = Math.max(
        MINIMUM_POLL_INTERVAL_MS.ether,
        response.retryAfterMs ?? 0,
      )
      this.#update({
        message: response.error?.code ?? 'rate-limited',
        status: 'quiet',
      })
      return
    }

    const failures = this.#snapshot.consecutiveFailures + 1
    this.#update({
      consecutiveFailures: failures,
      message: response.error?.code ?? `http-${response.status.toString()}`,
      status: 'error',
    })
  }

  #schedule(delayMs: number): void {
    if (this.#timer) this.#clearTimeout(this.#timer)
    const nextPollAt = this.#now() + Math.max(0, delayMs)
    this.#update({ nextPollAt })
    this.#timer = this.#setTimeout(
      () => {
        this.#timer = null
        void this.#cycle()
      },
      Math.max(0, delayMs),
    )
  }

  async #cycle(): Promise<void> {
    if (this.#retainCount === 0 || this.#running) return
    const remainingMs = this.#polling.remainingMs('ether', this.#now())
    if (remainingMs > 0) {
      this.#schedule(remainingMs)
      return
    }

    this.#polling.claim('ether', this.#now())
    this.#running = true
    await this.refresh()
    this.#running = false
    if (this.#retainCount === 0) return

    const delayMs =
      this.#snapshot.status === 'quiet'
        ? this.#suggestedDelayMs
        : this.#snapshot.status === 'error'
          ? Math.max(
              MINIMUM_POLL_INTERVAL_MS.ether,
              fullJitterDelayMs(
                this.#snapshot.consecutiveFailures,
                this.#random,
              ),
            )
          : MINIMUM_POLL_INTERVAL_MS.ether
    this.#schedule(delayMs)
  }

  #stop(): void {
    if (this.#timer) this.#clearTimeout(this.#timer)
    this.#timer = null
    this.#update({ nextPollAt: null })
  }

  #update(patch: Partial<EtherSnapshot>): void {
    this.#snapshot = Object.freeze({ ...this.#snapshot, ...patch })
    for (const listener of this.#listeners) listener()
  }
}

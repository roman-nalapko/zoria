export const MINIMUM_POLL_INTERVAL_MS = {
  ether: 15_000,
  roll: 60_000,
  summary: 15_000,
} as const

export type PollChannel = keyof typeof MINIMUM_POLL_INTERVAL_MS

export class PollingCoordinator {
  readonly #lastPollAt = new Map<PollChannel, number>()

  remainingMs(channel: PollChannel, nowMs: number = Date.now()): number {
    const lastPollAt = this.#lastPollAt.get(channel)
    if (lastPollAt === undefined) return 0
    return Math.max(0, lastPollAt + MINIMUM_POLL_INTERVAL_MS[channel] - nowMs)
  }

  claim(channel: PollChannel, nowMs: number = Date.now()): boolean {
    if (this.remainingMs(channel, nowMs) > 0) return false
    this.#lastPollAt.set(channel, nowMs)
    return true
  }
}

export const pollingCoordinator = new PollingCoordinator()

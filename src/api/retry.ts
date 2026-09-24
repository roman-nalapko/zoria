export function parseRetryAfterMs(
  value: string | null,
  nowMs: number = Date.now(),
): number | null {
  if (value === null) return null

  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds * 1000)
  }

  const dateMs = Date.parse(value)
  if (Number.isNaN(dateMs)) return null

  return Math.max(0, dateMs - nowMs)
}

export function fullJitterDelayMs(
  consecutiveFailure: number,
  random: () => number = Math.random,
): number {
  const exponent = Math.max(0, Math.floor(consecutiveFailure))
  const capMs = Math.min(60_000, 1000 * 2 ** exponent)
  const sample = Math.min(Math.max(random(), 0), 1)
  return Math.floor(sample * capMs)
}

export class OriginQuietPeriod {
  #untilMs = 0

  silenceFor(durationMs: number, nowMs: number = Date.now()): void {
    this.#untilMs = Math.max(this.#untilMs, nowMs + Math.max(0, durationMs))
  }

  remainingMs(nowMs: number = Date.now()): number {
    return Math.max(0, this.#untilMs - nowMs)
  }

  get untilMs(): number {
    return this.#untilMs
  }
}

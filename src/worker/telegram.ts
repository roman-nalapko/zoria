/**
 * Telegram notification helper.
 *
 * Rules:
 * - TELEGRAM_CHAT_ID is required; automatic discovery is removed (R8).
 * - Never log the bot token or raw private API responses.
 * - Parse ok/result from Telegram; respect retry_after with bounded retries.
 * - A pending success notification is queued if the first attempt fails.
 */

interface TelegramSendResponse {
  ok: boolean
  description?: string
  parameters?: {
    retry_after?: number
  }
}

const MAX_SEND_ATTEMPTS = 4
const BASE_RETRY_MS = 2000

export class TelegramNotifier {
  readonly #token: string
  readonly #chatId: string | null

  /** Pending success notification to retry until delivered. */
  #pendingSuccess: string | null = null

  constructor(token: string, chatId: string | null) {
    this.#token = token
    this.#chatId = chatId
  }

  /**
   * Send a status message.
   * Returns true when the message was delivered successfully.
   * Never throws.
   */
  async send(text: string): Promise<boolean> {
    if (!this.#chatId) {
      console.error(
        'Telegram: TELEGRAM_CHAT_ID is not configured; skipping send',
      )
      return false
    }
    return this.#sendWithRetry(text)
  }

  /**
   * Queue a success notification for reliable delivery.
   * If not delivered now it will be retried via flushPending().
   * Call this for registration success; the message must not be lost even if
   * the window subsequently closes.
   */
  async sendSuccess(text: string): Promise<boolean> {
    const delivered = await this.send(text)
    if (!delivered) {
      this.#pendingSuccess = text
    }
    return delivered
  }

  /**
   * Attempt to deliver any queued success notification.
   * Call this at the start of each check cycle.
   */
  async flushPending(): Promise<void> {
    if (!this.#pendingSuccess) return
    const delivered = await this.send(this.#pendingSuccess)
    if (delivered) {
      this.#pendingSuccess = null
    }
  }

  hasPending(): boolean {
    return this.#pendingSuccess !== null
  }

  async #sendWithRetry(text: string): Promise<boolean> {
    for (let attempt = 0; attempt < MAX_SEND_ATTEMPTS; attempt++) {
      const result = await this.#trySend(text)
      if (result.delivered) return true
      if (!result.shouldRetry) return false
      const waitMs = result.retryAfterMs ?? BASE_RETRY_MS * Math.pow(2, attempt)
      await delay(waitMs)
    }
    return false
  }

  async #trySend(text: string): Promise<{
    delivered: boolean
    shouldRetry: boolean
    retryAfterMs: number | null
  }> {
    try {
      const response = await fetch(this.#url('sendMessage'), {
        body: JSON.stringify({ chat_id: this.#chatId, text }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
        signal: AbortSignal.timeout(10_000),
      })
      // Parse Telegram response; never log raw body (may contain chat metadata).
      let parsed: TelegramSendResponse | null = null
      try {
        parsed = (await response.json()) as TelegramSendResponse
      } catch {
        // Non-JSON body
      }

      if (parsed?.ok === true)
        return { delivered: true, shouldRetry: false, retryAfterMs: null }

      const retryAfterMs =
        typeof parsed?.parameters?.retry_after === 'number'
          ? parsed.parameters.retry_after * 1000
          : null

      // 429 with retry_after → retry
      if (response.status === 429 && retryAfterMs !== null) {
        return { delivered: false, shouldRetry: true, retryAfterMs }
      }

      // 5xx → transient, retry
      if (response.status >= 500) {
        return { delivered: false, shouldRetry: true, retryAfterMs: null }
      }

      // 4xx (except 429) → permanent failure, do not retry
      return { delivered: false, shouldRetry: false, retryAfterMs: null }
    } catch {
      // Network error → retry
      return { delivered: false, shouldRetry: true, retryAfterMs: null }
    }
  }

  #url(method: string): string {
    return `https://api.telegram.org/bot${this.#token}/${method}`
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

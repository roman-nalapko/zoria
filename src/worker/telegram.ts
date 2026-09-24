interface TelegramResponse<T> {
  ok: boolean
  result?: T
}

interface TelegramUpdate {
  message?: {
    chat?: {
      id?: number
      type?: string
    }
  }
}

export class TelegramNotifier {
  readonly #token: string
  #chatId: string | null

  constructor(token: string, chatId: string | null) {
    this.#token = token
    this.#chatId = chatId
  }

  async send(text: string): Promise<boolean> {
    const chatId = this.#chatId ?? (await this.#discoverChatId())
    if (!chatId) return false

    try {
      const response = await fetch(this.#url('sendMessage'), {
        body: JSON.stringify({ chat_id: chatId, text }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
        signal: AbortSignal.timeout(10_000),
      })
      return response.ok
    } catch {
      return false
    }
  }

  async #discoverChatId(): Promise<string | null> {
    try {
      const response = await fetch(this.#url('getUpdates'), {
        signal: AbortSignal.timeout(10_000),
      })
      if (!response.ok) return null
      const body = (await response.json()) as TelegramResponse<TelegramUpdate[]>
      const updates = body.ok && Array.isArray(body.result) ? body.result : []
      const chat = [...updates]
        .reverse()
        .map((update) => update.message?.chat)
        .find((candidate) => candidate?.type === 'private' && candidate.id)
      if (!chat?.id) return null
      this.#chatId = String(chat.id)
      return this.#chatId
    } catch {
      return null
    }
  }

  #url(method: string): string {
    return `https://api.telegram.org/bot${this.#token}/${method}`
  }
}

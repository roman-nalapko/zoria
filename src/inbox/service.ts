import type { ApiTransport } from '../api/transport'
import type { components } from '../api/schema'

export type Message = components['schemas']['Message']

export interface InboxPageResult {
  items: Message[]
  nextOffset: number | null
}

export interface FetchInboxOptions {
  limit?: number | undefined
  offset?: number | undefined
  token?: string | undefined
}

/**
 * T6.1: Letter listing with unread indicators and acknowledgment timestamps.
 */
export async function fetchInbox(
  transport: ApiTransport,
  options: FetchInboxOptions = {},
): Promise<InboxPageResult> {
  const params = new URLSearchParams()
  if (options.limit !== undefined) {
    params.set('limit', options.limit.toString())
  }
  if (options.offset !== undefined) {
    params.set('offset', options.offset.toString())
  }

  const query = params.toString()
  const path = query ? `/inbox?${query}` : '/inbox'

  const response = await transport.request(path, {
    method: 'GET',
    ...(options.token ? { token: options.token } : {}),
  })

  if (!response.ok) {
    throw new Error(
      response.error?.code ??
        `Failed to fetch inbox: ${response.status.toString()}`,
    )
  }

  try {
    const data = JSON.parse(response.body) as {
      items?: Message[]
      nextOffset?: number | null
    }

    return {
      items: data.items ?? [],
      nextOffset: data.nextOffset ?? null,
    }
  } catch {
    return {
      items: [],
      nextOffset: null,
    }
  }
}

/**
 * T6.2: Letter reader (GET /inbox/{id}).
 */
export async function fetchMessage(
  transport: ApiTransport,
  id: string,
  token?: string,
): Promise<Message | null> {
  const response = await transport.request(`/inbox/${encodeURIComponent(id)}`, {
    method: 'GET',
    ...(token ? { token } : {}),
  })

  if (!response.ok) {
    return null
  }

  try {
    const data = JSON.parse(response.body) as {
      message: Message
    }
    return data.message
  } catch {
    return null
  }
}

/**
 * T6.3: Letter acknowledgment action (POST /inbox/{id}/read).
 */
export async function markMessageRead(
  transport: ApiTransport,
  id: string,
  token?: string,
): Promise<boolean> {
  const response = await transport.request(
    `/inbox/${encodeURIComponent(id)}/read`,
    {
      body: {},
      method: 'POST',
      ...(token ? { token } : {}),
    },
  )

  return response.ok
}

import type { ApiTransport } from '../api/transport'
import type { components } from '../api/schema'

export type News = components['schemas']['News']

export interface NewsPageResult {
  items: News[]
  nextOffset: number | null
}

export interface FetchNewsOptions {
  limit?: number | undefined
  offset?: number | undefined
  token?: string | undefined
}

/**
 * T5.1: Stable, restartable pagination for news list (GET /news).
 */
export async function fetchNews(
  transport: ApiTransport,
  options: FetchNewsOptions = {},
): Promise<NewsPageResult> {
  const params = new URLSearchParams()
  if (options.limit !== undefined) {
    params.set('limit', options.limit.toString())
  }
  if (options.offset !== undefined) {
    params.set('offset', options.offset.toString())
  }

  const query = params.toString()
  const path = query ? `/news?${query}` : '/news'

  const response = await transport.request(path, {
    method: 'GET',
    ...(options.token ? { token: options.token } : {}),
  })

  if (!response.ok) {
    throw new Error(
      response.error?.code ??
        `Failed to fetch news: ${response.status.toString()}`,
    )
  }

  try {
    const data = JSON.parse(response.body) as {
      items?: News[]
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

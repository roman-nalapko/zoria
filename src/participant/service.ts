import type { ApiTransport } from '../api/transport'
import type { components } from '../api/schema'

export type Repository = components['schemas']['Repository']
export type Summary = components['schemas']['Summary']

export function formatBucharest(isoOrDate: string | null | undefined): string {
  if (!isoOrDate) return '—'
  const date = new Date(isoOrDate)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('uk-UA', {
    timeZone: 'Europe/Bucharest',
  })
}

export async function fetchRepository(
  transport: ApiTransport,
  token?: string,
): Promise<Repository | null> {
  const response = await transport.request('/me/repository', {
    method: 'GET',
    ...(token ? { token } : {}),
  })

  if (!response.ok) {
    return null
  }

  try {
    const data = JSON.parse(response.body) as {
      repository: Repository | null
    }
    return data.repository ?? null
  } catch {
    return null
  }
}

export async function fetchSummary(
  transport: ApiTransport,
  token?: string,
): Promise<Summary | null> {
  const response = await transport.request('/me/summary', {
    method: 'GET',
    ...(token ? { token } : {}),
  })

  if (!response.ok) {
    return null
  }

  try {
    return JSON.parse(response.body) as Summary
  } catch {
    return null
  }
}

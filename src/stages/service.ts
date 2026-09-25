import type { ApiTransport } from '../api/transport'
import type { components } from '../api/schema'

export type StageSummary = components['schemas']['StageSummary']
export type Stage = components['schemas']['Stage']

export interface FetchStagesResult {
  items: StageSummary[]
}

/**
 * T7.1: Fetch released stages list (GET /stages).
 */
export async function fetchStages(
  transport: ApiTransport,
  token?: string,
): Promise<FetchStagesResult> {
  const response = await transport.request('/stages', {
    method: 'GET',
    ...(token ? { token } : {}),
  })

  if (!response.ok) {
    return { items: [] }
  }

  try {
    const data = JSON.parse(response.body) as {
      items?: StageSummary[]
    }
    return {
      items: data.items ?? [],
    }
  } catch {
    return { items: [] }
  }
}

/**
 * T7.2: Fetch stage details with body and errata (GET /stages/{id}).
 */
export async function fetchStage(
  transport: ApiTransport,
  id: string,
  token?: string,
): Promise<Stage | null> {
  const response = await transport.request(
    `/stages/${encodeURIComponent(id)}`,
    {
      method: 'GET',
      ...(token ? { token } : {}),
    },
  )

  if (!response.ok) {
    return null
  }

  try {
    const data = JSON.parse(response.body) as {
      stage: Stage
    }
    return data.stage
  } catch {
    return null
  }
}

/**
 * T7.3: Explicit stage acknowledgment (POST /stages/{id}/ack).
 * Returns the updated Stage upon success or null upon error.
 */
export async function acknowledgeStage(
  transport: ApiTransport,
  id: string,
  token?: string,
): Promise<Stage | null> {
  const response = await transport.request(
    `/stages/${encodeURIComponent(id)}/ack`,
    {
      body: {},
      method: 'POST',
      ...(token ? { token } : {}),
    },
  )

  if (!response.ok) {
    return null
  }

  try {
    const data = JSON.parse(response.body) as {
      stage: Stage
    }
    return data.stage
  } catch {
    return null
  }
}

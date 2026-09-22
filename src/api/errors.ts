export interface ApiErrorDetails {
  code: string | null
  field: string | null
  requestId: string | null
  status: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseApiError(
  status: number,
  body: string,
  requestIdHeader: string | null,
): ApiErrorDetails {
  let error: Record<string, unknown> | null = null

  try {
    const candidate: unknown = JSON.parse(body)
    if (isRecord(candidate) && isRecord(candidate.error)) {
      error = candidate.error
    }
  } catch {
    // Arbitrary bodies are expected before the registration window.
  }

  return {
    code: typeof error?.code === 'string' ? error.code : null,
    field: typeof error?.field === 'string' ? error.field : null,
    requestId:
      requestIdHeader ??
      (typeof error?.requestId === 'string' ? error.requestId : null),
    status,
  }
}

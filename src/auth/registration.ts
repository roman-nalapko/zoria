import type { RawApiResponse } from '../api/transport'
import type { RegistrationInput } from './validation'

export interface RegistrationTransport {
  request(
    path: string,
    options: { body: unknown; method: string },
  ): Promise<RawApiResponse>
}

export interface ParticipantSession {
  expiresAt: string
  sessionId: string
  token: string
  user: {
    displayName: string
    username: string
  }
}

export type RegistrationResult =
  | { kind: 'success'; recovered: boolean; session: ParticipantSession }
  | {
      code: string
      field: string | null
      kind: 'failure'
      requestId: string | null
      status: number | null
    }

export interface RegistrationServiceOptions {
  sleep?: (delayMs: number) => Promise<void>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseParticipantSession(
  body: string,
): ParticipantSession | null {
  try {
    const value: unknown = JSON.parse(body)
    if (
      !isRecord(value) ||
      typeof value.token !== 'string' ||
      typeof value.sessionId !== 'string' ||
      typeof value.expiresAt !== 'string' ||
      Number.isNaN(Date.parse(value.expiresAt)) ||
      !isRecord(value.user) ||
      typeof value.user.username !== 'string' ||
      typeof value.user.displayName !== 'string'
    ) {
      return null
    }
    return {
      expiresAt: value.expiresAt,
      sessionId: value.sessionId,
      token: value.token,
      user: {
        displayName: value.user.displayName,
        username: value.user.username,
      },
    }
  } catch {
    return null
  }
}

function failure(response: RawApiResponse): RegistrationResult {
  return {
    code: response.error?.code ?? `http-${response.status.toString()}`,
    field: response.error?.field ?? null,
    kind: 'failure',
    requestId: response.requestId,
    status: response.status,
  }
}

function requestBody(input: RegistrationInput): RegistrationInput {
  return { ...input }
}

export class RegistrationService {
  readonly #transport: RegistrationTransport
  readonly #sleep: (delayMs: number) => Promise<void>

  constructor(
    transport: RegistrationTransport,
    options: RegistrationServiceOptions = {},
  ) {
    this.#transport = transport
    this.#sleep =
      options.sleep ??
      ((delayMs) =>
        new Promise((resolve) => {
          setTimeout(resolve, delayMs)
        }))
  }

  async register(
    input: RegistrationInput,
    verifiedWindowOpen: boolean,
  ): Promise<RegistrationResult> {
    if (!verifiedWindowOpen) {
      return {
        code: 'verified-window-required',
        field: null,
        kind: 'failure',
        requestId: null,
        status: null,
      }
    }

    try {
      return await this.#postRegistration(input, 3)
    } catch {
      return this.#recoverAfterUncertainResponse(input, verifiedWindowOpen)
    }
  }

  async #postRegistration(
    input: RegistrationInput,
    busyAttemptsRemaining: number,
  ): Promise<RegistrationResult> {
    const response = await this.#transport.request('/auth/register', {
      body: requestBody(input),
      method: 'POST',
    })
    if (response.ok) {
      const session = parseParticipantSession(response.body)
      return session
        ? { kind: 'success', recovered: false, session }
        : {
            code: 'invalid-session-response',
            field: null,
            kind: 'failure',
            requestId: response.requestId,
            status: response.status,
          }
    }

    if (
      response.status === 429 &&
      response.error?.code === 'authentication-busy' &&
      busyAttemptsRemaining > 1
    ) {
      await this.#sleep(response.retryAfterMs ?? 5000)
      return this.#postRegistration(input, busyAttemptsRemaining - 1)
    }
    return failure(response)
  }

  async #recoverAfterUncertainResponse(
    input: RegistrationInput,
    verifiedWindowOpen: boolean,
  ): Promise<RegistrationResult> {
    let login: RawApiResponse
    try {
      login = await this.#transport.request('/auth/login', {
        body: { password: input.password, username: input.username },
        method: 'POST',
      })
    } catch {
      return {
        code: 'registration-outcome-unknown',
        field: null,
        kind: 'failure',
        requestId: null,
        status: null,
      }
    }

    if (login.ok) {
      const session = parseParticipantSession(login.body)
      return session
        ? { kind: 'success', recovered: true, session }
        : {
            code: 'invalid-session-response',
            field: null,
            kind: 'failure',
            requestId: login.requestId,
            status: login.status,
          }
    }

    if (
      login.status === 401 &&
      login.error?.code === 'invalid-credentials' &&
      verifiedWindowOpen
    ) {
      try {
        return await this.#postRegistration(input, 1)
      } catch {
        return {
          code: 'registration-outcome-unknown',
          field: null,
          kind: 'failure',
          requestId: null,
          status: null,
        }
      }
    }
    return failure(login)
  }
}

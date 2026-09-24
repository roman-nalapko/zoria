import { describe, expect, it, vi } from 'vitest'
import type { RawApiResponse } from '../api/transport'
import { RegistrationService, type RegistrationTransport } from './registration'
import type { RegistrationInput } from './validation'

const input: RegistrationInput = {
  displayName: 'Roman',
  invitation: 'test-only',
  lang: 'uk',
  password: 'test-password-123',
  repositoryUrl: 'https://github.com/roman-nalapko/zoria',
  username: 'roman-nalapko',
}

function response(
  body: string,
  options: Partial<RawApiResponse> = {},
): RawApiResponse {
  return {
    body,
    error: null,
    headers: new Headers(),
    ok: true,
    requestId: null,
    retryAfterMs: null,
    status: 201,
    ...options,
  }
}

const sessionBody = JSON.stringify({
  expiresAt: '2026-09-25T00:00:00.000Z',
  sessionId: 'session-test',
  token: 'token-test',
  user: { displayName: 'Roman', username: 'roman-nalapko' },
})

function transportWith(
  responses: Array<RawApiResponse | Error>,
): RegistrationTransport & { paths: string[] } {
  const paths: string[] = []
  return {
    paths,
    request(path) {
      paths.push(path)
      const next = responses.shift()
      if (next instanceof Error) return Promise.reject(next)
      if (!next) return Promise.reject(new Error('No queued response'))
      return Promise.resolve(next)
    },
  }
}

describe('RegistrationService', () => {
  it('refuses to submit before a verified window', async () => {
    const transport = transportWith([])
    await expect(
      new RegistrationService(transport).register(input, false),
    ).resolves.toMatchObject({
      code: 'verified-window-required',
      kind: 'failure',
    })
    expect(transport.paths).toEqual([])
  })

  it('honors authentication-busy Retry-After before retrying', async () => {
    const busy = response('{"error":{"code":"authentication-busy"}}', {
      error: {
        code: 'authentication-busy',
        field: null,
        requestId: 'busy-1',
        status: 429,
      },
      ok: false,
      retryAfterMs: 5000,
      status: 429,
    })
    const transport = transportWith([busy, response(sessionBody)])
    const sleep = vi.fn(() => Promise.resolve())

    await expect(
      new RegistrationService(transport, { sleep }).register(input, true),
    ).resolves.toMatchObject({ kind: 'success', recovered: false })
    expect(sleep).toHaveBeenCalledWith(5000)
    expect(transport.paths).toEqual(['/auth/register', '/auth/register'])
  })

  it('attempts login first after an uncertain registration response', async () => {
    const transport = transportWith([
      new Error('connection lost'),
      response(sessionBody, { status: 200 }),
    ])

    await expect(
      new RegistrationService(transport).register(input, true),
    ).resolves.toMatchObject({ kind: 'success', recovered: true })
    expect(transport.paths).toEqual(['/auth/register', '/auth/login'])
  })
})

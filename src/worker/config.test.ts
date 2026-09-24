import { describe, expect, it } from 'vitest'
import { readWorkerConfig } from './config.js'

const REQUIRED = {
  TELEGRAM_BOT_TOKEN: 'telegram-token',
  ZORIA_DISPLAY_NAME: 'Zoria',
  ZORIA_INVITATION: 'invitation',
  ZORIA_PASSWORD: 'long-enough-password',
  ZORIA_REPOSITORY_URL: 'https://github.com/example/zoria',
  ZORIA_USERNAME: 'example-user',
}

describe('readWorkerConfig', () => {
  it('uses production-safe defaults without exposing secret values', () => {
    const config = readWorkerConfig(REQUIRED)

    expect(config.apiUrl).toBe('https://zoria.net/api/v1')
    expect(config.pollIntervalMs).toBe(15_000)
    expect(config.etherKeyFingerprint).toHaveLength(64)
    expect(config.telegramChatId).toBeNull()
  })

  it('refuses polling faster than the official limit', () => {
    expect(() =>
      readWorkerConfig({ ...REQUIRED, ZORIA_POLL_INTERVAL_MS: '14999' }),
    ).toThrow('at least 15000')
  })

  it('requires every secret and registration field', () => {
    expect(() =>
      readWorkerConfig({ ...REQUIRED, ZORIA_INVITATION: '' }),
    ).toThrow('ZORIA_INVITATION')
  })
})

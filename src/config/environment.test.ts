import { describe, expect, it } from 'vitest'
import { API_ORIGINS, readAppConfig } from './environment'

describe('readAppConfig', () => {
  it('uses the training stand by default', () => {
    expect(readAppConfig({})).toEqual({
      apiUrl: API_ORIGINS.training,
      environment: 'training',
      productionKeyFingerprint: null,
    })
  })

  it('requires a pinned fingerprint in production', () => {
    expect(() => readAppConfig({ VITE_ZORIA_ENV: 'production' })).toThrow(
      /pinned ether key fingerprint/i,
    )
  })

  it('rejects an origin that does not match the selected environment', () => {
    expect(() =>
      readAppConfig({
        VITE_ZORIA_ENV: 'training',
        VITE_ZORIA_API_URL: API_ORIGINS.production,
      }),
    ).toThrow(/does not match/i)
  })
})

export const API_ORIGINS = {
  training: 'https://stand.zoria.net/api/v1',
  production: 'https://zoria.net/api/v1',
} as const

export const TRAINING_ETHER_KEY_FINGERPRINT =
  'f3a436df65614f08635f18fe0f64f145285203f1faa2905ecb25ffb90969a7de'

export type ZoriaEnvironment = keyof typeof API_ORIGINS

export interface AppConfig {
  apiUrl: string
  etherKeyFingerprint: string
  environment: ZoriaEnvironment
}

export interface EnvironmentInput {
  VITE_ZORIA_API_URL?: string
  VITE_ZORIA_ENV?: string
  VITE_ZORIA_PRODUCTION_KEY_FINGERPRINT?: string
}

const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/

function normalizeApiUrl(value: string): string {
  const url = new URL(value)

  if (url.protocol !== 'https:') {
    throw new Error('Zoria API URL must use HTTPS')
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new Error(
      'Zoria API URL must not contain credentials, query, or hash',
    )
  }

  return url.toString().replace(/\/$/, '')
}

export function readAppConfig(
  env: EnvironmentInput = import.meta.env,
): AppConfig {
  const environment = env.VITE_ZORIA_ENV ?? 'training'

  if (environment !== 'training' && environment !== 'production') {
    throw new Error(`Unsupported Zoria environment: ${environment}`)
  }

  const apiUrl = normalizeApiUrl(
    env.VITE_ZORIA_API_URL ?? API_ORIGINS[environment],
  )
  const expectedOrigin = API_ORIGINS[environment]

  if (apiUrl !== expectedOrigin) {
    throw new Error(
      `API URL does not match ${environment} environment: ${apiUrl}`,
    )
  }

  const configuredFingerprint =
    env.VITE_ZORIA_PRODUCTION_KEY_FINGERPRINT?.trim().toLowerCase() ?? ''

  if (
    configuredFingerprint !== '' &&
    !FINGERPRINT_PATTERN.test(configuredFingerprint)
  ) {
    throw new Error(
      'Production key fingerprint must be 64 lowercase hex digits',
    )
  }

  if (environment === 'production' && configuredFingerprint === '') {
    throw new Error('Production requires a pinned ether key fingerprint')
  }

  return Object.freeze({
    apiUrl,
    etherKeyFingerprint:
      environment === 'training'
        ? TRAINING_ETHER_KEY_FINGERPRINT
        : configuredFingerprint,
    environment,
  })
}

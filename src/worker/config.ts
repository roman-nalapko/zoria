const PRODUCTION_ETHER_KEY_FINGERPRINT =
  'dcb3155eb8f2538d466a294315e984fa9f67f703556c5e276d5b3afc88895696'

export interface WorkerConfig {
  apiUrl: string
  displayName: string
  etherKeyFingerprint: string
  invitation: string
  password: string
  pollIntervalMs: number
  repositoryUrl: string
  telegramBotToken: string
  telegramChatId: string | null
  username: string
}

function required(name: string, env: NodeJS.ProcessEnv): string {
  const value = env[name]?.trim()
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

export function readWorkerConfig(
  env: NodeJS.ProcessEnv = process.env,
): WorkerConfig {
  const pollIntervalMs = Number(env.ZORIA_POLL_INTERVAL_MS ?? '15000')
  if (!Number.isInteger(pollIntervalMs) || pollIntervalMs < 15_000) {
    throw new Error('ZORIA_POLL_INTERVAL_MS must be at least 15000')
  }

  const apiUrl = env.ZORIA_API_URL?.trim() || 'https://zoria.net/api/v1'
  const parsedApiUrl = new URL(apiUrl)
  if (
    parsedApiUrl.protocol !== 'https:' ||
    parsedApiUrl.username ||
    parsedApiUrl.password ||
    parsedApiUrl.search ||
    parsedApiUrl.hash
  ) {
    throw new Error('ZORIA_API_URL must be a credential-free HTTPS URL')
  }

  return Object.freeze({
    apiUrl: parsedApiUrl.toString().replace(/\/$/, ''),
    displayName: required('ZORIA_DISPLAY_NAME', env),
    etherKeyFingerprint:
      env.ZORIA_ETHER_KEY_FINGERPRINT?.trim().toLowerCase() ||
      PRODUCTION_ETHER_KEY_FINGERPRINT,
    invitation: required('ZORIA_INVITATION', env),
    password: required('ZORIA_PASSWORD', env),
    pollIntervalMs,
    repositoryUrl: required('ZORIA_REPOSITORY_URL', env),
    telegramBotToken: required('TELEGRAM_BOT_TOKEN', env),
    telegramChatId: env.TELEGRAM_CHAT_ID?.trim() || null,
    username: required('ZORIA_USERNAME', env),
  })
}

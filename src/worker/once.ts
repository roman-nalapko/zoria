import { readWorkerConfig } from './config.js'
import { TelegramNotifier } from './telegram.js'
import type { SafeApiResult } from './zoria.js'
import { ZoriaWorkerClient } from './zoria.js'

const config = readWorkerConfig()
const telegram = new TelegramNotifier(
  config.telegramBotToken,
  config.telegramChatId,
)
const zoria = new ZoriaWorkerClient(config)

async function main(): Promise<void> {
  const frame = await zoria.pollTrustedFrame()

  if (process.env.NOTIFY_HEALTH === 'true') {
    const phase = frame ? ` Подтверждённая фаза: ${frame.phase}.` : ''
    const delivered = await telegram.send(
      `🤖 Zoria watcher в GitHub Actions запущен.${phase} Проверка будет выполняться каждые 5 минут.`,
    )
    if (!delivered) {
      throw new Error(
        'Telegram message was not delivered; send /start to the bot',
      )
    }
  }

  if (frame?.phase !== 'window') return

  const login = await retryAuthenticationBusy(() => zoria.login())
  if (login.ok) {
    await complete(
      '✅ Zoria: просвет подтверждён. Аккаунт уже зарегистрирован, вход работает.',
    )
    return
  }
  if (!(login.status === 401 && login.errorCode === 'invalid-credentials')) {
    await reportFailure('Проверка существующего аккаунта не удалась', login)
    return
  }

  const registration = await retryAuthenticationBusy(() => zoria.register())
  if (registration.ok) {
    await complete(
      '🌅 Zoria: просвет подтверждён криптографически. Регистрация успешно завершена.',
    )
    return
  }

  if (registration.status === 0) {
    const recovery = await retryAuthenticationBusy(() => zoria.login())
    if (recovery.ok) {
      await complete(
        '✅ Zoria: регистрация подтверждена после восстановления соединения.',
      )
      return
    }
  }
  await reportFailure('Регистрация не завершена', registration)
}

async function complete(message: string): Promise<void> {
  const delivered = await telegram.send(message)
  if (!delivered) throw new Error('Registration succeeded but Telegram failed')
  await disableThisWorkflow()
}

async function reportFailure(
  label: string,
  result: SafeApiResult,
): Promise<void> {
  const request = result.requestId ? `; request ${result.requestId}` : ''
  const detail = result.errorCode ?? `HTTP ${result.status.toString()}`
  await telegram.send(`⚠️ Zoria: ${label}: ${detail}${request}`)
  throw new Error(`${label}: ${detail}${request}`)
}

async function retryAuthenticationBusy(
  action: () => Promise<SafeApiResult>,
): Promise<SafeApiResult> {
  let result = await action()
  for (
    let attempt = 1;
    attempt < 3 &&
    result.status === 429 &&
    result.errorCode === 'authentication-busy';
    attempt += 1
  ) {
    await delay(result.retryAfterMs ?? 5000)
    result = await action()
  }
  return result
}

async function disableThisWorkflow(): Promise<void> {
  const repository = process.env.GITHUB_REPOSITORY
  const token = process.env.GITHUB_TOKEN
  if (!repository || !token) return

  const response = await fetch(
    `https://api.github.com/repos/${repository}/actions/workflows/zoria-watch.yml/disable`,
    {
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'x-github-api-version': '2022-11-28',
      },
      method: 'PUT',
    },
  )
  if (!response.ok && response.status !== 404) {
    throw new Error(
      `Could not disable completed workflow: HTTP ${response.status.toString()}`,
    )
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

await main()

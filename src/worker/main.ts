import { createServer } from 'node:http'
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

let stopped = false
let registrationComplete = false
let registrationInFlight = false
let lastHarbingerOpensAt: number | null = null

function safeLog(event: string, details: Record<string, unknown> = {}): void {
  console.log(
    JSON.stringify({ event, ...details, at: new Date().toISOString() }),
  )
}

async function notify(text: string): Promise<void> {
  const delivered = await telegram.send(text)
  safeLog('telegram', { delivered })
}

async function registerDuringWindow(): Promise<void> {
  if (registrationComplete || registrationInFlight) return
  registrationInFlight = true
  try {
    const login = await retryAuthenticationBusy(() => zoria.login())
    if (login.ok) {
      registrationComplete = true
      await notify('✅ Zoria: аккаунт уже зарегистрирован, вход подтверждён.')
      return
    }
    if (!(login.status === 401 && login.errorCode === 'invalid-credentials')) {
      await notify(
        formatFailure('Проверка существующего аккаунта не удалась', login),
      )
      return
    }

    const registration = await retryAuthenticationBusy(() => zoria.register())
    if (registration.ok) {
      registrationComplete = true
      await notify(
        '🌅 Zoria: просвет подтверждён криптографически. Регистрация успешно завершена.',
      )
      return
    }

    if (registration.status === 0) {
      const recovery = await retryAuthenticationBusy(() => zoria.login())
      if (recovery.ok) {
        registrationComplete = true
        await notify(
          '✅ Zoria: регистрация подтверждена после восстановления соединения.',
        )
        return
      }
    }
    await notify(formatFailure('Регистрация не завершена', registration))
  } finally {
    registrationInFlight = false
  }
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

function formatFailure(label: string, result: SafeApiResult): string {
  const request = result.requestId ? `; request ${result.requestId}` : ''
  return `⚠️ Zoria: ${label}: ${result.errorCode ?? `HTTP ${result.status.toString()}`}${request}`
}

async function tick(): Promise<void> {
  const frame = await zoria.pollTrustedFrame()
  if (!frame) return
  safeLog('trusted-frame', { phase: frame.phase, frameAt: frame.at })

  if (frame.harbinger) {
    const opensAt = Date.parse(frame.at) + frame.harbinger.opensIn * 1000
    if (opensAt !== lastHarbingerOpensAt) {
      lastHarbingerOpensAt = opensAt
      const localTime = new Date(opensAt).toLocaleString('ru-RU', {
        timeZone: 'Europe/Bucharest',
      })
      await notify(
        `📡 Zoria: получен подписанный предвестник. Просвет ожидается около ${localTime} (Europe/Bucharest).`,
      )
    }
  }

  if (frame.phase === 'window') await registerDuringWindow()
}

async function loop(): Promise<void> {
  safeLog('worker-started', { intervalMs: config.pollIntervalMs })
  await notify(
    '🤖 Zoria watcher запущен. Жду подписанный предвестник или просвет.',
  )
  while (!stopped) {
    const startedAt = Date.now()
    try {
      await tick()
    } catch (error) {
      safeLog('tick-failed', {
        message: error instanceof Error ? error.message : 'unknown error',
      })
    }
    await delay(Math.max(0, config.pollIntervalMs - (Date.now() - startedAt)))
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const port = Number(process.env.PORT ?? '8080')
const server = createServer((request, response) => {
  if (request.url === '/healthz') {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ ok: true, registrationComplete }))
    return
  }
  response.writeHead(404).end()
})

server.listen(port, '0.0.0.0', () => {
  safeLog('health-server-listening', { port })
  void loop()
})

function shutdown(): void {
  stopped = true
  server.close(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

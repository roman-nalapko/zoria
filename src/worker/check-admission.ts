/**
 * Standalone runner: logs in, queries /me/repository, and reports status to Telegram.
 *
 * Rules:
 * - Never log or print the bearer token.
 * - Format output in Europe/Bucharest timezone.
 * - Report accessStatus, reasonCode, reason, checkedAt.
 */

import { readWorkerConfig } from './config.js'
import { TelegramNotifier } from './telegram.js'
import { ZoriaWorkerClient } from './zoria.js'

const config = readWorkerConfig()
const telegram = new TelegramNotifier(
  config.telegramBotToken,
  config.telegramChatId,
)
const zoria = new ZoriaWorkerClient(config)

async function main(): Promise<void> {
  console.log('Checking repository admission status via /me/repository...')
  const repo = await zoria.checkMyRepository()
  console.log(
    JSON.stringify({
      event: 'repository-status-checked',
      accessStatus: repo?.accessStatus ?? null,
      reasonCode: repo?.reasonCode ?? null,
    }),
  )

  const tz = 'Europe/Bucharest'
  const now = new Date().toLocaleString('uk-UA', { timeZone: tz })
  let msg = `🔍 Zoria repository review (${now} ${tz}):\n`
  if (!repo) {
    msg +=
      'Статус репозиторію не повернуто сервером (помилка запиту або невалідна сесія).'
  } else {
    msg += `• accessStatus: ${repo.accessStatus ?? 'невідомо'}\n`
    if (repo.reasonCode) msg += `• reasonCode: ${repo.reasonCode}\n`
    if (repo.reason) msg += `• reason: ${repo.reason}\n`
    if (repo.checkedAt) msg += `• checkedAt: ${repo.checkedAt}\n`
  }

  const delivered = await telegram.send(msg)
  console.log(JSON.stringify({ event: 'telegram-notified', delivered }))
}

await main()

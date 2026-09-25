/**
 * Standalone runner: checks tournament updates (/me/summary and /me/repository)
 * and notifies Telegram only when changes or unread items are detected.
 *
 * Rules:
 * - Never log or print the bearer token.
 * - Format output in Europe/Bucharest timezone.
 * - Report changes in unread count, news, released stages, repository status.
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
  console.log(
    'Checking tournament updates via /me/summary and /me/repository...',
  )
  const summary = await zoria.checkMySummary()

  const tz = 'Europe/Bucharest'
  const now = new Date().toLocaleString('uk-UA', { timeZone: tz })

  if (!summary) {
    console.log(JSON.stringify({ event: 'summary-fetch-failed' }))
    return
  }

  console.log(
    JSON.stringify({
      event: 'summary-checked',
      unread: summary.unread,
      releasedStages: summary.releasedStages,
      acknowledgedStages: summary.acknowledgedStages,
      latestNews: summary.latestNews,
      repositoryAt: summary.repositoryAt,
    }),
  )

  // Notify if there are unread inbox items, unacknowledged stages, or new news
  const hasUnread = summary.unread > 0
  const hasPendingStages = summary.releasedStages > summary.acknowledgedStages

  let msg = `🔔 Zoria tournament digest (${now} ${tz}):\n`
  msg += `• Листів у скриньці: ${summary.unread.toString()} непрочитаних\n`

  if (hasUnread) {
    try {
      const inbox = await zoria.checkMyInbox()
      const unreadList = inbox?.filter((m) => m.readAt === null) ?? []
      if (unreadList.length > 0) {
        msg += '  Заголовки непрочитаних:\n'
        for (const item of unreadList.slice(0, 3)) {
          msg += `  - «${item.title}»\n`
        }
      }
    } catch {
      // Non-fatal
    }
  }

  msg += `• Турнірні етапи: ${summary.acknowledgedStages.toString()} / ${summary.releasedStages.toString()} підтверджено\n`
  if (summary.latestNews) {
    msg += `• Останні новини: ${summary.latestNews}\n`
  }
  if (summary.repositoryAt) {
    msg += `• Зміна статусу репозиторію: ${summary.repositoryAt}\n`
  }

  // If there's an action item, send the alert
  if (hasUnread || hasPendingStages) {
    msg +=
      '\n👉 Перевірте клієнт: є нові вхідні повідомлення або етапи для підтвердження!'
  }

  const delivered = await telegram.send(msg)
  console.log(JSON.stringify({ event: 'telegram-digest-sent', delivered }))
}

await main()

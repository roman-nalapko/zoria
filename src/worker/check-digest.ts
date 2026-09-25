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
  const token = await zoria.obtainSessionToken()
  if (!token) {
    console.log(JSON.stringify({ event: 'auth-failed' }))
    return
  }

  const summary = await zoria.getSummary(token)

  const tz = 'Europe/Bucharest'
  const now = new Date().toLocaleString('uk-UA', { timeZone: tz })

  if (!summary) {
    console.log(JSON.stringify({ event: 'summary-fetch-failed' }))
    return
  }

  console.log(
    JSON.stringify({
      acknowledgedStages: summary.acknowledgedStages,
      event: 'summary-checked',
      latestNews: summary.latestNews,
      releasedStages: summary.releasedStages,
      repositoryAt: summary.repositoryAt,
      unread: summary.unread,
    }),
  )

  const hasUnread = summary.unread > 0
  const hasPendingStages = summary.releasedStages > summary.acknowledgedStages

  let msg = `🔔 Zoria tournament digest (${now} ${tz}):\n`
  msg += `• Листів у скриньці: ${summary.unread.toString()} непрочитаних\n`

  if (hasUnread) {
    try {
      const inbox = await zoria.getInbox(token)
      const unreadList = inbox?.filter((m) => m.readAt === null) ?? []
      if (unreadList.length > 0) {
        msg += '\n📬 НОВІ ПОВІДОМЛЕННЯ В СКРИНЬЦІ:\n'
        for (const item of unreadList) {
          const details = await zoria.getMessage(token, item.id)
          msg += `\n✉️ «${item.title}»\n`
          if (details?.body) {
            msg += `${details.body.trim()}\n`
          }
          // Automatically mark read so organizers see participant receipt
          const marked = await zoria.markMessageRead(token, item.id)
          if (marked) {
            msg += `(позначено прочитаним ✅)\n`
          }
        }
      }
    } catch {
      // Non-fatal
    }
  }

  msg += `\n• Турнірні етапи: ${summary.acknowledgedStages.toString()} / ${summary.releasedStages.toString()} підтверджено\n`

  if (hasPendingStages) {
    try {
      const stages = await zoria.getStages(token)
      const unackedStages =
        stages?.filter((s) => s.acknowledgedAt === null) ?? []
      if (unackedStages.length > 0) {
        msg += '\n🏆 НОВІ ТУРНІРНІ ЕТАПИ (ЧАСТИНА ЗАВДАННЯ):\n'
        for (const st of unackedStages) {
          msg += `• ${st.title} (ID: ${st.id})\n`
          const acked = await zoria.ackStage(token, st.id)
          if (acked) {
            msg += `  (отримання підтверджено сервером ✅)\n`
          }
        }
      }
    } catch {
      // Non-fatal
    }
  }

  if (summary.latestNews) {
    msg += `• Останні новини: ${summary.latestNews}\n`
  }
  if (summary.repositoryAt) {
    msg += `• Зміна статусу репозиторію: ${summary.repositoryAt}\n`
  }

  const delivered = await telegram.send(msg)
  console.log(JSON.stringify({ delivered, event: 'telegram-digest-sent' }))
}

await main()

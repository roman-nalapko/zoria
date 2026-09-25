import { useCallback, useEffect, useState } from 'react'
import type { ApiTransport } from '../api/transport'
import { apiTransport } from './runtime'
import {
  fetchInbox,
  fetchMessage,
  markMessageRead,
  type Message,
} from '../inbox/service'
import { formatLocalTime } from '../ether/time'
import { SafeMarkdown } from '../components/SafeMarkdown'
import { useSession } from './useSession'

export interface InboxPageProps {
  transport?: ApiTransport
}

const PAGE_SIZE = 10

/**
 * Milestone 1.6: Participant Inbox (/inbox)
 * - T6.1: Letter listing with unread indicators and delivery timestamps.
 * - T6.2: Letter reader with notice details and Markdown body.
 * - T6.3: Acknowledgment action (mark as read via POST /inbox/{id}/read).
 */
export function InboxPage({ transport = apiTransport }: InboxPageProps) {
  const { token } = useSession()
  const [items, setItems] = useState<Message[]>([])
  const [nextOffset, setNextOffset] = useState<number | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailedMessage, setDetailedMessage] = useState<Message | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [readingLoading, setReadingLoading] = useState(false)
  const [markingRead, setMarkingRead] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadInitial = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchInbox(transport, {
        limit: PAGE_SIZE,
        offset: 0,
        token: token ?? undefined,
      })
      setItems(result.items)
      setNextOffset(result.nextOffset)
      if (result.items.length > 0) {
        setSelectedId((prev) => prev ?? result.items[0]?.id ?? null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inbox')
    } finally {
      setLoading(false)
    }
  }, [token, transport])

  const loadMore = async () => {
    if (nextOffset === null || loadingMore) return
    setLoadingMore(true)
    try {
      const result = await fetchInbox(transport, {
        limit: PAGE_SIZE,
        offset: nextOffset,
        token: token ?? undefined,
      })
      setItems((prev) => [...prev, ...result.items])
      setNextOffset(result.nextOffset)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load more messages',
      )
    } finally {
      setLoadingMore(false)
    }
  }

  // Initial load
  useEffect(() => {
    let active = true
    const init = async () => {
      await Promise.resolve()
      if (active) {
        void loadInitial()
      }
    }
    void init()
    return () => {
      active = false
    }
  }, [loadInitial])

  // Fetch full message when selectedId changes
  useEffect(() => {
    if (!selectedId) return

    const fetchDetail = async () => {
      await Promise.resolve()
      setReadingLoading(true)

      try {
        const fullMsg = await fetchMessage(
          transport,
          selectedId,
          token ?? undefined,
        )
        if (fullMsg) {
          setDetailedMessage(fullMsg)
        }
      } catch {
        // Fall back to item in list
      } finally {
        setReadingLoading(false)
      }
    }

    void fetchDetail()
  }, [selectedId, token, transport])

  const selectedMessage =
    (detailedMessage?.id === selectedId ? detailedMessage : null) ??
    items.find((i) => i.id === selectedId) ??
    null

  // Mark message as read
  const handleMarkRead = async (id: string) => {
    setMarkingRead(true)
    try {
      const success = await markMessageRead(transport, id, token ?? undefined)
      if (success) {
        const nowIso = new Date().toISOString()
        setItems((prev) =>
          prev.map((msg) => (msg.id === id ? { ...msg, readAt: nowIso } : msg)),
        )
        setDetailedMessage((prev) =>
          prev?.id === id ? { ...prev, readAt: nowIso } : prev,
        )
      }
    } finally {
      setMarkingRead(false)
    }
  }

  const unreadCount = items.filter((item) => item.readAt === null).length

  return (
    <section className="inbox-page" aria-labelledby="inbox-title">
      <div className="inbox-header">
        <div>
          <p className="eyebrow">Deliveries</p>
          <h1 id="inbox-title">
            Inbox{' '}
            {unreadCount > 0 && (
              <span className="unread-counter">
                ({unreadCount.toString()} unread)
              </span>
            )}
          </h1>
        </div>
        <button
          type="button"
          className="refresh-btn"
          onClick={() => {
            void loadInitial()
          }}
          disabled={loading}
        >
          {loading ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>

      {error && (
        <div className="dashboard-error" role="alert">
          {error}
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="inbox-loading">
          <p>Retrieving secure communications…</p>
        </div>
      ) : items.length === 0 ? (
        <div className="inbox-empty">
          <p>Your inbox is empty. No notifications or notices delivered yet.</p>
        </div>
      ) : (
        <div className="inbox-layout">
          {/* ── Message List Sidebar (T6.1) ── */}
          <aside className="inbox-sidebar" aria-label="Inbox message list">
            <ul className="inbox-list" role="list">
              {items.map((item) => {
                const isSelected = item.id === selectedId
                const isUnread = item.readAt === null
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`inbox-card ${isSelected ? 'inbox-card--selected' : ''} ${isUnread ? 'inbox-card--unread' : ''}`}
                      onClick={() => {
                        setSelectedId(item.id)
                      }}
                      aria-current={isSelected ? 'true' : undefined}
                    >
                      <div className="inbox-card__meta">
                        <span className="inbox-card__date">
                          {formatLocalTime(Date.parse(item.createdAt))}
                        </span>
                        {isUnread && (
                          <span className="inbox-unread-pill">Unread</span>
                        )}
                      </div>
                      <strong className="inbox-card__title">
                        {item.title}
                      </strong>
                    </button>
                  </li>
                )
              })}
            </ul>

            {nextOffset !== null && (
              <button
                type="button"
                className="inbox-load-more"
                onClick={() => {
                  void loadMore()
                }}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading older letters…' : 'Load older messages'}
              </button>
            )}
          </aside>

          {/* ── Message Reader Pane (T6.2 & T6.3) ── */}
          <main className="inbox-reader" aria-labelledby="message-reader-title">
            {readingLoading && !selectedMessage ? (
              <p>Opening letter…</p>
            ) : selectedMessage ? (
              <article className="inbox-article">
                <header className="inbox-article__header">
                  <div className="inbox-article__meta">
                    <span className="inbox-article__date">
                      Delivered:{' '}
                      {formatLocalTime(Date.parse(selectedMessage.createdAt))}
                    </span>
                    {selectedMessage.readAt ? (
                      <span className="read-timestamp">
                        Read:{' '}
                        {formatLocalTime(Date.parse(selectedMessage.readAt))}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="mark-read-btn"
                        onClick={() => {
                          void handleMarkRead(selectedMessage.id)
                        }}
                        disabled={markingRead}
                      >
                        {markingRead ? 'Acknowledging…' : 'Mark as read'}
                      </button>
                    )}
                  </div>

                  <h2
                    id="message-reader-title"
                    className="inbox-article__title"
                  >
                    {selectedMessage.title}
                  </h2>

                  {selectedMessage.notice &&
                    'accessStatus' in selectedMessage.notice && (
                      <div className="notice-badge">
                        <span className="notice-tag">Repository notice</span>
                        <span>
                          Status:{' '}
                          <strong>{selectedMessage.notice.accessStatus}</strong>
                        </span>
                        {selectedMessage.notice.reason && (
                          <span> — {selectedMessage.notice.reason}</span>
                        )}
                      </div>
                    )}
                </header>

                <div className="inbox-article__body">
                  <SafeMarkdown content={selectedMessage.body} />
                </div>
              </article>
            ) : (
              <p>Select a message to read.</p>
            )}
          </main>
        </div>
      )}
    </section>
  )
}

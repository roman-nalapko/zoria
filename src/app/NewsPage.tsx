import { useCallback, useEffect, useState } from 'react'
import type { ApiTransport } from '../api/transport'
import { apiTransport } from './runtime'
import { fetchNews, type News } from '../news/service'
import { formatLocalTime } from '../ether/time'
import { SafeMarkdown } from '../components/SafeMarkdown'

export interface NewsPageProps {
  transport?: ApiTransport
}

const PAGE_SIZE = 10

/**
 * Milestone 1.5: News Feed (/news)
 * - T5.1: Stable, restartable pagination for news list.
 * - T5.2: News detail viewer with publication timestamp in user's local timezone.
 * - T5.3: Safe Markdown renderer without raw HTML execution.
 */
export function NewsPage({ transport = apiTransport }: NewsPageProps) {
  const [items, setItems] = useState<News[]>([])
  const [nextOffset, setNextOffset] = useState<number | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadInitial = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchNews(transport, { limit: PAGE_SIZE, offset: 0 })
      setItems(result.items)
      setNextOffset(result.nextOffset)
      if (result.items.length > 0) {
        setSelectedId((prev) => prev ?? result.items[0]?.id ?? null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load news')
    } finally {
      setLoading(false)
    }
  }, [transport])

  const loadMore = async () => {
    if (nextOffset === null || loadingMore) return
    setLoadingMore(true)
    try {
      const result = await fetchNews(transport, {
        limit: PAGE_SIZE,
        offset: nextOffset,
      })
      setItems((prev) => [...prev, ...result.items])
      setNextOffset(result.nextOffset)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more news')
    } finally {
      setLoadingMore(false)
    }
  }

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

  const selectedItem = items.find((item) => item.id === selectedId) ?? items[0]

  return (
    <section className="news-page" aria-labelledby="news-title">
      <div className="news-header">
        <div>
          <p className="eyebrow">Announcements</p>
          <h1 id="news-title">News Feed</h1>
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
        <div className="news-loading">
          <p>Tuning to broadcast feed…</p>
        </div>
      ) : items.length === 0 ? (
        <div className="news-empty">
          <p>No broadcast announcements yet. Check back soon.</p>
        </div>
      ) : (
        <div className="news-layout">
          {/* ── News List Sidebar (T5.1) ── */}
          <aside className="news-sidebar" aria-label="Announcements list">
            <ul className="news-list" role="list">
              {items.map((item) => {
                const isSelected = item.id === (selectedItem?.id ?? '')
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`news-card ${isSelected ? 'news-card--selected' : ''}`}
                      onClick={() => {
                        setSelectedId(item.id)
                      }}
                      aria-current={isSelected ? 'true' : undefined}
                    >
                      <span className="news-card__date">
                        {item.publishedAt
                          ? formatLocalTime(Date.parse(item.publishedAt))
                          : 'Unpublished draft'}
                      </span>
                      <strong className="news-card__title">{item.title}</strong>
                    </button>
                  </li>
                )
              })}
            </ul>

            {nextOffset !== null && (
              <button
                type="button"
                className="news-load-more"
                onClick={() => {
                  void loadMore()
                }}
                disabled={loadingMore}
              >
                {loadingMore
                  ? 'Loading older news…'
                  : 'Load older announcements'}
              </button>
            )}
          </aside>

          {/* ── News Reader Pane (T5.2 & T5.3) ── */}
          <main className="news-reader" aria-labelledby="reader-title">
            {selectedItem ? (
              <article className="news-article">
                <header className="news-article__header">
                  <div className="news-article__meta">
                    <span>Published</span>
                    <time
                      dateTime={
                        selectedItem.publishedAt ?? selectedItem.createdAt
                      }
                    >
                      {selectedItem.publishedAt
                        ? formatLocalTime(Date.parse(selectedItem.publishedAt))
                        : 'Unpublished'}
                    </time>
                  </div>
                  <h2 id="reader-title" className="news-article__title">
                    {selectedItem.title}
                  </h2>
                </header>

                <div className="news-article__body">
                  <SafeMarkdown content={selectedItem.body} />
                </div>
              </article>
            ) : (
              <p>Select an announcement to read.</p>
            )}
          </main>
        </div>
      )}
    </section>
  )
}

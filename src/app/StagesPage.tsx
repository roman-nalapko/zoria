import { useEffect, useState, useTransition } from 'react'
import type { ApiTransport } from '../api/transport'
import { SafeMarkdown } from '../components/SafeMarkdown'
import {
  acknowledgeStage,
  fetchStage,
  fetchStages,
  type Stage,
  type StageSummary,
} from '../stages/service'
import { useSession } from './useSession'

function formatLocalTime(timestampMs: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestampMs))
}

interface StagesPageProps {
  transport: ApiTransport
}

export function StagesPage({ transport }: StagesPageProps) {
  const { token } = useSession()

  const [items, setItems] = useState<StageSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailedStage, setDetailedStage] = useState<Stage | null>(null)
  const [readingLoading, setReadingLoading] = useState(false)
  const [acknowledging, setAcknowledging] = useState(false)

  const [, startTransition] = useTransition()

  // Load stages list
  useEffect(() => {
    let active = true

    const load = async () => {
      await Promise.resolve()
      setLoading(true)
      setError(null)
      try {
        const res = await fetchStages(transport, token ?? undefined)
        if (active) {
          setItems(res.items)
          setSelectedId((prev) => prev ?? res.items[0]?.id ?? null)
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load tournament stages.',
          )
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [token, transport])

  // Fetch full stage detail when selected
  useEffect(() => {
    if (!selectedId) return

    let active = true
    const loadDetail = async () => {
      await Promise.resolve()
      setReadingLoading(true)
      try {
        const stage = await fetchStage(
          transport,
          selectedId,
          token ?? undefined,
        )
        if (active && stage) {
          setDetailedStage(stage)
        }
      } catch {
        // Fall back to summary item
      } finally {
        if (active) {
          setReadingLoading(false)
        }
      }
    }

    void loadDetail()

    return () => {
      active = false
    }
  }, [selectedId, token, transport])

  const selectedSummary = items.find((s) => s.id === selectedId) ?? null
  const currentStage: Stage | null =
    (detailedStage?.id === selectedId ? detailedStage : null) ??
    (selectedSummary
      ? {
          acknowledgedAt: selectedSummary.acknowledgedAt,
          body: selectedSummary.excerpt,
          errata: null,
          errataAt: selectedSummary.errataAt,
          id: selectedSummary.id,
          position: selectedSummary.position,
          publishedAt: selectedSummary.publishedAt,
          releasedAt: selectedSummary.releasedAt,
          title: selectedSummary.title,
        }
      : null)

  const handleAcknowledge = async (id: string) => {
    setAcknowledging(true)
    try {
      const updated = await acknowledgeStage(transport, id, token ?? undefined)
      if (updated) {
        startTransition(() => {
          setItems((prev) =>
            prev.map((item) =>
              item.id === id
                ? { ...item, acknowledgedAt: updated.acknowledgedAt }
                : item,
            ),
          )
          setDetailedStage(updated)
        })
      }
    } finally {
      setAcknowledging(false)
    }
  }

  return (
    <section className="stages-page" aria-labelledby="stages-title">
      <div className="stages-header">
        <div>
          <p className="eyebrow">Tournament</p>
          <h1 id="stages-title">Tournament Stages</h1>
        </div>
      </div>

      {error && (
        <div className="dashboard-error" role="alert">
          {error}
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="stages-loading">
          <p>Scanning released tournament stages…</p>
        </div>
      ) : items.length === 0 ? (
        <div className="stages-empty">
          <p>No tournament stages have been released yet.</p>
          <p className="empty-hint">
            Part 2 game specifications are scheduled for release on 2026-09-28.
          </p>
        </div>
      ) : (
        <div className="stages-layout">
          {/* Master List Pane (T7.1) */}
          <aside className="stages-master" aria-label="Stages list">
            <ul className="stages-list" role="list">
              {items.map((item) => {
                const isSelected = item.id === selectedId
                const isAcked = item.acknowledgedAt !== null

                return (
                  <li key={item.id} className="stages-list__item">
                    <button
                      type="button"
                      className={`stage-card ${isSelected ? 'stage-card--active' : ''}`}
                      onClick={() => {
                        setSelectedId(item.id)
                      }}
                      aria-current={isSelected ? 'true' : undefined}
                    >
                      <div className="stage-card__meta">
                        <span className="stage-card__position">
                          Part #{item.position.toString()}
                        </span>
                        {isAcked ? (
                          <span className="stage-pill stage-pill--acked">
                            Acknowledged
                          </span>
                        ) : (
                          <span className="stage-pill stage-pill--pending">
                            Pending ack
                          </span>
                        )}
                      </div>
                      <strong className="stage-card__title">
                        {item.title}
                      </strong>
                      <p className="stage-card__excerpt">{item.excerpt}</p>
                    </button>
                  </li>
                )
              })}
            </ul>
          </aside>

          {/* Stage Detail Pane (T7.2 & T7.3) */}
          <main className="stage-reader" aria-labelledby="stage-reader-title">
            {readingLoading && !currentStage ? (
              <p>Loading stage details…</p>
            ) : currentStage ? (
              <article className="stage-article">
                <header className="stage-article__header">
                  <div className="stage-article__meta">
                    <span>
                      Released:{' '}
                      {formatLocalTime(Date.parse(currentStage.releasedAt))}
                    </span>
                    {currentStage.acknowledgedAt ? (
                      <span className="ack-timestamp">
                        ✓ Acknowledged:{' '}
                        {formatLocalTime(
                          Date.parse(currentStage.acknowledgedAt),
                        )}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="ack-stage-btn"
                        onClick={() => {
                          void handleAcknowledge(currentStage.id)
                        }}
                        disabled={acknowledging}
                      >
                        {acknowledging ? 'Acknowledging…' : 'Acknowledge Stage'}
                      </button>
                    )}
                  </div>

                  <h2 id="stage-reader-title" className="stage-article__title">
                    Part {currentStage.position.toString()}:{' '}
                    {currentStage.title}
                  </h2>
                </header>

                {/* Errata Section (T7.2) */}
                {currentStage.errata && (
                  <div className="errata-banner" role="alert">
                    <div className="errata-banner__header">
                      <strong>⚠ Official Errata Notice</strong>
                      {currentStage.errataAt && (
                        <span>
                          Updated:{' '}
                          {formatLocalTime(Date.parse(currentStage.errataAt))}
                        </span>
                      )}
                    </div>
                    <div className="errata-banner__content">
                      <SafeMarkdown content={currentStage.errata} />
                    </div>
                  </div>
                )}

                <div className="stage-article__body">
                  <SafeMarkdown content={currentStage.body} />
                </div>
              </article>
            ) : (
              <p>Select a tournament stage to view technical specifications.</p>
            )}
          </main>
        </div>
      )}
    </section>
  )
}

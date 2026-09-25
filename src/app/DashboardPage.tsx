import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from './useSession'
import { useEther } from './useEther'
import type { EtherController } from '../ether/controller'
import type { ApiTransport } from '../api/transport'
import { apiTransport, etherController } from './runtime'
import { useParticipantDashboard } from '../participant/useParticipantDashboard'
import { formatBucharest } from '../participant/service'
import {
  deriveEtherTiming,
  formatCountdown,
  formatLocalTime,
} from '../ether/time'

const statusCopy = {
  connecting: 'Tuning to the ether',
  error: 'Connection interrupted',
  idle: 'Receiver standing by',
  noise: 'Untrusted noise rejected',
  quiet: 'Channel quiet period',
  signal: 'Verified signal',
} as const

function useClock(): number {
  const [nowMs, setNowMs] = useState(Date.now)
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)
    return () => {
      window.clearInterval(timer)
    }
  }, [])
  return nowMs
}

export interface DashboardPageProps {
  controller?: EtherController
  transport?: ApiTransport
}

/**
 * Milestone 1.3: Participant Dashboard (Console Overview)
 * - T3.1: Repository admission card with accessStatus, reasonCode, and Bucharest timestamp.
 * - T3.2: Quick links to private GitHub repository with verified status indicator.
 * - T3.3: Ether receiver status card (current phase, harbinger countdown, key fingerprint).
 * - T3.4: Participant summary overview: unread news, inbox count, released stages.
 * - T3.5: Polling integration: automatic background polling (60s) with visibility gating.
 */
export function DashboardPage({
  controller = etherController,
  transport = apiTransport,
}: DashboardPageProps) {
  const { info } = useSession()
  const snapshot = useEther(controller)
  const { error, lastUpdated, loading, refresh, repository, summary } =
    useParticipantDashboard(transport)

  const frame = snapshot.frame
  const timing =
    frame && snapshot.receivedAt !== null
      ? deriveEtherTiming(frame, snapshot.receivedAt)
      : null
  const nowMs = useClock()
  const serverNowMs = nowMs + (timing?.serverOffsetMs ?? 0)
  const targetMs =
    frame?.phase === 'window' ? timing?.closesAtMs : timing?.opensAtMs
  const targetLabel =
    frame?.phase === 'window' ? 'Window closes in' : 'Opens in'

  const repoStatus = repository?.accessStatus ?? 'pending'
  const isVerified = repoStatus === 'verified'

  return (
    <div className="dashboard-container">
      {/* ── Dashboard Header ── */}
      <div className="dashboard-header">
        <div>
          <p className="eyebrow">Participant Console</p>
          <h1 id="dashboard-title">
            {info ? info.displayName : 'Participant Dashboard'}
          </h1>
          <p className="dashboard-subtitle">
            Authenticated as <strong>{info?.username}</strong>. Live
            synchronization active.
          </p>
        </div>
        <div className="dashboard-header__actions">
          {lastUpdated && (
            <span className="last-sync" title="Last background poll">
              Updated {new Date(lastUpdated).toLocaleTimeString()}
            </span>
          )}
          <button
            type="button"
            className="refresh-btn"
            onClick={() => {
              void refresh()
            }}
            disabled={loading}
          >
            {loading ? 'Refreshing…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="dashboard-error" role="alert">
          {error}
        </div>
      )}

      {/* ── Overview Grid ── */}
      <div className="dashboard-grid">
        {/* T3.1 & T3.2: Repository Admission Card */}
        <section
          className={`card card--repo ${isVerified ? 'card--verified' : ''}`}
          aria-labelledby="repo-heading"
        >
          <div className="card-header">
            <span className="card-tag">Admission Status</span>
            <span className={`status-pill status-pill--${repoStatus}`}>
              {repoStatus}
            </span>
          </div>

          <h2 id="repo-heading" className="card-title">
            GitHub Repository
          </h2>

          {repository ? (
            <div className="repo-details">
              <a
                href={repository.url}
                target="_blank"
                rel="noopener noreferrer"
                className="repo-link"
                title="Open GitHub repository in new tab"
              >
                <span>{repository.url}</span>
                <span aria-hidden="true">↗</span>
              </a>

              <dl className="telemetry-list">
                <div>
                  <dt>Access review</dt>
                  <dd className="telemetry-highlight">
                    {repository.accessStatus === 'verified'
                      ? '✓ Verified'
                      : repository.accessStatus}
                  </dd>
                </div>
                <div>
                  <dt>Reason code</dt>
                  <dd>
                    <code>{repository.reasonCode ?? 'none'}</code>
                  </dd>
                </div>
                {repository.reason && (
                  <div>
                    <dt>Review detail</dt>
                    <dd>{repository.reason}</dd>
                  </div>
                )}
                <div>
                  <dt>Last checked (Bucharest)</dt>
                  <dd>{formatBucharest(repository.checkedAt)}</dd>
                </div>
              </dl>
            </div>
          ) : (
            <div className="repo-fallback">
              <p>Checking repository review status…</p>
            </div>
          )}
        </section>

        {/* T3.3: Ether Receiver Status Card */}
        <section className="card card--ether" aria-labelledby="ether-heading">
          <div className="card-header">
            <span className="card-tag">Ether Link</span>
            <div className={`signal-state signal-state--${snapshot.status}`}>
              <span className="signal-dot" aria-hidden="true" />
              <span>{statusCopy[snapshot.status]}</span>
            </div>
          </div>

          <h2 id="ether-heading" className="card-title">
            Radio Telemetry
          </h2>

          <div className="ether-details">
            {targetMs !== null && targetMs !== undefined && (
              <div className="card-countdown">
                <span className="countdown-label">{targetLabel}</span>
                <strong>{formatCountdown(targetMs, serverNowMs)}</strong>
              </div>
            )}

            <dl className="telemetry-list">
              <div>
                <dt>Current phase</dt>
                <dd>
                  <code>{frame?.phase ?? 'static'}</code>
                </dd>
              </div>
              <div>
                <dt>Frame time</dt>
                <dd>
                  {frame
                    ? formatLocalTime(Date.parse(frame.at))
                    : 'Awaiting signal'}
                </dd>
              </div>
              <div>
                <dt>Key fingerprint</dt>
                <dd title={snapshot.keyFingerprint ?? undefined}>
                  {snapshot.keyFingerprint
                    ? `${snapshot.keyFingerprint.slice(0, 16)}…`
                    : 'Awaiting signal'}
                </dd>
              </div>
            </dl>

            <Link to="/ether" className="card-action-link">
              View ether receiver details →
            </Link>
          </div>
        </section>

        {/* T3.4: Tournament Summary Counters */}
        <section
          className="card card--summary"
          aria-labelledby="summary-heading"
        >
          <div className="card-header">
            <span className="card-tag">Activity</span>
            <span className="card-tag card-tag--meta">Tournament pulse</span>
          </div>

          <h2 id="summary-heading" className="card-title">
            Tournament Overview
          </h2>

          <div className="summary-counters">
            <Link to="/news" className="counter-item">
              <span className="counter-number">{summary?.unread ?? 0}</span>
              <span className="counter-label">Unread News</span>
            </Link>

            <Link to="/inbox" className="counter-item">
              <span className="counter-number">{summary?.unread ?? 0}</span>
              <span className="counter-label">Inbox</span>
            </Link>

            <Link to="/stages" className="counter-item">
              <span className="counter-number">
                {summary?.releasedStages ?? 0}
              </span>
              <span className="counter-label">Released Stages</span>
            </Link>

            <div className="counter-item counter-item--dim">
              <span className="counter-number">
                {summary?.acknowledgedStages ?? 0}
              </span>
              <span className="counter-label">Acknowledged</span>
            </div>
          </div>

          {summary?.latestNews && (
            <p className="latest-news-hint">
              Latest announcement published:{' '}
              {formatBucharest(summary.latestNews)}
            </p>
          )}
        </section>
      </div>
    </div>
  )
}

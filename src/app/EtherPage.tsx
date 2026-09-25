import { useEffect, useState } from 'react'
import { pollingCoordinator } from '../api/polling'
import type { ApiTransport } from '../api/transport'
import {
  initialFragmentAssembly,
  reduceFragmentAssembly,
  type FragmentAssembly,
} from '../ether/assembler'
import type { EtherController } from '../ether/controller'
import {
  canPollEtherRoll,
  claimEtherRollPoll,
  fetchEtherRoll,
} from '../ether/roll'
import type { RollEntry } from '../ether/verifier'
import { useEther } from './useEther'

function formatBucharest(timestampMs: number): string {
  return new Intl.DateTimeFormat('uk-UA', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'Europe/Bucharest',
  }).format(new Date(timestampMs))
}

function formatDurationSeconds(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export interface EtherPageProps {
  controller: EtherController
  transport: ApiTransport
}

export function EtherPage({ controller, transport }: EtherPageProps) {
  const ether = useEther(controller)
  const frame = ether.frame

  // Fragment Assembler (T8.2) — pure state reduced across incoming frame fragments
  const [assembly, setAssembly] = useState<FragmentAssembly>(
    initialFragmentAssembly,
  )
  const [lastFragmentKey, setLastFragmentKey] = useState<string | null>(null)

  const fragment = frame?.fragment
  const fragmentKey = fragment
    ? `${fragment.n.toString()}/${fragment.of.toString()}:${fragment.text}`
    : null

  if (fragmentKey !== null && fragmentKey !== lastFragmentKey) {
    setLastFragmentKey(fragmentKey)
    setAssembly((prev) => reduceFragmentAssembly(prev, fragment))
  }

  // Ether Roll Viewer (T8.1)
  const [rollEntries, setRollEntries] = useState<RollEntry[]>([])
  const [rollLoading, setRollLoading] = useState(false)
  const [rollError, setRollError] = useState<string | null>(null)
  const [lastRollPolledAt, setLastRollPolledAt] = useState<number | null>(null)
  const [canPollRollNow, setCanPollRollNow] = useState(true)

  // Check rate limit timer every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCanPollRollNow(canPollEtherRoll(pollingCoordinator))
    }, 1000)
    return () => {
      clearInterval(timer)
    }
  }, [])

  const handleFetchRoll = async () => {
    const key = controller.getKey()
    if (!key) {
      setRollError('Ether verification key is not yet loaded.')
      return
    }

    if (!claimEtherRollPoll(pollingCoordinator)) {
      setRollError('Rate limit: Roll may only be queried once per minute.')
      return
    }

    setRollLoading(true)
    setRollError(null)
    setCanPollRollNow(false)

    try {
      const res = await fetchEtherRoll(transport, key)
      if (res.error) {
        setRollError(res.error)
      } else {
        setRollEntries(res.entries)
        setLastRollPolledAt(Date.now())
      }
    } finally {
      setRollLoading(false)
    }
  }

  return (
    <section className="ether-page" aria-labelledby="ether-title">
      <div className="ether-header">
        <div>
          <p className="eyebrow">Radio Ether Receiver</p>
          <h1 id="ether-title">Airwaves & Telemetry</h1>
        </div>
        <div className="ether-signal-badge">
          <span className={`signal-dot signal-dot--${ether.status}`} />
          <span className="signal-status-text">Status: {ether.status}</span>
        </div>
      </div>

      <div className="ether-grid">
        {/* ── Frame Telemetry Card ── */}
        <article className="ether-card">
          <header className="ether-card__header">
            <h2 className="ether-card__title">📡 Live Signal</h2>
            {ether.receivedAt && (
              <span className="ether-card__time">
                Received: {formatBucharest(ether.receivedAt)}
              </span>
            )}
          </header>

          <div className="ether-telemetry-body">
            <dl className="telemetry-list">
              <div>
                <dt>Carrier Phase</dt>
                <dd className="carrier-phase">
                  <strong>{frame?.phase ?? 'Noise / Undetermined'}</strong>
                </dd>
              </div>

              <div>
                <dt>Station</dt>
                <dd>{frame?.station ?? 'Seeking…'}</dd>
              </div>

              <div>
                <dt>Active on Air</dt>
                <dd>
                  {frame?.onAir !== undefined
                    ? `${frame.onAir.toString()} participants`
                    : '0'}
                </dd>
              </div>

              <div>
                <dt>Key Fingerprint</dt>
                <dd className="fingerprint-mono">
                  {ether.keyFingerprint ?? 'Unverified'}
                </dd>
              </div>
            </dl>

            {/* Harbinger Countdown */}
            {frame?.harbinger && (
              <div className="harbinger-notice">
                <strong>⏳ Harbinger Signal Detected</strong>
                <p>
                  Window opens in:{' '}
                  <span className="countdown-clock">
                    {formatDurationSeconds(frame.harbinger.opensIn)}
                  </span>
                </p>
                {frame.harbinger.text.uk && (
                  <blockquote className="harbinger-quote">
                    «{frame.harbinger.text.uk}»
                  </blockquote>
                )}
              </div>
            )}
          </div>
        </article>

        {/* ── Fragment Assembler Card (T8.2) ── */}
        <article className="ether-card">
          <header className="ether-card__header">
            <h2 className="ether-card__title">🧩 Fragment Assembler</h2>
            {assembly.totalPieces !== null && (
              <span className="fragment-counter">
                {assembly.fragments.size.toString()} /{' '}
                {assembly.totalPieces.toString()} pieces
              </span>
            )}
          </header>

          <div className="ether-fragment-body">
            {assembly.totalPieces === null ? (
              <p className="no-fragments">
                No letter fragments intercepted in current stream yet.
              </p>
            ) : (
              <div className="fragments-container">
                <div className="fragment-progress-bar">
                  {Array.from({ length: assembly.totalPieces }, (_, idx) => {
                    const pieceNum = idx + 1
                    const hasPiece = assembly.fragments.has(pieceNum)
                    return (
                      <span
                        key={pieceNum}
                        className={`fragment-pip ${hasPiece ? 'fragment-pip--collected' : ''}`}
                        title={`Piece #${pieceNum.toString()}: ${hasPiece ? 'Collected' : 'Missing'}`}
                      >
                        {pieceNum.toString()}
                      </span>
                    )
                  })}
                </div>

                {assembly.isComplete ? (
                  <div className="lore-message">
                    <h3>📜 Fully Assembled Lore Letter:</h3>
                    <p className="assembled-text">
                      {assembly.reconstructedText}
                    </p>
                  </div>
                ) : (
                  <p className="assembly-incomplete-notice">
                    Reconstruction in progress: awaiting remaining airwave
                    transmissions…
                  </p>
                )}
              </div>
            )}
          </div>
        </article>
      </div>

      {/* ── Public Ether Roll Viewer (T8.1) ── */}
      <article className="ether-roll-section" aria-labelledby="roll-title">
        <header className="ether-roll-header">
          <div>
            <h2 id="roll-title">📜 Public Airwave Roll (/ether/roll)</h2>
            <p className="roll-subtitle">
              Public order of participant carrier activations during open
              window. Max 1 poll/minute.
            </p>
          </div>

          <div className="roll-actions">
            {lastRollPolledAt && (
              <span className="last-polled">
                Updated: {formatBucharest(lastRollPolledAt)}
              </span>
            )}
            <button
              type="button"
              className="refresh-roll-btn"
              onClick={() => {
                void handleFetchRoll()
              }}
              disabled={rollLoading || !canPollRollNow}
            >
              {rollLoading
                ? 'Verifying airwaves…'
                : canPollRollNow
                  ? '↻ Query Airwave Roll'
                  : '⏳ Rate limited (60s)'}
            </button>
          </div>
        </header>

        {rollError && (
          <div className="roll-error" role="alert">
            {rollError}
          </div>
        )}

        {rollEntries.length === 0 ? (
          <div className="roll-empty">
            <p>Airwave roll has not been queried or is currently quiet.</p>
            <p className="empty-hint">
              Query the roll during carrier window to view verified participant
              sequence.
            </p>
          </div>
        ) : (
          <div className="roll-table-wrapper">
            <table className="roll-table">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Participant</th>
                  <th scope="col">On-Air Timestamp (Bucharest)</th>
                  <th scope="col">Since Window Open</th>
                </tr>
              </thead>
              <tbody>
                {rollEntries.map((entry) => (
                  <tr key={entry.n}>
                    <td className="roll-index">#{entry.n.toString()}</td>
                    <td className="roll-participant">
                      <strong>{entry.name}</strong>
                    </td>
                    <td>{formatBucharest(Date.parse(entry.at))}</td>
                    <td>+{entry.sinceOpen.toString()}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  )
}

import { useEffect, useState, type ReactNode } from 'react'
import type { AppConfig } from '../config/environment'
import type { EtherController, EtherSnapshot } from '../ether/controller'
import {
  deriveEtherTiming,
  formatCountdown,
  formatLocalTime,
} from '../ether/time'
import { RegistrationPanel } from './RegistrationPanel'
import { apiTransport, appConfig, etherController } from './runtime'
import { useEther } from './useEther'

const milestones = [
  ['Connect', 'Verify sealed ether frames and track the server clock.'],
  [
    'Register',
    'Submit once during the window and recover via login if uncertain.',
  ],
  ['Verify', 'Invite the organizer account, add .zoria, and reach verified.'],
  ['Receive', 'Poll news, inbox, and released task stages safely.'],
] as const

const statusCopy = {
  connecting: 'Tuning to the ether',
  error: 'Connection interrupted',
  idle: 'Receiver standing by',
  noise: 'Untrusted noise rejected',
  quiet: 'Channel quiet period',
  signal: 'Verified signal',
} as const

function useClock(enabled: boolean): number {
  const [nowMs, setNowMs] = useState(Date.now)
  useEffect(() => {
    if (!enabled) return
    const timer = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)
    return () => {
      window.clearInterval(timer)
    }
  }, [enabled])
  return nowMs
}

export interface AppViewProps {
  config: AppConfig
  nowMs: number
  registration?: ReactNode
  snapshot: EtherSnapshot
}

export function AppView({
  config,
  nowMs,
  registration,
  snapshot,
}: AppViewProps) {
  const frame = snapshot.frame
  const timing =
    frame && snapshot.receivedAt !== null
      ? deriveEtherTiming(frame, snapshot.receivedAt)
      : null
  const serverNowMs = nowMs + (timing?.serverOffsetMs ?? 0)
  const targetMs =
    frame?.phase === 'window' ? timing?.closesAtMs : timing?.opensAtMs
  const targetLabel =
    frame?.phase === 'window' ? 'Window closes in' : 'Opens in'

  return (
    <main>
      <header className="hero">
        <p className="eyebrow">Zoria 2026 · participant console</p>
        <h1>
          {frame ? statusCopy[snapshot.status] : 'Ready to establish contact.'}
        </h1>
        <p className="lede" aria-live="polite">
          {frame
            ? `The latest frame is cryptographically verified. Phase: ${frame.phase}.`
            : 'The receiver accepts only frames sealed by the pinned Zoria key.'}
        </p>

        <section className="signal-panel" aria-label="Ether receiver status">
          <div className={`signal-state signal-state--${snapshot.status}`}>
            <span className="signal-dot" aria-hidden="true" />
            <span>{statusCopy[snapshot.status]}</span>
          </div>
          {targetMs !== null && targetMs !== undefined && (
            <div className="countdown">
              <span>{targetLabel}</span>
              <strong>{formatCountdown(targetMs, serverNowMs)}</strong>
            </div>
          )}
          <dl className="telemetry">
            <div>
              <dt>Phase</dt>
              <dd>{frame?.phase ?? 'unknown'}</dd>
            </div>
            <div>
              <dt>On air</dt>
              <dd>{frame?.onAir ?? '—'}</dd>
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
              <dt>Local zone</dt>
              <dd>{Intl.DateTimeFormat().resolvedOptions().timeZone}</dd>
            </div>
          </dl>
          {snapshot.message && (
            <p className="diagnostic">
              Diagnostic: <code>{snapshot.message}</code>
            </p>
          )}
        </section>

        <dl className="environment" aria-label="Current API environment">
          <div>
            <dt>Environment</dt>
            <dd>{config.environment}</dd>
          </div>
          <div>
            <dt>API</dt>
            <dd>{config.apiUrl}</dd>
          </div>
          <div>
            <dt>Trust pin</dt>
            <dd title={config.etherKeyFingerprint}>
              {config.etherKeyFingerprint.slice(0, 16)}…
            </dd>
          </div>
        </dl>
      </header>

      {registration}

      <section aria-labelledby="mission-title">
        <h2 id="mission-title">Mission sequence</h2>
        <ol className="milestones">
          {milestones.map(([title, detail]) => (
            <li key={title}>
              <strong>{title}</strong>
              <span>{detail}</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}

export interface AppProps {
  config?: AppConfig
  controller?: EtherController
}

export function App({
  config = appConfig,
  controller = etherController,
}: AppProps) {
  const snapshot = useEther(controller)
  const nowMs = useClock(snapshot.frame !== null)
  return (
    <AppView
      config={config}
      nowMs={nowMs}
      snapshot={snapshot}
      registration={
        <RegistrationPanel snapshot={snapshot} transport={apiTransport} />
      }
    />
  )
}

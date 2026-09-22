import { readAppConfig } from '../config/environment'

const milestones = [
  ['Connect', 'Verify sealed ether frames and track the server clock.'],
  [
    'Register',
    'Submit once during the window and recover via login if uncertain.',
  ],
  ['Verify', 'Invite the organizer account, add .zoria, and reach verified.'],
  ['Receive', 'Poll news, inbox, and released task stages safely.'],
] as const

export function App() {
  const config = readAppConfig()

  return (
    <main>
      <header className="hero">
        <p className="eyebrow">Zoria 2026 · participant console</p>
        <h1>Ready to establish contact.</h1>
        <p className="lede">
          The engineering foundation is in place. Protocol implementation now
          proceeds from the dependency-ordered roadmap.
        </p>
        <dl className="environment" aria-label="Current API environment">
          <div>
            <dt>Environment</dt>
            <dd>{config.environment}</dd>
          </div>
          <div>
            <dt>API</dt>
            <dd>{config.apiUrl}</dd>
          </div>
        </dl>
      </header>

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

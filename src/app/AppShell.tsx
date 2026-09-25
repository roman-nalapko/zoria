import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useSession } from './useSession'
import { SessionExpiryBanner } from './SessionExpiryBanner'
import type { AppConfig } from '../config/environment'
import type { ApiTransport } from '../api/transport'
import { apiTransport } from './runtime'

export interface AppShellProps {
  config: AppConfig
  transport?: ApiTransport
}

/**
 * T1.1 — Persistent top-of-page navigation shell.
 * Renders nav links that are only active when the user is authenticated,
 * plus environment badge, session expiry warnings (T2.3), and server logout (T2.4).
 */
export function AppShell({ config, transport = apiTransport }: AppShellProps) {
  const { authenticated, info, logout, token } = useSession()
  const navigate = useNavigate()

  const handleLogout = async (): Promise<void> => {
    try {
      if (token) {
        await transport.request('/auth/logout', {
          body: {},
          method: 'POST',
          token,
        })
      }
    } catch {
      // Non-fatal if logout endpoint or network fails
    } finally {
      logout()
      void navigate('/login')
    }
  }

  return (
    <>
      <header className="app-header" role="banner">
        <nav className="app-nav" aria-label="Primary navigation">
          <NavLink to="/" className="app-nav__brand" aria-label="Zoria home">
            <span aria-hidden="true">◈</span> Zoria 2026
          </NavLink>

          {authenticated && (
            <ul className="app-nav__links" role="list">
              <li>
                <NavLink to="/dashboard">Dashboard</NavLink>
              </li>
              <li>
                <NavLink to="/ether">Ether</NavLink>
              </li>
              <li>
                <NavLink to="/news">News</NavLink>
              </li>
              <li>
                <NavLink to="/inbox">Inbox</NavLink>
              </li>
              <li>
                <NavLink to="/stages">Stages</NavLink>
              </li>
            </ul>
          )}

          <div className="app-nav__meta">
            <span
              className={`env-badge env-badge--${config.environment}`}
              title={`API: ${config.apiUrl}`}
            >
              {config.environment}
            </span>

            {authenticated && info && (
              <>
                <span className="app-nav__user" aria-label="Logged in as">
                  {info.username}
                </span>
                <button
                  type="button"
                  className="app-nav__logout"
                  onClick={() => {
                    void handleLogout()
                  }}
                >
                  Sign out
                </button>
              </>
            )}

            {!authenticated && (
              <NavLink to="/login" className="app-nav__login">
                Sign in
              </NavLink>
            )}
          </div>
        </nav>
      </header>

      <SessionExpiryBanner />

      <main id="main-content" tabIndex={-1} aria-label="Page content">
        <Outlet />
      </main>

      <footer className="app-footer" role="contentinfo">
        <span>
          Trust pin:{' '}
          <code title={config.etherKeyFingerprint}>
            {config.etherKeyFingerprint.slice(0, 16)}…
          </code>
        </span>
      </footer>
    </>
  )
}

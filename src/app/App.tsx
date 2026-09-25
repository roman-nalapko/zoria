import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ErrorBoundary } from './ErrorBoundary'
import { SessionProvider } from './SessionContext'
import { AppShell } from './AppShell'
import { RequireAuth } from './RequireAuth'
import { LoginPage } from './LoginPage'
import { DashboardPage } from './DashboardPage'
import { NewsPage } from './NewsPage'
import { InboxPage } from './InboxPage'
import { StagesPage } from './StagesPage'
import { EtherPage } from './EtherPage'
import { NotFoundPage } from './pages'
import { appConfig, apiTransport, etherController } from './runtime'
import type { AppConfig } from '../config/environment'
import type { ApiTransport } from '../api/transport'
import type { EtherController } from '../ether/controller'

export interface AppProps {
  config?: AppConfig
  controller?: EtherController
  transport?: ApiTransport
}

/**
 * Root application component.
 *
 * T1.1 — Shell + navigation
 * T1.2 — Route architecture: /login, /dashboard, /news, /inbox, /stages, /ether
 * T1.3 — Global ErrorBoundary
 * T2.1 — SessionProvider (in-memory vault)
 * T2.2 — LoginPage
 */
export function App({
  config = appConfig,
  controller = etherController,
  transport = apiTransport,
}: AppProps) {
  return (
    <ErrorBoundary>
      <SessionProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell config={config} transport={transport} />}>
              {/* Public routes */}
              <Route
                path="/login"
                element={<LoginPage transport={transport} />}
              />

              {/* Protected routes */}
              <Route element={<RequireAuth />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route
                  path="/dashboard"
                  element={<DashboardPage transport={transport} />}
                />
                <Route
                  path="/news"
                  element={<NewsPage transport={transport} />}
                />
                <Route
                  path="/inbox"
                  element={<InboxPage transport={transport} />}
                />
                <Route
                  path="/stages"
                  element={<StagesPage transport={transport} />}
                />
                <Route
                  path="/ether"
                  element={
                    <EtherPage controller={controller} transport={transport} />
                  }
                />
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </SessionProvider>
    </ErrorBoundary>
  )
}

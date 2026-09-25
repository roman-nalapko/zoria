import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ErrorBoundary } from './ErrorBoundary'
import { SessionProvider } from './SessionContext'
import { AppShell } from './AppShell'
import { RequireAuth } from './RequireAuth'
import { LoginPage } from './LoginPage'
import { DashboardPage } from './DashboardPage'
import {
  EtherPage,
  InboxPage,
  NewsPage,
  NotFoundPage,
  StagesPage,
} from './pages'
import { appConfig, apiTransport } from './runtime'
import type { AppConfig } from '../config/environment'
import type { ApiTransport } from '../api/transport'

export interface AppProps {
  config?: AppConfig
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
  transport = apiTransport,
}: AppProps) {
  return (
    <ErrorBoundary>
      <SessionProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell config={config} />}>
              {/* Public routes */}
              <Route
                path="/login"
                element={<LoginPage transport={transport} />}
              />

              {/* Protected routes */}
              <Route element={<RequireAuth />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/news" element={<NewsPage />} />
                <Route path="/inbox" element={<InboxPage />} />
                <Route path="/stages" element={<StagesPage />} />
                <Route path="/ether" element={<EtherPage />} />
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </SessionProvider>
    </ErrorBoundary>
  )
}

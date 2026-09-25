import { Navigate, Outlet } from 'react-router-dom'
import { useSession } from './useSession'

/**
 * T1.2 — Route guard.
 * Redirects to /login if the user is not authenticated.
 */
export function RequireAuth() {
  const { authenticated } = useSession()
  return authenticated ? <Outlet /> : <Navigate to="/login" replace />
}

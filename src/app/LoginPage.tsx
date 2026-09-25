import { type SyntheticEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from './useSession'
import type { ApiTransport } from '../api/transport'
import { parseParticipantSession } from '../auth/registration'

export interface LoginPageProps {
  transport: ApiTransport
}

/**
 * T2.2 — Login form.
 * POSTs to /auth/login, stores session via SessionContext.login(), then
 * redirects to /dashboard.
 */
export function LoginPage({ transport }: LoginPageProps) {
  const { login } = useSession()
  const navigate = useNavigate()

  const [username, setUsername] = useState('roman-nalapko')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: SyntheticEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const response = await transport.request('/auth/login', {
        body: { username, password },
        method: 'POST',
      })
      if (response.ok) {
        const session = parseParticipantSession(response.body)
        if (session) {
          login(session)
          void navigate('/dashboard')
          return
        }
        setError('Server returned an invalid session response.')
      } else {
        const code =
          response.error?.code ?? `http-${response.status.toString()}`
        setError(
          code === 'invalid-credentials'
            ? 'Incorrect username or password.'
            : `Login failed: ${code}`,
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="auth-page" aria-labelledby="login-title">
      <div className="section-heading">
        <p className="eyebrow">Authentication</p>
        <h2 id="login-title">Sign in</h2>
        <p>Your password never leaves this device.</p>
      </div>

      <form onSubmit={(e) => void submit(e)} noValidate className="auth-form">
        <label>
          Username
          <input
            autoComplete="username"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value)
            }}
            required
          />
        </label>

        <label>
          Password
          <input
            autoComplete="current-password"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
            }}
            required
          />
        </label>

        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </section>
  )
}

import { useEffect, useMemo, useState, type SyntheticEvent } from 'react'
import type { EtherSnapshot } from '../ether/controller'
import { loadSafeDraft, saveSafeDraft, toSafeDraft } from '../auth/draft'
import {
  RegistrationService,
  type RegistrationResult,
  type RegistrationTransport,
} from '../auth/registration'
import {
  normalizeRegistration,
  validateRegistration,
  type RegistrationErrors,
  type RegistrationInput,
} from '../auth/validation'

const defaultInput: RegistrationInput = {
  displayName: 'roman-nalapko',
  invitation: '',
  lang: 'uk',
  password: '',
  repositoryUrl: 'https://github.com/roman-nalapko/zoria',
  username: 'roman-nalapko',
}

function initialInput(): RegistrationInput {
  const safe = loadSafeDraft(localStorage)
  return safe
    ? { ...defaultInput, ...safe, username: defaultInput.username }
    : defaultInput
}

export interface RegistrationPanelProps {
  snapshot: EtherSnapshot
  transport: RegistrationTransport
}

export function RegistrationPanel({
  snapshot,
  transport,
}: RegistrationPanelProps) {
  const [input, setInput] = useState(initialInput)
  const [errors, setErrors] = useState<RegistrationErrors>({})
  const [rememberSafeFields, setRememberSafeFields] = useState(
    () => loadSafeDraft(localStorage) !== null,
  )
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<RegistrationResult | null>(null)
  const service = useMemo(() => new RegistrationService(transport), [transport])
  const verifiedWindowOpen =
    snapshot.status === 'signal' && snapshot.frame?.phase === 'window'

  useEffect(() => {
    saveSafeDraft(localStorage, rememberSafeFields ? toSafeDraft(input) : null)
  }, [input, rememberSafeFields])

  const update = (field: keyof RegistrationInput, value: string) => {
    setInput((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const submit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalized = normalizeRegistration(input)
    const nextErrors = validateRegistration(normalized)
    setInput(normalized)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0 || !verifiedWindowOpen) return

    setSubmitting(true)
    setResult(null)
    const nextResult = await service.register(normalized, verifiedWindowOpen)
    setResult(nextResult)
    setSubmitting(false)
    if (nextResult.kind === 'success') {
      setInput((current) => ({ ...current, invitation: '', password: '' }))
    }
  }

  return (
    <section className="registration" aria-labelledby="registration-title">
      <div className="section-heading">
        <p className="eyebrow">Admission</p>
        <h2 id="registration-title">Registration console</h2>
        <p>
          Secrets stay in this tab only. Save your password in a password
          manager before submitting; it is needed for recovery and later login.
        </p>
      </div>

      <div
        className={`window-gate ${verifiedWindowOpen ? 'is-open' : ''}`}
        role="status"
      >
        <strong>
          {verifiedWindowOpen ? 'Verified window open' : 'Submission locked'}
        </strong>
        <span>
          {verifiedWindowOpen
            ? 'The signed ether frame permits registration.'
            : 'Waiting for a signed ether frame with phase: window.'}
        </span>
      </div>

      <form onSubmit={(event) => void submit(event)} noValidate>
        <label>
          Network username
          <input
            autoComplete="username"
            readOnly
            value={input.username}
            onChange={(event) => {
              update('username', event.target.value)
            }}
            aria-invalid={Boolean(errors.username)}
          />
          {errors.username && <small>{errors.username}</small>}
        </label>
        <label>
          Public display name
          <input
            value={input.displayName}
            onChange={(event) => {
              update('displayName', event.target.value)
            }}
            aria-invalid={Boolean(errors.displayName)}
          />
          {errors.displayName && <small>{errors.displayName}</small>}
        </label>
        <label>
          Private GitHub repository
          <input
            inputMode="url"
            value={input.repositoryUrl}
            onChange={(event) => {
              update('repositoryUrl', event.target.value)
            }}
            aria-invalid={Boolean(errors.repositoryUrl)}
          />
          {errors.repositoryUrl && <small>{errors.repositoryUrl}</small>}
        </label>
        <label>
          Account language
          <select
            value={input.lang}
            onChange={(event) => {
              update('lang', event.target.value)
            }}
          >
            <option value="uk">Українська</option>
            <option value="en">English</option>
          </select>
        </label>
        <label>
          Invitation code
          <input
            autoComplete="off"
            type="password"
            value={input.invitation}
            onChange={(event) => {
              update('invitation', event.target.value)
            }}
            aria-invalid={Boolean(errors.invitation)}
          />
          {errors.invitation && <small>{errors.invitation}</small>}
        </label>
        <label>
          Password
          <input
            autoComplete="new-password"
            type="password"
            value={input.password}
            onChange={(event) => {
              update('password', event.target.value)
            }}
            aria-invalid={Boolean(errors.password)}
          />
          {errors.password && <small>{errors.password}</small>}
        </label>
        <label className="consent">
          <input
            type="checkbox"
            checked={rememberSafeFields}
            onChange={(event) => {
              setRememberSafeFields(event.target.checked)
            }}
          />
          Remember only non-secret fields on this device. Password and
          invitation are never stored.
        </label>
        <button type="submit" disabled={!verifiedWindowOpen || submitting}>
          {submitting ? 'Registering…' : 'Register in verified window'}
        </button>
      </form>

      {result?.kind === 'success' && (
        <p className="registration-result success" role="status">
          Registered as {result.session.user.username}. Session expires{' '}
          {new Date(result.session.expiresAt).toLocaleString()}.
          {result.recovered ? ' Registration was recovered through login.' : ''}
        </p>
      )}
      {result?.kind === 'failure' && (
        <p className="registration-result failure" role="alert">
          Registration not completed: {result.code}.
          {result.requestId ? ` Request ID: ${result.requestId}.` : ''}
        </p>
      )}
    </section>
  )
}

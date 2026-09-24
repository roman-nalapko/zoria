import type { AccountLanguage, RegistrationInput } from './validation'

export interface SafeRegistrationDraft {
  displayName: string
  lang: AccountLanguage
  repositoryUrl: string
  username: string
}

export const REGISTRATION_DRAFT_KEY = 'zoria.registration.safe-draft.v1'

function isSafeDraft(value: unknown): value is SafeRegistrationDraft {
  if (typeof value !== 'object' || value === null) return false
  const draft = value as Record<string, unknown>
  return (
    typeof draft.displayName === 'string' &&
    (draft.lang === 'uk' || draft.lang === 'en') &&
    typeof draft.repositoryUrl === 'string' &&
    typeof draft.username === 'string'
  )
}

export function toSafeDraft(input: RegistrationInput): SafeRegistrationDraft {
  const { displayName, lang, repositoryUrl, username } = input
  return { displayName, lang, repositoryUrl, username }
}

export function loadSafeDraft(storage: Storage): SafeRegistrationDraft | null {
  try {
    const raw = storage.getItem(REGISTRATION_DRAFT_KEY)
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    return isSafeDraft(value) ? value : null
  } catch {
    return null
  }
}

export function saveSafeDraft(
  storage: Storage,
  draft: SafeRegistrationDraft | null,
): void {
  if (draft) {
    storage.setItem(REGISTRATION_DRAFT_KEY, JSON.stringify(draft))
  } else {
    storage.removeItem(REGISTRATION_DRAFT_KEY)
  }
}

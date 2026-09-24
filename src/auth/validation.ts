export type AccountLanguage = 'en' | 'uk'

export interface RegistrationInput {
  displayName: string
  invitation: string
  lang: AccountLanguage
  password: string
  repositoryUrl: string
  username: string
}

export type RegistrationField = keyof RegistrationInput
export type RegistrationErrors = Partial<Record<RegistrationField, string>>

const USERNAME_PATTERN = /^[a-z][a-z0-9_-]{2,31}$/
const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/
const REPOSITORY_PATTERN = /^[A-Za-z0-9._-]{1,100}$/

export function normalizeGitHubRepository(value: string): string | null {
  const trimmed = value.trim()
  const candidate = trimmed.includes('://')
    ? trimmed
    : `https://github.com/${trimmed}`

  try {
    const url = new URL(candidate)
    if (
      url.protocol !== 'https:' ||
      (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return null
    }

    const parts = url.pathname.split('/').filter(Boolean)
    if (parts.length !== 2) return null
    const owner = parts[0]
    const repository = parts[1]?.replace(/\.git$/, '')
    if (
      !owner ||
      !repository ||
      !OWNER_PATTERN.test(owner) ||
      !REPOSITORY_PATTERN.test(repository)
    ) {
      return null
    }
    return `https://github.com/${owner}/${repository}`
  } catch {
    return null
  }
}

export function validateRegistration(
  input: RegistrationInput,
): RegistrationErrors {
  const errors: RegistrationErrors = {}
  if (!USERNAME_PATTERN.test(input.username)) {
    errors.username = 'Use 3–32 lowercase letters, numbers, _ or -.'
  }
  if (input.password.length < 12 || input.password.length > 256) {
    errors['password'] = 'Password must contain 12–256 characters.'
  }
  if (input.displayName.trim() === '' || input.displayName.length > 80) {
    errors.displayName = 'Display name must contain 1–80 characters.'
  }
  if (input.invitation.trim() === '' || input.invitation.length > 100) {
    errors.invitation = 'Enter the one-time invitation code locally.'
  }
  if (!normalizeGitHubRepository(input.repositoryUrl)) {
    errors.repositoryUrl = 'Use an exact github.com/owner/repository root URL.'
  }
  return errors
}

export function normalizeRegistration(
  input: RegistrationInput,
): RegistrationInput {
  return {
    ...input,
    displayName: input.displayName.trim(),
    invitation: input.invitation.trim(),
    repositoryUrl:
      normalizeGitHubRepository(input.repositoryUrl) ?? input.repositoryUrl,
    username: input.username.trim(),
  }
}

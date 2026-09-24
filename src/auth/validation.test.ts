import { describe, expect, it } from 'vitest'
import {
  normalizeGitHubRepository,
  validateRegistration,
  type RegistrationInput,
} from './validation'

const valid: RegistrationInput = {
  displayName: 'Roman',
  invitation: 'local-secret',
  lang: 'uk',
  password: 'a-secure-password',
  repositoryUrl: 'https://github.com/roman-nalapko/zoria',
  username: 'roman-nalapko',
}

describe('registration validation', () => {
  it('normalizes only exact GitHub repository roots', () => {
    expect(normalizeGitHubRepository('roman-nalapko/zoria')).toBe(
      'https://github.com/roman-nalapko/zoria',
    )
    expect(
      normalizeGitHubRepository('https://github.com/roman-nalapko/zoria.git'),
    ).toBe('https://github.com/roman-nalapko/zoria')
    expect(
      normalizeGitHubRepository(
        'https://github.com/roman-nalapko/zoria/tree/main',
      ),
    ).toBeNull()
    expect(
      normalizeGitHubRepository('https://evil.example/roman-nalapko/zoria'),
    ).toBeNull()
  })

  it('validates all registration fields without echoing their values', () => {
    expect(validateRegistration(valid)).toEqual({})
    const errors = validateRegistration({
      ...valid,
      displayName: '',
      invitation: '',
      password: 'short',
      repositoryUrl: `${valid.repositoryUrl}/issues`,
      username: 'Bad',
    })
    expect(Object.keys(errors).sort()).toEqual([
      'displayName',
      'invitation',
      'password',
      'repositoryUrl',
      'username',
    ])
    expect(JSON.stringify(errors)).not.toContain('short')
  })
})

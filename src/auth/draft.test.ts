import { beforeEach, describe, expect, it } from 'vitest'
import {
  loadSafeDraft,
  REGISTRATION_DRAFT_KEY,
  saveSafeDraft,
  toSafeDraft,
} from './draft'

describe('safe registration draft', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('never includes invitation or password', () => {
    const safe = toSafeDraft({
      displayName: 'Roman',
      invitation: 'must-not-persist',
      lang: 'uk',
      password: 'example-must-not-persist',
      repositoryUrl: 'https://github.com/roman-nalapko/zoria',
      username: 'roman-nalapko',
    })
    saveSafeDraft(localStorage, safe)

    const raw = localStorage.getItem(REGISTRATION_DRAFT_KEY) ?? ''
    expect(raw).not.toContain('must-not-persist')
    expect(loadSafeDraft(localStorage)).toEqual(safe)
  })
})

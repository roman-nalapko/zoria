import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadState, saveState } from './state-file.js'

// Use a temp dir that is isolated per test run.
const TEST_STATE_DIR = join(process.cwd(), 'dist-worker-test-tmp')

describe('state-file (R3)', () => {
  beforeEach(() => {
    process.env.ZORIA_STATE_DIR = TEST_STATE_DIR
  })

  afterEach(() => {
    delete process.env.ZORIA_STATE_DIR
    try {
      rmSync(join(TEST_STATE_DIR, 'worker-state.json'))
    } catch {
      // May not exist.
    }
  })

  it('returns defaults when no state file exists', () => {
    const state = loadState()
    expect(state.latestFrameAt).toBe(0)
    expect(state.quietUntil).toBe(0)
  })

  it('round-trips state through save and load', () => {
    const now = Date.now()
    saveState({ latestFrameAt: now, quietUntil: now + 5000 })
    const loaded = loadState()

    expect(loaded.latestFrameAt).toBe(now)
    expect(loaded.quietUntil).toBe(now + 5000)
  })

  it('returns defaults on corrupt state file', () => {
    mkdirSync(TEST_STATE_DIR, { recursive: true })
    writeFileSync(join(TEST_STATE_DIR, 'worker-state.json'), 'NOT JSON{{{')

    const state = loadState()
    expect(state.latestFrameAt).toBe(0)
    expect(state.quietUntil).toBe(0)
  })

  it('returns defaults when state file has wrong shape', () => {
    mkdirSync(TEST_STATE_DIR, { recursive: true })
    writeFileSync(
      join(TEST_STATE_DIR, 'worker-state.json'),
      JSON.stringify({ foo: 'bar' }),
    )

    const state = loadState()
    expect(state.latestFrameAt).toBe(0)
    expect(state.quietUntil).toBe(0)
  })

  it('does not throw when the directory is not writable (non-fatal R1)', () => {
    // Try saving to a path that does not exist and cannot be created.
    process.env.ZORIA_STATE_DIR = '/nonexistent-path-abcxyz'
    // Should not throw.
    expect(() => {
      saveState({ latestFrameAt: 1, quietUntil: 2 })
    }).not.toThrow()
  })
})

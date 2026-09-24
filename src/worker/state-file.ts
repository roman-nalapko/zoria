/**
 * Durable non-secret worker state persisted between once.js invocations.
 *
 * Only non-sensitive timing values are stored. Never write secrets, tokens,
 * invitation codes, or private response bodies to this file.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export interface WorkerState {
  /** Unix ms of the most recently accepted verified frame timestamp. */
  latestFrameAt: number
  /** Unix ms before which no request should be sent to the API origin. */
  quietUntil: number
}

const DEFAULT_STATE: WorkerState = { latestFrameAt: 0, quietUntil: 0 }

function resolveStatePath(): string {
  // Store alongside the compiled worker output so it survives between
  // once.js invocations within the same Actions job working directory.
  const base = process.env.ZORIA_STATE_DIR ?? join(process.cwd(), 'dist-worker')
  return join(base, 'worker-state.json')
}

export function loadState(): WorkerState {
  const path = resolveStatePath()
  try {
    const raw = readFileSync(path, 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as Record<string, unknown>).latestFrameAt !== 'number' ||
      typeof (parsed as Record<string, unknown>).quietUntil !== 'number'
    ) {
      return { ...DEFAULT_STATE }
    }
    const { latestFrameAt, quietUntil } = parsed as WorkerState
    return {
      latestFrameAt: Number.isFinite(latestFrameAt) ? latestFrameAt : 0,
      quietUntil: Number.isFinite(quietUntil) ? quietUntil : 0,
    }
  } catch {
    // File missing on first run — start fresh.
    return { ...DEFAULT_STATE }
  }
}

export function saveState(state: WorkerState): void {
  const path = resolveStatePath()
  try {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, JSON.stringify(state), 'utf8')
  } catch (err) {
    // Non-fatal: loss of state means we may accept a repeated frame.
    // It is safe because registration is idempotent (login-first check).
    console.error(
      'Could not persist worker state:',
      err instanceof Error ? err.message : 'unknown',
    )
  }
}

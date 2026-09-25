import {
  MINIMUM_POLL_INTERVAL_MS,
  type PollingCoordinator,
} from '../api/polling'
import type { RawApiResponse } from '../api/transport'
import { verifyEtherEnvelope, type EtherKey, type RollEntry } from './verifier'

export interface EtherRollSnapshot {
  entries: RollEntry[]
  lastPolledAt: number | null
  loading: boolean
  error: string | null
}

export interface EtherRollTransport {
  request(path: string): Promise<RawApiResponse>
}

/**
 * T8.1: Fetch and verify the sealed ether roll (/ether/roll).
 * The roll is returned as an envelope signed by the ether key.
 */
export async function fetchEtherRoll(
  transport: EtherRollTransport,
  key: EtherKey,
): Promise<{ entries: RollEntry[]; error: string | null }> {
  try {
    const res = await transport.request('/ether/roll')
    if (!res.ok) {
      return {
        entries: [],
        error: res.error?.code ?? `http-${res.status.toString()}`,
      }
    }

    const verified = await verifyEtherEnvelope(res.body, key)
    if (verified.kind !== 'signal') {
      return {
        entries: [],
        error: `unverified-envelope: ${verified.reason}`,
      }
    }

    return {
      entries: verified.frame.roll ?? [],
      error: null,
    }
  } catch (err) {
    return {
      entries: [],
      error: err instanceof Error ? err.message : 'failed-to-fetch-roll',
    }
  }
}

/**
 * Check if polling /ether/roll is allowed under the 60s minimum interval.
 */
export function canPollEtherRoll(
  polling: PollingCoordinator,
  nowMs: number = Date.now(),
): boolean {
  return polling.remainingMs('roll', nowMs) === 0
}

export function claimEtherRollPoll(
  polling: PollingCoordinator,
  nowMs: number = Date.now(),
): boolean {
  return polling.claim('roll', nowMs)
}

export const ROLL_POLL_INTERVAL_MS = MINIMUM_POLL_INTERVAL_MS.roll

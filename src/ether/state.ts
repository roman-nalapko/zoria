import type { EtherFrame } from './verifier'

export interface EtherState {
  frame: EtherFrame | null
  newestAtMs: number
}

export const initialEtherState: EtherState = {
  frame: null,
  newestAtMs: Number.NEGATIVE_INFINITY,
}

export interface FrameReduction {
  accepted: boolean
  state: EtherState
}

export function reduceVerifiedFrame(
  state: EtherState,
  frame: EtherFrame,
): FrameReduction {
  const atMs = Date.parse(frame.at)
  if (Number.isNaN(atMs) || atMs < state.newestAtMs) {
    return { accepted: false, state }
  }

  return {
    accepted: true,
    state: { frame, newestAtMs: atMs },
  }
}

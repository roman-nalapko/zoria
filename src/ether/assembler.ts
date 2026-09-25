import type { EtherFragment } from './verifier'

export interface FragmentAssembly {
  /** Array of fragments collected so far, indexed by 1-based piece number. */
  fragments: Map<number, string>
  /** Total number of pieces expected, if known from any collected fragment. */
  totalPieces: number | null
  /** Whether all fragments from 1 to totalPieces have been collected. */
  isComplete: boolean
  /** Reconstructed text if complete, or null if incomplete. */
  reconstructedText: string | null
}

export class FragmentAssembler {
  readonly #fragments = new Map<number, string>()
  #totalPieces: number | null = null

  /**
   * Feed a new fragment into the assembler.
   * Returns true if a new fragment was added or updated.
   */
  ingest(fragment: EtherFragment): boolean {
    if (
      !Number.isInteger(fragment.n) ||
      !Number.isInteger(fragment.of) ||
      fragment.n < 1 ||
      fragment.of < 1 ||
      fragment.n > fragment.of
    ) {
      return false
    }

    if (this.#totalPieces === null) {
      this.#totalPieces = fragment.of
    } else if (this.#totalPieces !== fragment.of) {
      // Different total pieces count implies a different lore message
      return false
    }

    const existing = this.#fragments.get(fragment.n)
    if (existing === fragment.text) {
      return false
    }

    this.#fragments.set(fragment.n, fragment.text)
    return true
  }

  /**
   * Get the current state of assembly.
   */
  getAssembly(): FragmentAssembly {
    const total = this.#totalPieces
    if (total === null) {
      return {
        fragments: new Map(this.#fragments),
        isComplete: false,
        reconstructedText: null,
        totalPieces: null,
      }
    }

    let complete = true
    const pieces: string[] = []
    for (let i = 1; i <= total; i++) {
      const piece = this.#fragments.get(i)
      if (piece === undefined) {
        complete = false
      } else {
        pieces.push(piece)
      }
    }

    return {
      fragments: new Map(this.#fragments),
      isComplete: complete,
      reconstructedText: complete ? pieces.join('') : null,
      totalPieces: total,
    }
  }

  /**
   * Clear all collected fragments.
   */
  reset(): void {
    this.#fragments.clear()
    this.#totalPieces = null
  }
}

export const initialFragmentAssembly: FragmentAssembly = {
  fragments: new Map(),
  isComplete: false,
  reconstructedText: null,
  totalPieces: null,
}

/**
 * Pure state reduction for assembling fragments across accepted frames.
 */
export function reduceFragmentAssembly(
  current: FragmentAssembly,
  fragment: EtherFragment | null | undefined,
): FragmentAssembly {
  if (!fragment) return current

  if (
    !Number.isInteger(fragment.n) ||
    !Number.isInteger(fragment.of) ||
    fragment.n < 1 ||
    fragment.of < 1 ||
    fragment.n > fragment.of
  ) {
    return current
  }

  const total = current.totalPieces ?? fragment.of
  if (total !== fragment.of) {
    return current
  }

  const existing = current.fragments.get(fragment.n)
  if (existing === fragment.text && current.totalPieces === total) {
    return current
  }

  const newFragments = new Map(current.fragments)
  newFragments.set(fragment.n, fragment.text)

  let complete = true
  const pieces: string[] = []
  for (let i = 1; i <= total; i++) {
    const piece = newFragments.get(i)
    if (piece === undefined) {
      complete = false
    } else {
      pieces.push(piece)
    }
  }

  return {
    fragments: newFragments,
    isComplete: complete,
    reconstructedText: complete ? pieces.join('') : null,
    totalPieces: total,
  }
}

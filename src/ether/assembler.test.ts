import { describe, expect, it } from 'vitest'
import { FragmentAssembler } from './assembler'

describe('FragmentAssembler', () => {
  it('rejects invalid fragment numbers', () => {
    const assembler = new FragmentAssembler()
    expect(assembler.ingest({ n: 0, of: 5, text: 'hello' })).toBe(false)
    expect(assembler.ingest({ n: 6, of: 5, text: 'hello' })).toBe(false)
    expect(assembler.ingest({ n: -1, of: 5, text: 'hello' })).toBe(false)
    expect(assembler.getAssembly().totalPieces).toBeNull()
  })

  it('collects fragments out of order and reconstructs text when complete', () => {
    const assembler = new FragmentAssembler()

    // Add piece 2 of 3
    expect(assembler.ingest({ n: 2, of: 3, text: 'brave ' })).toBe(true)
    let state = assembler.getAssembly()
    expect(state.totalPieces).toBe(3)
    expect(state.isComplete).toBe(false)
    expect(state.reconstructedText).toBeNull()

    // Duplicate piece 2 returns false
    expect(assembler.ingest({ n: 2, of: 3, text: 'brave ' })).toBe(false)

    // Add piece 1 of 3
    expect(assembler.ingest({ n: 1, of: 3, text: 'Hello ' })).toBe(true)
    state = assembler.getAssembly()
    expect(state.isComplete).toBe(false)

    // Add piece 3 of 3
    expect(assembler.ingest({ n: 3, of: 3, text: 'world!' })).toBe(true)
    state = assembler.getAssembly()
    expect(state.isComplete).toBe(true)
    expect(state.reconstructedText).toBe('Hello brave world!')
  })

  it('rejects fragment with mismatched total pieces', () => {
    const assembler = new FragmentAssembler()
    expect(assembler.ingest({ n: 1, of: 2, text: 'Part 1' })).toBe(true)
    expect(assembler.ingest({ n: 2, of: 3, text: 'Part 2' })).toBe(false)
  })

  it('resets assembled pieces', () => {
    const assembler = new FragmentAssembler()
    assembler.ingest({ n: 1, of: 1, text: 'Solo' })
    expect(assembler.getAssembly().isComplete).toBe(true)
    assembler.reset()
    expect(assembler.getAssembly().totalPieces).toBeNull()
    expect(assembler.getAssembly().isComplete).toBe(false)
  })
})

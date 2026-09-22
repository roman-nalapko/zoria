import { describe, expect, it } from 'vitest'
import { PollingCoordinator } from './polling'

describe('PollingCoordinator', () => {
  it('enforces independent minimum intervals', () => {
    const coordinator = new PollingCoordinator()
    expect(coordinator.claim('ether', 1000)).toBe(true)
    expect(coordinator.claim('ether', 15_999)).toBe(false)
    expect(coordinator.remainingMs('ether', 15_999)).toBe(1)
    expect(coordinator.claim('ether', 16_000)).toBe(true)
    expect(coordinator.claim('roll', 1000)).toBe(true)
    expect(coordinator.claim('roll', 60_999)).toBe(false)
  })
})

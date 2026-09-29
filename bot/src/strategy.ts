/* bot :: strategy  
   Власна голова на BlankBot. Стратегія "Максимальний Ткач":

   Мета: побудувати 4 Ткачів якомога швидше і захопити всі ближні руїни.
   - Фаза 1 (1–400): 4 Ткачі, захоплення найближчих руїн (8 тактів кожна).
   - Фаза 2 (400–860): продовження; замовлення якщо відкриті.
   - Передзоря (860–1000): Ткачі рухаються до голок кільця Ключника.
   - Зоря (1000+): захоплення кільця (×2 множник доходу).
   - Завжди: watch-heartbeat (P2-04). */

import { BlankBot } from '@zoria/sdk'
import type { BeliefFrame, WireBot } from '@zoria/sdk'
import { decodeVerdicts } from '@zoria/protocol'
import type { Observe, Order, Hex, Manifest, SlotName } from '@zoria/protocol'

export interface Strategy extends WireBot {
  belief(obs: Observe | null): BeliefFrame | null
}

function hexDist(a: Hex, b: Hex): number {
  return (
    (Math.abs(a.q - b.q) +
      Math.abs(a.r - b.r) +
      Math.abs(a.q + a.r - b.q - b.r)) /
    2
  )
}

function hexEq(a: Hex, b: Hex): boolean {
  return a.q === b.q && a.r === b.r
}

class Champion extends BlankBot implements Strategy {
  private ticksSinceAccepted = 0

  // From manifest
  private seat: Hex = { q: 0, r: 0 }
  private ruins: Hex[] = []
  private ringNeedles: Hex[] = []
  private citadel: Hex = { q: 0, r: 0 }
  private dawnAt = 1000
  private cherta = 6

  // Per-unit assignment: unitId -> target hex (ruin or ring needle)
  private unitTarget = new Map<string, Hex>()
  // "q,r" keys that are either owned or currently being heated by a unit
  private claimedKeys = new Set<string>()

  override init(manifestBytes: Uint8Array, slot: SlotName): void {
    super.init(manifestBytes, slot)
    const m = this.manifest as Manifest

    const idx = m.perm.indexOf(slot)
    this.seat = idx !== -1 && m.seats[idx] ? m.seats[idx] : { q: 0, r: 0 }
    this.citadel = m.citadel
    this.dawnAt = m.dawn.at
    this.cherta = m.cherta

    for (const n of m.needles) {
      if (n.ring) {
        this.ringNeedles.push({ q: n.q, r: n.r })
      } else if (n.start === null) {
        this.ruins.push({ q: n.q, r: n.r })
      }
    }

    // Sort by distance to our base
    this.ruins.sort((a, b) => hexDist(a, this.seat) - hexDist(b, this.seat))
    this.ringNeedles.sort(
      (a, b) => hexDist(a, this.seat) - hexDist(b, this.seat),
    )
  }

  protected override think(obs: Observe): Order[] {
    const orders: Order[] = []
    const t = obs.t
    const isDawn = obs.pub.dawn || t >= this.dawnAt
    const energy = obs.pulse.energy
    const chan = obs.pulse.chan

    // Sync: all our current needles → claimed
    const ownedKeys = new Set(obs.mine.needles.map((n) => `${n.q},${n.r}`))
    for (const k of ownedKeys) this.claimedKeys.add(k)

    // Clean up dead units
    const liveIds = new Set(obs.mine.units.map((u) => u.id))
    for (const [uid, tgt] of this.unitTarget) {
      if (!liveIds.has(uid)) {
        const k = `${tgt.q},${tgt.r}`
        if (!ownedKeys.has(k)) this.claimedKeys.delete(k)
        this.unitTarget.delete(uid)
      }
    }

    let chanLeft = chan

    // ── Build Tkachs ────────────────────────────────────────────────────────
    // Build 4 Tkachs total (weight=2 each = 8 total = squad cap).
    // Order: build first Tkach at tick 1, subsequent as energy permits.
    const tkachs = obs.mine.units.filter((u) => u.cls === 'ткач')
    const squadWeight = obs.mine.units.reduce(
      (s, u) => s + (u.cls === 'ткач' ? 2 : 1),
      0,
    )

    // Build conditions: enough energy, room in squad, early enough in game
    if (
      !isDawn &&
      chanLeft >= 32 &&
      energy >= 90 &&
      squadWeight <= 6 &&
      tkachs.length < 4 &&
      t < 500
    ) {
      orders.push({ kind: 'yard', cls: 'ткач' })
      chanLeft -= 32
    }

    // ── Available targets (not yet claimed) ─────────────────────────────────
    // Build mutable lists we'll drain as units get assignments
    const availRuins: Hex[] = this.ruins.filter(
      (h) => !this.claimedKeys.has(`${h.q},${h.r}`),
    )
    const availRing: Hex[] = isDawn
      ? this.ringNeedles.filter((h) => !this.claimedKeys.has(`${h.q},${h.r}`))
      : []

    // Pre-dawn ring pre-positioning (only close ones)
    const preDawnRing: Hex[] =
      !isDawn && t >= 860
        ? this.ringNeedles.filter((h) => !this.claimedKeys.has(`${h.q},${h.r}`))
        : []

    // ── Process each Tkach ──────────────────────────────────────────────────
    for (const u of tkachs) {
      if (chanLeft < 32) break

      const prevTarget = this.unitTarget.get(u.id)

      // Mid-step: skip (can't redirect)
      if (u.wait > 0) continue

      // Already at assigned target: heating in progress
      if (prevTarget && hexEq({ q: u.q, r: u.r }, prevTarget)) {
        if (ownedKeys.has(`${prevTarget.q},${prevTarget.r}`)) {
          // Ruin captured! Find next target
          this.unitTarget.delete(u.id)
          // Fall through to reassign
        } else {
          // Still heating — stay put (rule 9.1: heating is automatic when on needle hex)
          continue
        }
      }

      // Has prev target but not at it, and not moving: path may have failed. Re-issue.
      if (prevTarget && !hexEq({ q: u.q, r: u.r }, prevTarget)) {
        if (!u.task?.goal) {
          // No active goal — re-issue move
          if (chanLeft >= 32) {
            orders.push({
              kind: 'move',
              unit: u.id,
              q: prevTarget.q,
              r: prevTarget.r,
              goal: null,
              home: false,
            })
            chanLeft -= 32
          }
        }
        // Either re-issued or currently en-route — don't change assignment
        continue
      }

      // ── Assign new target ─────────────────────────────────────────────────
      let target: Hex | undefined

      // Priority 1: Dawn rush ring needles
      if (isDawn && availRing.length > 0) {
        target = availRing
          .slice()
          .sort(
            (a, b) =>
              hexDist({ q: u.q, r: u.r }, a) - hexDist({ q: u.q, r: u.r }, b),
          )[0]
      }

      // Priority 2: Pre-dawn ring positioning (only if within reach)
      if (!target && preDawnRing.length > 0) {
        const nearest = preDawnRing
          .slice()
          .sort(
            (a, b) =>
              hexDist({ q: u.q, r: u.r }, a) - hexDist({ q: u.q, r: u.r }, b),
          )[0]
        if (nearest && hexDist({ q: u.q, r: u.r }, nearest) <= 10) {
          target = nearest
        }
      }

      // Priority 3: Nearest unclaimed ruin
      if (!target && availRuins.length > 0) {
        const best = availRuins
          .slice()
          .sort(
            (a, b) =>
              hexDist({ q: u.q, r: u.r }, a) - hexDist({ q: u.q, r: u.r }, b),
          )[0]
        if (best) {
          // Avoid provoking Keeper (don't heat inside citadel boundary before dawn)
          if (hexDist(best, this.citadel) > this.cherta || isDawn) {
            target = best
          }
        }
      }

      // Assign & move
      if (target && chanLeft >= 32) {
        const key = `${target.q},${target.r}`
        this.unitTarget.set(u.id, target)
        this.claimedKeys.add(key)

        // Remove from available lists to avoid double-assignment
        const removeFrom = (arr: Hex[]) => {
          const i = arr.findIndex((h) => hexEq(h, target!))
          if (i !== -1) arr.splice(i, 1)
        }
        removeFrom(availRuins)
        removeFrom(availRing)
        removeFrom(preDawnRing)

        orders.push({
          kind: 'move',
          unit: u.id,
          q: target.q,
          r: target.r,
          goal: null,
          home: false,
        })
        chanLeft -= 32
      }
    }

    // ── Heartbeat: P2-04 ────────────────────────────────────────────────────
    if (orders.length === 0 || this.ticksSinceAccepted >= 3) {
      if (chanLeft >= 32) {
        orders.push({
          kind: 'watch',
          q: this.seat.q,
          r: this.seat.r,
          keep: 0,
        })
        chanLeft -= 32
      }
    }

    return orders
  }

  feedback(verdictsBytes: Uint8Array): void {
    const list = decodeVerdicts(verdictsBytes)
    if (list && list.some((v) => v[1] === true)) {
      this.ticksSinceAccepted = 0
    } else {
      this.ticksSinceAccepted++
    }
  }

  belief(_obs: Observe | null): BeliefFrame | null {
    return null
  }
}

export function presets(): string[] {
  return ['чемпіон']
}

export function createStrategy(
  _preset = process.env['ZARIA_PRESET'] || 'чемпіон',
): Strategy {
  return new Champion()
}

/* bot :: strategy
   Чемпіонська стратегія "Математичний Оптимум" на базі BlankBot.

   Математична оптимізація:
   1. Marginal Yield Density: кожна сота оцінюється за типом землі (луг=3, гай/рівнина=2,
      пісок/болото/пагорб=1). Вихід кожної голки розраховується за ядром згортки
      покриття радіуса 3 (1.0 на кільцях 0-1, 2/3 на кільці 2, 1/3 на кільці 3).
   2. ROI-селектор цілей:
      Score(u, r) = (Yield(r) * Multiplier * 0.0005 * BurnTicks * ConnFactor) / InvestTicks,
      де InvestTicks = 2 * dist(u, r) + 8.
   3. Топологічна зв'язність: голки, що з'єднуються з палаючою мережею негайно (<= 5 сот),
      отримують повний коефіцієнт (1.0); незв'язні дисконтуються.
   4. Теорія ігор аукціонів: автоматичні ставки (65 заряду) на тактах 150/350/550/750/900
      для миттєвого отримання 2 безкоштовних голок.
   5. Дипломатичний захист (pact): прийняття вхідних пропозицій розриває ворожі альянси
      та на рівні рушія блокує глушіння наших голок і таран човників.
   6. Живлення палаючих голок (feed): вільні Ткачі розширюють покриття голок на 1 кільце назовні (+24 соти тяги).
   7. Передзоряне позиціонування (950–999) та штурм Зорі (1000–1200, х2 множник).
   8. Heartbeat (P2-04): гарантія збереження керування слотом (watch кожні <= 3 такти). */

import { BlankBot } from '@zoria/sdk'
import type { BeliefFrame, WireBot } from '@zoria/sdk'
import { decodeVerdicts } from '@zoria/protocol'
import type {
  Observe,
  Order,
  Hex,
  Manifest,
  SlotName,
  LotSpec,
} from '@zoria/protocol'

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

  // Дані з маніфесту
  private seat: Hex = { q: 0, r: 0 }
  private ruins: Hex[] = []
  private ringNeedles: Hex[] = []
  private citadel: Hex = { q: 0, r: 0 }
  private dawnAt = 1000
  private cherta = 6
  private lots: LotSpec[] = []
  private biddedLots = new Set<number>()

  // Математична мапа доходів сот та голок
  private cellPriceMap = new Map<string, number>()
  private needleYieldMap = new Map<string, number>()

  // Призначення: unitId -> цільовий гекс
  private unitTarget = new Map<string, Hex>()

  override init(manifestBytes: Uint8Array, slot: SlotName): void {
    super.init(manifestBytes, slot)
    const m = this.manifest as Manifest

    const idx = m.perm.indexOf(slot)
    this.seat = idx !== -1 && m.seats[idx] ? m.seats[idx] : { q: 0, r: 0 }
    this.citadel = m.citadel
    this.dawnAt = m.dawn.at
    this.cherta = m.cherta
    this.lots = m.lots || []

    // 1. Попередня побудова цінової мапи сот
    const types = m.terrain.types
    const defaultPrice = types[0]?.min ?? 2
    for (const [q, r, typeIdx] of m.terrain.cells) {
      this.cellPriceMap.set(`${q},${r}`, types[typeIdx]?.min ?? defaultPrice)
    }

    const getPrice = (q: number, r: number) =>
      this.cellPriceMap.get(`${q},${r}`) ?? defaultPrice

    // 2. Розрахунок потенційної тяги (Yield) для кожної голки
    for (const n of m.needles) {
      if (n.ring) {
        this.ringNeedles.push({ q: n.q, r: n.r })
      } else if (!n.start) {
        this.ruins.push({ q: n.q, r: n.r })
      }

      // Обчислення згортки покриття для голки в радіусі 3
      let y = 0
      for (let dq = -3; dq <= 3; dq++) {
        for (let dr = Math.max(-3, -dq - 3); dr <= Math.min(3, -dq + 3); dr++) {
          const d = (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2
          const w = d <= 1 ? 1 : d === 2 ? 2 / 3 : 1 / 3
          y += w * getPrice(n.q + dq, n.r + dr)
        }
      }
      this.needleYieldMap.set(`${n.q},${n.r}`, y)
    }

    // Початкове сортування за відстанню від бази
    this.ruins.sort((a, b) => hexDist(a, this.seat) - hexDist(b, this.seat))
    this.ringNeedles.sort(
      (a, b) => hexDist(a, this.seat) - hexDist(b, this.seat),
    )
  }

  private getYield(h: Hex): number {
    return this.needleYieldMap.get(`${h.q},${h.r}`) ?? 45.0
  }

  protected override think(obs: Observe): Order[] {
    const orders: Order[] = []
    const t = obs.t
    const isDawn = obs.pub.dawn || t >= this.dawnAt
    const energy = obs.pulse.energy
    const chan = obs.pulse.chan

    // Списки актуальних власних голок
    const ownedNeedles = obs.mine.needles
    const ownedKeys = new Set(ownedNeedles.map((n) => `${n.q},${n.r}`))
    const litNeedles = ownedNeedles.filter((n) => !n.dark)

    // Очищення цілей машин, які загинули
    const liveIds = new Set(obs.mine.units.map((u) => u.id))
    for (const uid of Array.from(this.unitTarget.keys())) {
      if (!liveIds.has(uid)) {
        this.unitTarget.delete(uid)
      }
    }

    // Зайняті цілі (наші голки + призначені активним Ткачам)
    const claimedKeys = new Set<string>(ownedKeys)
    for (const tgt of this.unitTarget.values()) {
      claimedKeys.add(`${tgt.q},${tgt.r}`)
    }

    let chanLeft = chan

    // ── 1. Торги (Аукціони): оптимальна стратегія ────────────────────────────
    for (let i = 0; i < this.lots.length; i++) {
      const lot = this.lots[i]
      if (lot && t >= lot.at - 20 && t < lot.at && !this.biddedLots.has(i)) {
        const hasUnowned = lot.cells.some(
          (c) => !ownedKeys.has(`${c.q},${c.r}`),
        )
        if (hasUnowned && energy >= 65 && chanLeft >= 32) {
          orders.push({ kind: 'bid', lot: i, amount: 65 })
          this.biddedLots.add(i)
          chanLeft -= 32
        }
      }
    }

    // ── 2. Дипломатія (Угоди): нейтралізація ворожих коаліцій ───────────────
    const activePacts = obs.pub.pact.active
    const isPactActive = activePacts.some(
      (p) => p.a === this.slot || p.b === this.slot,
    )
    if (!isPactActive && obs.mine.pact.in.length > 0 && chanLeft >= 32) {
      const offer = obs.mine.pact.in.find((o) => o.left >= 1)
      if (offer) {
        orders.push({ kind: 'pact', op: 'accept', to: offer.who })
        chanLeft -= 32
      }
    }

    // ── 3. Верф: розгортання рою з 4 Ткачів ──────────────────────────────────
    const tkachs = obs.mine.units.filter((u) => u.cls === 'ткач')
    const squadWeight = obs.mine.units.reduce(
      (s, u) => s + (u.cls === 'ткач' ? 2 : 1),
      0,
    )

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

    // ── 4. Доступні руїни та голки кільця ───────────────────────────────────
    const availRuins: Hex[] = this.ruins.filter(
      (h) => !claimedKeys.has(`${h.q},${h.r}`),
    )
    const availRing: Hex[] = isDawn
      ? this.ringNeedles.filter((h) => !claimedKeys.has(`${h.q},${h.r}`))
      : []

    // Передзоря: вільні голки кільця після такту 950
    const preDawnRing: Hex[] =
      !isDawn && t >= 950
        ? this.ringNeedles.filter((h) => !claimedKeys.has(`${h.q},${h.r}`))
        : []

    // Замовлення Доглядача "Утримати лінію"
    const orderBoard = obs.pub.order
    let orderTargets: Hex[] = []
    if (orderBoard && t <= orderBoard.to - 15) {
      orderTargets = orderBoard.cells.filter(
        (c) => !claimedKeys.has(`${c.q},${c.r}`),
      )
    }

    // ── 5. Математична функція оцінки привабливості цілі ───────────────────
    const minLitDist = (h: Hex): number => {
      let minD = hexDist(h, this.seat)
      for (const ln of litNeedles) {
        const d = hexDist(h, ln)
        if (d < minD) minD = d
      }
      return minD
    }

    const scoreCandidate = (
      u: Hex,
      targetHex: Hex,
      isRingTarget: boolean,
    ): number => {
      const d = hexDist(u, targetHex)
      const investTicks = 2 * d + 8
      const remTicks = 1200 - t
      if (investTicks >= remTicks) return -1

      const burnTicks = remTicks - investTicks
      const baseYield = this.getYield(targetHex)
      const multiplier =
        isRingTarget && (isDawn || t + investTicks >= 1000) ? 2.0 : 1.0

      const litD = minLitDist(targetHex)
      const connFactor = litD <= 5 ? 1.0 : litD <= 10 ? 0.6 : 0.25

      const expectedMinutes =
        baseYield * multiplier * 0.0005 * burnTicks * connFactor
      return expectedMinutes / investTicks
    }

    // ── 6. Призначення завдань Ткачам ───────────────────────────────────────
    for (const u of tkachs) {
      if (chanLeft < 32) break

      const prevTarget = this.unitTarget.get(u.id)

      // Машина в русі між сотками — перенаправляти не можна
      if (u.wait > 0) continue

      // Машина прибула на місце
      if (prevTarget && hexEq({ q: u.q, r: u.r }, prevTarget)) {
        if (ownedKeys.has(`${prevTarget.q},${prevTarget.r}`)) {
          // Голку захоплено — звільняємо машину для нової цілі
          this.unitTarget.delete(u.id)
        } else {
          // Триває процес прогріву — стоїмо на місці
          continue
        }
      }

      // Машина зупинилася в дорозі до цілі — відновлюємо рух
      if (prevTarget && !hexEq({ q: u.q, r: u.r }, prevTarget)) {
        if (!u.task?.goal) {
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
        continue
      }

      // ── Обчислення найкращої цілі за ROI ──────────────────────────────────
      let bestTarget: Hex | undefined
      let bestScore = -1
      let isRing = false

      // Пріоритет А: Зоряний штурм кільця Ключника (х2 множник)
      if (isDawn && availRing.length > 0) {
        for (const ringHex of availRing) {
          const s = scoreCandidate({ q: u.q, r: u.r }, ringHex, true)
          if (s > bestScore) {
            bestScore = s
            bestTarget = ringHex
            isRing = true
          }
        }
      }

      // Пріоритет Б: Передзоряне позиціонування (такти 950-999)
      if (!bestTarget && preDawnRing.length > 0) {
        const sortedRing = preDawnRing
          .slice()
          .sort(
            (a, b) =>
              hexDist({ q: u.q, r: u.r }, a) - hexDist({ q: u.q, r: u.r }, b),
          )
        const nearest = sortedRing[0]
        if (nearest && hexDist({ q: u.q, r: u.r }, nearest) <= 12) {
          bestTarget = nearest
          isRing = true
        }
      }

      // Пріоритет В: Замовлення Доглядача (+30 хвилин)
      if (!bestTarget && orderTargets.length > 0) {
        for (const ordHex of orderTargets) {
          if (hexDist({ q: u.q, r: u.r }, ordHex) <= 12) {
            bestTarget = ordHex
            break
          }
        }
      }

      // Пріоритет Г: Звичайні вільні руїни (за математичним ROI)
      if (!bestTarget) {
        const validRuins = availRuins.filter(
          (h) => isDawn || hexDist(h, this.citadel) > this.cherta,
        )
        for (const rHex of validRuins) {
          const s = scoreCandidate({ q: u.q, r: u.r }, rHex, false)
          if (s > bestScore) {
            bestScore = s
            bestTarget = rHex
            isRing = false
          }
        }
      }

      // Пріоритет Д: Якщо цілей немає — живити свою палаючу голку
      if (!bestTarget) {
        const standingOnLit = litNeedles.find((n) =>
          hexEq(n, { q: u.q, r: u.r }),
        )
        if (standingOnLit && !u.task?.feed && chanLeft >= 32) {
          orders.push({
            kind: 'feed',
            unit: u.id,
            q: standingOnLit.q,
            r: standingOnLit.r,
          })
          chanLeft -= 32
        }
        continue
      }

      // Відправка до знайденої оптимальної цілі
      if (bestTarget && chanLeft >= 32) {
        const key = `${bestTarget.q},${bestTarget.r}`
        this.unitTarget.set(u.id, bestTarget)
        claimedKeys.add(key)

        const removeFrom = (arr: Hex[]) => {
          const i = arr.findIndex((h) => hexEq(h, bestTarget!))
          if (i !== -1) arr.splice(i, 1)
        }
        removeFrom(availRuins)
        removeFrom(availRing)
        removeFrom(preDawnRing)
        removeFrom(orderTargets)

        orders.push({
          kind: 'move',
          unit: u.id,
          q: bestTarget.q,
          r: bestTarget.r,
          goal: null,
          home: false,
        })
        chanLeft -= 32
      }
    }

    // ── 7. Heartbeat (P2-04): гарантія активності слота ─────────────────────
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

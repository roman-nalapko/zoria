/* bot :: strategy
   Власна чемпіонська голова на BlankBot.
   Стратегія:
   - Фаза 1 (1–400): швидке розгортання до 4 Ткачів; пріоритетне захоплення
     руїн, які негайно з'єднуються з мережею (<= 5 сот до палаючої голки).
   - Торги (150, 350, 550, 750, 900): автоматичні ставки (65 заряду) на відкриті лоти.
   - Замовлення (40 + 140k): перехоплення цілей замовлення за 30 додаткових хвилин.
   - Живлення (feed): вільні Ткачі на своїх палаючих голках живлять їх (розширення покриття).
   - Передзоря (860–1000): передислокація до кільця Ключника.
   - Зоря (1000+): захоплення кільця (х2 множник хвилин до кінця гри).
   - Завжди: watch-heartbeat на вогнище кожні <= 3 такти без прийнятих команд (P2-04). */

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

    for (const n of m.needles) {
      if (n.ring) {
        this.ringNeedles.push({ q: n.q, r: n.r })
      } else if (!n.start) {
        this.ruins.push({ q: n.q, r: n.r })
      }
    }

    // Сортуємо руїни за відстанню до нашого вогнища
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

    // Актуальні списки власних голок
    const ownedNeedles = obs.mine.needles
    const ownedKeys = new Set(ownedNeedles.map((n) => `${n.q},${n.r}`))
    const litNeedles = ownedNeedles.filter((n) => !n.dark)

    // Очищення цілей загиблих машин
    const liveIds = new Set(obs.mine.units.map((u) => u.id))
    for (const uid of Array.from(this.unitTarget.keys())) {
      if (!liveIds.has(uid)) {
        this.unitTarget.delete(uid)
      }
    }

    // Зайняті цілі: наші голки + голки, куди вже йдуть живі Ткачі
    const claimedKeys = new Set<string>(ownedKeys)
    for (const tgt of this.unitTarget.values()) {
      claimedKeys.add(`${tgt.q},${tgt.r}`)
    }

    let chanLeft = chan

    // ── Торги (аукціони) ────────────────────────────────────────────────────
    // Розігруються на тактах 150, 350, 550, 750, 900.
    // Ставимо 65 заряду (резерв 60), щоб отримати до 2 голок миттєво.
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

    // ── Угоди (Pact) ────────────────────────────────────────────────────────
    // Якщо надходить пропозиція угоди, приймаємо її: це забороняє супернику
    // глушити наші голки і таранити наші човники, руйнуючи коаліцію проти нас.
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

    // ── Верф: будуємо до 4 Ткачів ───────────────────────────────────────────
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

    // ── Вільні руїни та кільце ──────────────────────────────────────────────
    const availRuins: Hex[] = this.ruins.filter(
      (h) => !claimedKeys.has(`${h.q},${h.r}`),
    )
    const availRing: Hex[] = isDawn
      ? this.ringNeedles.filter((h) => !claimedKeys.has(`${h.q},${h.r}`))
      : []

    const preDawnRing: Hex[] =
      !isDawn && t >= 860
        ? this.ringNeedles.filter((h) => !claimedKeys.has(`${h.q},${h.r}`))
        : []

    // ── Замовлення Доглядача ────────────────────────────────────────────────
    const orderBoard = obs.pub.order
    let orderTargets: Hex[] = []
    if (orderBoard && t <= orderBoard.to - 15) {
      orderTargets = orderBoard.cells.filter(
        (c) => !claimedKeys.has(`${c.q},${c.r}`),
      )
    }

    // Перевірка безпосереднього підключення до мережі (<= 5 до палаючої голки чи вогнища)
    const connectsImmediately = (h: Hex) => {
      if (hexDist(h, this.seat) <= 5) return true
      return litNeedles.some((ln) => hexDist(h, ln) <= 5)
    }

    // ── Керування кожним Ткачем ─────────────────────────────────────────────
    for (const u of tkachs) {
      if (chanLeft < 32) break

      const prevTarget = this.unitTarget.get(u.id)

      // Якщо машина посеред кроку (wait > 0), команди повернути відхиляються
      if (u.wait > 0) continue

      // Прибув на призначену ціль
      if (prevTarget && hexEq({ q: u.q, r: u.r }, prevTarget)) {
        if (ownedKeys.has(`${prevTarget.q},${prevTarget.r}`)) {
          // Голку успішно захоплено! Звільняємо Ткача для наступного завдання
          this.unitTarget.delete(u.id)
        } else {
          // Ще гріє голку (правило 9.1) — стоїмо на місці до завершення
          continue
        }
      }

      // Має призначення, але ще не дійшов і шлях зупинився
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

      // ── Пошук нової цілі для Ткача ─────────────────────────────────────────
      let target: Hex | undefined

      // 1. Зоря: блискавичний штурм голок кільця (подвійний дохід)
      if (isDawn && availRing.length > 0) {
        target = availRing
          .slice()
          .sort(
            (a, b) =>
              hexDist({ q: u.q, r: u.r }, a) - hexDist({ q: u.q, r: u.r }, b),
          )[0]
      }

      // 2. Передзоря: підхід до найближчої голки кільця
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

      // 3. Замовлення "Утримати лінію" (+30 хвилин)
      if (!target && orderTargets.length > 0) {
        const closeOrder = orderTargets
          .slice()
          .sort(
            (a, b) =>
              hexDist({ q: u.q, r: u.r }, a) - hexDist({ q: u.q, r: u.r }, b),
          )[0]
        if (closeOrder && hexDist({ q: u.q, r: u.r }, closeOrder) <= 12) {
          target = closeOrder
        }
      }

      // 4. Найближча вільна руїна (надаємо перевагу тим, що підключаються одразу)
      const validRuins = availRuins.filter(
        (h) => isDawn || hexDist(h, this.citadel) > this.cherta,
      )
      if (!target && validRuins.length > 0) {
        target = validRuins.slice().sort((a, b) => {
          const penaltyA = connectsImmediately(a) ? 0 : 15
          const penaltyB = connectsImmediately(b) ? 0 : 15
          const distA = hexDist({ q: u.q, r: u.r }, a) + penaltyA
          const distB = hexDist({ q: u.q, r: u.r }, b) + penaltyB
          return distA - distB
        })[0]
      }

      // 5. Якщо немає вільних руїн, а Ткач стоїть на своїй палаючій голці — живити її!
      if (!target) {
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

      // Призначення та відправка до цілі
      if (target && chanLeft >= 32) {
        const key = `${target.q},${target.r}`
        this.unitTarget.set(u.id, target)
        claimedKeys.add(key)

        const removeFrom = (arr: Hex[]) => {
          const i = arr.findIndex((h) => hexEq(h, target!))
          if (i !== -1) arr.splice(i, 1)
        }
        removeFrom(availRuins)
        removeFrom(availRing)
        removeFrom(preDawnRing)
        removeFrom(orderTargets)

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

    // ── Heartbeat (P2-04): підтримка активності слота кожні <= 3 такти ──────
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

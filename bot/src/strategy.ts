/* bot :: strategy
   Чемпіонська стратегія "Математичний Оптимум 2.0":
   1. Marginal Yield Density: повна згортка цінності соток за картою (луг=3, гай/рівнина=2, пісок/болото=1).
   2. Crown Cycle Formulator (х1.15): алгоритмічний пошук мінімального циклу з 6 голок
      від вогнища. Пріоритет замикання циклу для постійного +15% множника всієї мережі.
   3. Anti-Contest & CapGrace Watchdog: моніторинг ворожих захоплень (obs.events + obs.own).
      Якщо руїну взяв опонент, Ткач негайно перенаправляється (щоб не стояти 60 тактів паузи).
   4. Детекція зайнятих руїн: якщо ворожий Ткач уже стоїть на руїні (obs.foe), вона відсікається.
   5. Координовані замовлення (+30 хв): паралельне захоплення відсутніх ланок замовлення Доглядача.
   6. Торги (Аукціони): оптимальна ставка 65 на тактах 150/350/550/750/900 для миттєвих голок.
   7. Дипломатичний щит: прийняття вхідних угод для захисту від глушіння та тарана.
   8. Передзоряне позиціонування (950–999) + штурм Зорі (1000–1200, х2 множник).
   9. Живлення (feed): вільні Ткачі на палаючих голках збільшують покриття (+24 соти тяги).
   10. Heartbeat (P2-04): гарантія збереження керування слотом (watch кожні <= 3 такти). */

import { BlankBot } from '@zoria/sdk'
import type { BeliefFrame, WireBot } from '@zoria/sdk'
import { createEngine } from '@zoria/engine'
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

  // Математична теплова мапа доходів сот та голок
  private cellPriceMap = new Map<string, number>()
  private needleYieldMap = new Map<string, number>()

  // 6-елементний цикл Вінця (Crown Cycle) для активації множника х1.15
  private crownCycleRuins = new Set<string>()

  // Відстеження ворожого володіння та пауз після взяття (capGrace = 60)
  private enemyGraceUntil = new Map<string, number>()

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

    // 1. Цінова мапа сот
    const types = m.terrain.types
    const defaultPrice = types[0]?.min ?? 2
    for (const [q, r, typeIdx] of m.terrain.cells) {
      this.cellPriceMap.set(`${q},${r}`, types[typeIdx]?.min ?? defaultPrice)
    }

    const getPrice = (q: number, r: number) =>
      this.cellPriceMap.get(`${q},${r}`) ?? defaultPrice

    // 2. Обчислення згортки покриття (Yield) кожної голки
    for (const n of m.needles) {
      if (n.ring) {
        this.ringNeedles.push({ q: n.q, r: n.r })
      } else if (!n.start) {
        this.ruins.push({ q: n.q, r: n.r })
      }

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

    this.ruins.sort((a, b) => hexDist(a, this.seat) - hexDist(b, this.seat))
    this.ringNeedles.sort(
      (a, b) => hexDist(a, this.seat) - hexDist(b, this.seat),
    )

    // 3. Пошук оптимального 6-циклу Вінця (Crown Cycle) за допомогою рушія
    try {
      const E = createEngine()
      E.simInit((m as unknown as { seed?: number }).seed || 2026)
      const seatLetter = (['A', 'B', 'C'][idx] || 'A') as 'A' | 'B' | 'C'
      const startKeys = (E.START_CHAIN && E.START_CHAIN[seatLetter]) || []
      const nonRing = E.NEEDLES.filter((n: { ring?: boolean }) => !n.ring)

      const adj = new Map<string, string[]>()
      for (const n of nonRing) adj.set(n.key, [])
      for (let i = 0; i < nonRing.length; i++) {
        for (let j = i + 1; j < nonRing.length; j++) {
          const a = nonRing[i]
          const b = nonRing[j]
          if (E.linkOk(a.q, a.r, b.q, b.r)) {
            adj.get(a.key)!.push(b.key)
            adj.get(b.key)!.push(a.key)
          }
        }
      }

      let bestCycle: string[] = []
      let minMaxD = Infinity

      const dfs = (curr: string, path: string[], visited: Set<string>) => {
        if (path.length >= 6) {
          if (adj.get(curr)?.includes(path[0]!)) {
            let maxD = 0
            for (const k of path) {
              const [q, r] = k.split(',').map(Number)
              const d = hexDist({ q: q!, r: r! }, this.seat)
              if (d > maxD) maxD = d
            }
            if (maxD < minMaxD) {
              minMaxD = maxD
              bestCycle = [...path]
            }
            return
          }
        }
        if (path.length >= 7) return
        for (const next of adj.get(curr) || []) {
          if (!visited.has(next)) {
            visited.add(next)
            dfs(next, [...path, next], visited)
            visited.delete(next)
          }
        }
      }

      for (const s of startKeys) {
        dfs(s, [s], new Set([s]))
      }

      for (const k of bestCycle) {
        if (!startKeys.includes(k)) {
          this.crownCycleRuins.add(k)
        }
      }
    } catch {
      // Якщо граф недоступний, використовуємо найближчі руїни
      for (const r of this.ruins.slice(0, 4)) {
        this.crownCycleRuins.add(`${r.q},${r.r}`)
      }
    }
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

    // ── Моніторинг захоплень ворогами та пауз (capGrace = 60) ───────────────
    for (const ev of obs.events) {
      if (
        ev.type === 'cap' &&
        ev.p &&
        ev.p !== this.slot &&
        ev.q !== undefined &&
        ev.r !== undefined
      ) {
        this.enemyGraceUntil.set(`${ev.q},${ev.r}`, t + 60)
      }
    }

    const enemyOwnedKeys = new Set<string>()
    for (const c of obs.own) {
      if (c.owner && c.owner !== this.slot && c.owner !== 'K') {
        enemyOwnedKeys.add(`${c.q},${c.r}`)
      }
    }

    // Ворожі Ткачі, які вже стоять на руїнах і гріють їх
    const foeWeavers = new Set(
      obs.foe.filter((f) => f.cls === 'ткач').map((f) => `${f.q},${f.r}`),
    )

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

    // ── 1. Торги (Аукціони): оптимальна ставка 71 (вибиває ставки 60 і 65) ──
    for (let i = 0; i < this.lots.length; i++) {
      const lot = this.lots[i]
      if (lot && t >= lot.at - 20 && t < lot.at && !this.biddedLots.has(i)) {
        const hasUnowned = lot.cells.some(
          (c) => !ownedKeys.has(`${c.q},${c.r}`),
        )
        if (hasUnowned && energy >= 71 && chanLeft >= 32) {
          orders.push({ kind: 'bid', lot: i, amount: 71 })
          this.biddedLots.add(i)
          chanLeft -= 32
        } else if (hasUnowned && energy >= 65 && chanLeft >= 32) {
          orders.push({ kind: 'bid', lot: i, amount: 65 })
          this.biddedLots.add(i)
          chanLeft -= 32
        }
      }
    }

    // Замовлення Доглядача "Утримати лінію" (+30 хв)
    const orderBoard = obs.pub.order

    // ── 2. Дипломатія (Угоди): теорія ігор "Два проти лідера" ───────────────
    const slotOrder: SlotName[] = ['A', 'B', 'C']
    const myIdx = slotOrder.indexOf(this.slot)
    const myScore = obs.pub.score ? (obs.pub.score[myIdx] ?? 0) : 0

    let maxOtherScore = -1
    let leaderSlot: SlotName = this.slot
    if (obs.pub.score) {
      for (let i = 0; i < slotOrder.length; i++) {
        const s = obs.pub.score[i] ?? 0
        if (slotOrder[i] !== this.slot && s > maxOtherScore) {
          maxOtherScore = s
          leaderSlot = slotOrder[i]!
        }
      }
    }
    const isWeLeader = myScore >= maxOtherScore

    // Перевірка активного пакту
    const myPact = obs.pub.pact.active.find(
      (p) => p.a === this.slot || p.b === this.slot,
    )

    if (myPact && chanLeft >= 32) {
      const partner = myPact.a === this.slot ? myPact.b : myPact.a
      const partnerIdx = slotOrder.indexOf(partner)
      const partnerScore = obs.pub.score ? (obs.pub.score[partnerIdx] ?? 0) : 0

      // Розриваємо пакт, якщо ми або партнер стали лідером:
      // Економить 10% pactTax з усього нашого доходу та знімає заборону на атаки!
      if (isWeLeader || partnerScore >= maxOtherScore) {
        orders.push({ kind: 'pact', op: 'break', to: partner })
        chanLeft -= 32
      }
    } else if (
      !myPact &&
      !isWeLeader &&
      obs.mine.pact.in.length > 0 &&
      chanLeft >= 32
    ) {
      // Приймаємо угоду ТІЛЬКИ якщо ми відстаємо від лідера (різниця >= 10 хв і >= 15%),
      // і пропозиція надійшла НЕ від лідера (коаліція двох проти лідера):
      const behindLeader =
        maxOtherScore - myScore >= 10 &&
        maxOtherScore - myScore >= 0.15 * maxOtherScore
      if (behindLeader) {
        const offer = obs.mine.pact.in.find(
          (o) => o.left >= 1 && o.who !== leaderSlot,
        )
        if (offer) {
          orders.push({ kind: 'pact', op: 'accept', to: offer.who })
          chanLeft -= 32
        }
      }
    }

    // ── 3. Верф: адаптивне розгортання рою ─────────────────────────────────
    const tkachs = obs.mine.units.filter((u) => u.cls === 'ткач')
    const klinoks = obs.mine.units.filter((u) => u.cls === 'клинок')
    const squadWeight = obs.mine.units.reduce(
      (s, u) => s + (u.cls === 'ткач' ? 2 : 1),
      0,
    )

    // Якщо є загроза глушіння чи прориву (активні завади або ворожі машини біля наших голок):
    const hasJams = obs.mine.jams.length > 0
    const nearbyEnemyKlinok = obs.foe.some(
      (f) =>
        f.cls === 'клинок' &&
        litNeedles.some((n) => hexDist(f, { q: n.q, r: n.r }) <= 6),
    )
    const nearbyEnemyTkach = obs.foe.some(
      (f) =>
        f.cls === 'ткач' &&
        litNeedles.some((n) => hexDist(f, { q: n.q, r: n.r }) <= 4),
    )
    const needDefender =
      (hasJams || nearbyEnemyKlinok || nearbyEnemyTkach) &&
      klinoks.length === 0 &&
      t > 150

    if (!isDawn && chanLeft >= 32) {
      if (tkachs.length < 3 && energy >= 90 && squadWeight <= 6 && t < 500) {
        // Перші 3 машини — завжди Ткачі (швидка експансія та вінець)
        orders.push({ kind: 'yard', cls: 'ткач' })
        chanLeft -= 32
      } else if (
        needDefender &&
        energy >= 50 &&
        squadWeight <= 7 &&
        klinoks.length < 1
      ) {
        // Будуємо Клинок-перехоплювач для тарана ворожих загарбників і глушників
        orders.push({ kind: 'yard', cls: 'клинок' })
        chanLeft -= 32
      } else if (
        tkachs.length < 4 &&
        energy >= 90 &&
        squadWeight <= 6 &&
        t < 500
      ) {
        // Якщо загрози немає — 4-й Ткач для максимальної експансії
        orders.push({ kind: 'yard', cls: 'ткач' })
        chanLeft -= 32
      }
    }

    // ── Керування Клинком-перехоплювачем ─────────────────────────────────────
    if (klinoks.length > 0 && chanLeft >= 32) {
      const k = klinoks[0]!
      if (k.wait === 0) {
        // 1. Таран: знайти пріоритетну ціль (глушник, ворожий Клинок, загарбник біля наших голок або на замовленні)
        const targetToRam =
          obs.foe.find(
            (f) =>
              f.cls === 'клинок' &&
              (obs.mine.jams.some((j) => hexDist(f, { q: j.q, r: j.r }) <= 1) ||
                litNeedles.some((n) => hexDist(f, { q: n.q, r: n.r }) <= 5)),
          ) ||
          obs.foe.find(
            (f) =>
              f.cls === 'ткач' &&
              litNeedles.some((n) => hexDist(f, { q: n.q, r: n.r }) <= 4),
          ) ||
          obs.foe.find(
            (f) =>
              f.cls === 'ткач' &&
              orderBoard &&
              t <= orderBoard.to &&
              orderBoard.cells.some((c) => hexDist(f, c) <= 1),
          ) ||
          obs.foe.find(
            (f) =>
              f.cls === 'ткач' && this.ruins.some((r) => hexDist(f, r) <= 1),
          )

        if (targetToRam && !k.task?.ram) {
          orders.push({ kind: 'ram', unit: k.id, target: targetToRam.id })
          chanLeft -= 32
        } else if (!targetToRam) {
          // 2. Якщо захищати нічого — глушіння соти замовлення суперника або найближчої палаючої голки
          const enemyLitNeedles = obs.own.filter(
            (c) =>
              c.owner !== null &&
              c.owner !== this.slot &&
              c.owner !== 'K' &&
              !c.dark,
          )
          if (enemyLitNeedles.length > 0) {
            // Пріоритет №1: ворожа сота активного замовлення (руйнує +30 хв опонента!)
            let targetNeedle =
              orderBoard && t <= orderBoard.to
                ? enemyLitNeedles.find((en) =>
                    orderBoard.cells.some((c) =>
                      hexEq(c, { q: en.q, r: en.r }),
                    ),
                  )
                : undefined

            if (!targetNeedle) {
              targetNeedle = enemyLitNeedles
                .slice()
                .sort(
                  (a, b) =>
                    hexDist({ q: k.q, r: k.r }, a) -
                    hexDist({ q: k.q, r: k.r }, b),
                )[0]
            }

            if (targetNeedle) {
              const d = hexDist({ q: k.q, r: k.r }, targetNeedle)
              if (d <= 1) {
                if (!k.task?.jam && chanLeft >= 32) {
                  orders.push({
                    kind: 'jam',
                    unit: k.id,
                    target: {
                      q: targetNeedle.q,
                      r: targetNeedle.r,
                    },
                    hold: true,
                  })
                  chanLeft -= 32
                }
              } else if (!k.task?.goal && chanLeft >= 32) {
                orders.push({
                  kind: 'move',
                  unit: k.id,
                  q: targetNeedle.q,
                  r: targetNeedle.r,
                  goal: null,
                  home: false,
                })
                chanLeft -= 32
              }
            }
          }
        }
      }
    }

    // ── 4. Доступні руїни та голки кільця ───────────────────────────────────
    const isCandidateAvailable = (h: Hex) => {
      const key = `${h.q},${h.r}`
      if (claimedKeys.has(key)) return false
      // Якщо голка під ворожою паузою взяття (capGrace), вона заблокована
      const grace = this.enemyGraceUntil.get(key)
      if (grace && grace > t) return false
      // Якщо на руїні вже стоїть ворожий Ткач і гріє її — не втручаємось
      if (foeWeavers.has(key)) return false
      return true
    }

    const availRuins: Hex[] = this.ruins.filter(isCandidateAvailable)
    const availRing: Hex[] = isDawn
      ? this.ringNeedles.filter(isCandidateAvailable)
      : []

    const preDawnRing: Hex[] =
      !isDawn && t >= 950 ? this.ringNeedles.filter(isCandidateAvailable) : []

    let orderTargets: Hex[] = []
    if (orderBoard && t <= orderBoard.to - 15) {
      const missingCells = orderBoard.cells.filter(
        (c) =>
          !ownedKeys.has(`${c.q},${c.r}`) && !claimedKeys.has(`${c.q},${c.r}`),
      )
      // Беремо замовлення, якщо до його сот є доступ (<= 14 від вогнища чи палаючої голки)
      const reachable = missingCells.every((c) => {
        let minD = hexDist(c, this.seat)
        for (const ln of litNeedles) {
          const d = hexDist(c, ln)
          if (d < minD) minD = d
        }
        return minD <= 14
      })
      if (reachable) {
        orderTargets = missingCells
      }
    }

    // ── 5. Математична функція оцінки ROI цілі ──────────────────────────────
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
      const key = `${targetHex.q},${targetHex.r}`
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

      // Бонус за замикання циклу Вінця (Crown Cycle Bonus x1.15)
      const crownBonus = this.crownCycleRuins.has(key) ? 1.5 : 1.0

      const expectedMinutes =
        baseYield * multiplier * crownBonus * 0.0005 * burnTicks * connFactor
      return expectedMinutes / investTicks
    }

    // ── 6. Призначення та керування Ткачами ──────────────────────────────────
    for (const u of tkachs) {
      if (chanLeft < 32) break

      const prevTarget = this.unitTarget.get(u.id)

      // Машина посеред кроку — команди відхиляються
      if (u.wait > 0) continue

      // Анти-конкуренція: якщо призначену ціль захопив ворог, скасовуємо завдання негайно
      if (
        prevTarget &&
        enemyOwnedKeys.has(`${prevTarget.q},${prevTarget.r}`) &&
        !ownedKeys.has(`${prevTarget.q},${prevTarget.r}`)
      ) {
        this.unitTarget.delete(u.id)
        // Ткач вільний — перейде до пошуку нової цілі нижче
      } else if (prevTarget && hexEq({ q: u.q, r: u.r }, prevTarget)) {
        if (ownedKeys.has(`${prevTarget.q},${prevTarget.r}`)) {
          // Голку захоплено — звільняємо машину
          this.unitTarget.delete(u.id)
        } else {
          // Триває процес нагрівання — стоїмо на місці
          continue
        }
      } else if (prevTarget && !hexEq({ q: u.q, r: u.r }, prevTarget)) {
        // Відновлення руху, якщо шлях завершився раніше
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

      // ── Обчислення найкращої цілі ─────────────────────────────────────────
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

      // Пріоритет Г: Вільні руїни (за ROI з урахуванням Вінця та доходів)
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

      // Пріоритет Д: Якщо вільних цілей немає — живити свою палаючу голку
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

      // Відправка до цілі
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

    // ── 7. Heartbeat (P2-04): підтримка володіння слотом ─────────────────────
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

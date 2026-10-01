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
  private impassable = new Set<string>()

  // Математична теплова мапа доходів сот та голок
  private cellPriceMap = new Map<string, number>()
  private needleYieldMap = new Map<string, number>()

  // 6-елементний цикл Вінця (Crown Cycle) для активації множника х1.15
  private crownCycleRuins = new Set<string>()

  // Граф зв'язності голок для аналізу точок розриву (Cut-Vertex/Articulation Points)
  private needleAdj = new Map<string, string[]>()
  private startChainMap = new Map<SlotName, string[]>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private engine: any = null

  // Відстеження ворожого володіння та пауз після взяття (capGrace = 60)
  private enemyGraceUntil = new Map<string, number>()

  // Призначення: unitId -> цільовий гекс
  private unitTarget = new Map<string, Hex>()

  // Відстеження позицій та блокувань (Body-Block & Collision Deadlock Watchdog)
  private unitLastPos = new Map<
    string,
    { q: number; r: number; ticks: number }
  >()
  private stuckTargetCooldown = new Map<string, number>()
  private lastKlinokBuiltAt = -100
  private lastBuildTick = -100
  private lastPactBreakTick = -100

  override init(manifestBytes: Uint8Array, slot: SlotName): void {
    super.init(manifestBytes, slot)
    this.unitLastPos.clear()
    this.stuckTargetCooldown.clear()
    this.lastKlinokBuiltAt = -100
    this.lastBuildTick = -100
    this.lastPactBreakTick = -100
    const m = this.manifest as Manifest

    const idx = m.perm.indexOf(slot)
    this.seat = idx !== -1 && m.seats[idx] ? m.seats[idx] : { q: 0, r: 0 }
    this.citadel = m.citadel
    this.dawnAt = m.dawn.at
    this.cherta = m.cherta
    this.lots = m.lots || []

    // 1. Цінова мапа сот та непрохідні гекси
    this.impassable.clear()
    const types = m.terrain.types
    const typePass = types.map((t) => t.pass)
    const defaultPrice = types[0]?.min ?? 2
    for (const [q, r, typeIdx] of m.terrain.cells) {
      this.cellPriceMap.set(`${q},${r}`, types[typeIdx]?.min ?? defaultPrice)
      if (!typePass[typeIdx]) {
        this.impassable.add(`${q},${r}`)
      }
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

      this.engine = E
      this.needleAdj = adj
      const letters: SlotName[] = ['A', 'B', 'C']
      for (const l of letters) {
        this.startChainMap.set(l, (E.START_CHAIN && E.START_CHAIN[l]) || [])
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

  // Обчислення математичного збитку мережі суперника від глушіння голки (Articulation/Bridge Loss)
  private computeDownstreamLoss(
    owner: SlotName,
    candidateKey: string,
    ownedKeys: Set<string>,
  ): number {
    const starts = this.startChainMap.get(owner) || []
    const fullLit = new Set<string>()
    const q1: string[] = []
    for (const s of starts) {
      if (ownedKeys.has(s) && s !== candidateKey) {
        fullLit.add(s)
        q1.push(s)
      }
    }
    let head = 0
    while (head < q1.length) {
      const cur = q1[head++]!
      const neighbors = this.needleAdj.get(cur) || []
      for (const nb of neighbors) {
        if (!fullLit.has(nb) && ownedKeys.has(nb) && nb !== candidateKey) {
          fullLit.add(nb)
          q1.push(nb)
        }
      }
    }

    const withKeyLit = new Set<string>()
    const q0: string[] = []
    for (const s of starts) {
      if (ownedKeys.has(s)) {
        withKeyLit.add(s)
        q0.push(s)
      }
    }
    head = 0
    while (head < q0.length) {
      const cur = q0[head++]!
      const neighbors = this.needleAdj.get(cur) || []
      for (const nb of neighbors) {
        if (!withKeyLit.has(nb) && ownedKeys.has(nb)) {
          withKeyLit.add(nb)
          q0.push(nb)
        }
      }
    }

    let lostYield = 0
    for (const k of withKeyLit) {
      if (!fullLit.has(k)) {
        const [q, r] = k.split(',').map(Number)
        lostYield += this.getYield({ q: q!, r: r! })
      }
    }
    return lostYield
  }

  private isPathSafe(
    from: Hex,
    to: Hex,
    isDawn: boolean,
    blocked?: Set<string>,
  ): boolean {
    if (this.impassable.has(`${to.q},${to.r}`)) return false
    if (!isDawn && hexDist(to, this.citadel) <= this.cherta + 1) return false
    const d = hexDist(from, to)
    if (d <= 1) return true
    for (let i = 1; i < d; i++) {
      const frac = i / d
      const q = Math.round(from.q + frac * (to.q - from.q))
      const r = Math.round(from.r + frac * (to.r - from.r))
      if (this.impassable.has(`${q},${r}`)) return false
      if (!isDawn && hexDist({ q, r }, this.citadel) <= this.cherta + 1) {
        return false
      }
      if (blocked && blocked.has(`${q},${r}`)) {
        return false
      }
    }
    return true
  }

  private findSafeWaypoint(
    from: Hex,
    to: Hex,
    isDawn: boolean,
    _litNeedles?: Hex[],
    blocked?: Set<string>,
    escapeStep?: boolean,
  ): Hex | null {
    const isDirectPassable =
      (!blocked ||
        !blocked.has(`${to.q},${to.r}`) ||
        (from.q === to.q && from.r === to.r)) &&
      this.isPathSafe(from, to, isDawn, blocked)
    if (isDirectPassable && !escapeStep) return to

    // BFS на гексагональній сітці для надійного обходу цитаделі (cherta + 1 = 7), непрохідної місцевості та дружніх блокувань
    const queue: Hex[] = [from]
    const cameFrom = new Map<string, Hex | null>()
    cameFrom.set(`${from.q},${from.r}`, null)

    const DIRS = [
      { q: 1, r: 0 },
      { q: 1, r: -1 },
      { q: 0, r: -1 },
      { q: -1, r: 0 },
      { q: -1, r: 1 },
      { q: 0, r: 1 },
    ]

    let found = false
    while (queue.length > 0) {
      const cur = queue.shift()!
      if (cur.q === to.q && cur.r === to.r) {
        found = true
        break
      }
      for (const d of DIRS) {
        const nq = cur.q + d.q
        const nr = cur.r + d.r
        const nKey = `${nq},${nr}`
        if (cameFrom.has(nKey)) continue
        if (hexDist({ q: nq, r: nr }, this.citadel) > 19) continue
        if (
          !isDawn &&
          hexDist({ q: nq, r: nr }, this.citadel) <= this.cherta + 1
        )
          continue
        if (this.impassable.has(nKey)) continue
        if (blocked && blocked.has(nKey) && (nq !== to.q || nr !== to.r))
          continue
        cameFrom.set(nKey, cur)
        queue.push({ q: nq, r: nr })
      }
    }
    if (!found) return null

    const path: Hex[] = []
    let curr: Hex | null = to
    while (curr) {
      path.push(curr)
      curr = cameFrom.get(`${curr.q},${curr.r}`) ?? null
    }
    path.reverse()

    // Якщо машина застрягла (escapeStep) — робимо крок безпосередньо по першому вузлу BFS (path[1]),
    // який гарантовано вільний і обходить блок, звільняючи машину!
    if (escapeStep && path.length >= 2) {
      return path[1]!
    }

    // Знаходимо найвіддаленіший вузол вздовж шляху, до якого прямий промінь безпечний і не заблокований:
    for (let i = path.length - 1; i >= 1; i--) {
      const node = path[i]!
      const nodeKey = `${node.q},${node.r}`
      const isNodeFree =
        !blocked ||
        !blocked.has(nodeKey) ||
        (node.q === to.q && node.r === to.r)
      if (isNodeFree && this.isPathSafe(from, node, isDawn, blocked)) {
        return node
      }
    }
    return path[1] ?? null
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
    const litKeys = new Set(litNeedles.map((n) => `${n.q},${n.r}`))

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

    // Зайняті цілі (наші захоплені голки + призначені активним Ткачам)
    const claimedKeys = new Set<string>(ownedKeys)
    for (const tgt of this.unitTarget.values()) {
      claimedKeys.add(`${tgt.q},${tgt.r}`)
    }

    let chanLeft = chan

    // ── 1. Торги (Аукціони): оптимальна ставка 71 (вибиває ставки 60 і 65) ──
    for (let i = 0; i < this.lots.length; i++) {
      const lot = this.lots[i]
      if (lot && t >= lot.at - 20 && t < lot.at && !this.biddedLots.has(i)) {
        // Ставимо ТІЛЬКИ на лоти, корисні для нашої мережі (поблизу бази або палаючих голок).
        // Це запобігає витраті 71 енергії на ізольовані голки на іншому кінці карти,
        // які вороги потім безкарно глушать десятками тактів!
        const isLotUseful = lot.cells.some((c) => {
          if (ownedKeys.has(`${c.q},${c.r}`)) return false
          const dBase = hexDist(c, this.seat)
          const dLit =
            litNeedles.length > 0
              ? Math.min(...litNeedles.map((ln) => hexDist(c, ln)))
              : 999
          return dBase <= 8 || dLit <= 5
        })
        if (isLotUseful && energy >= 71 && chanLeft >= 32) {
          orders.push({ kind: 'bid', lot: i, amount: 71 })
          this.biddedLots.add(i)
          chanLeft -= 32
        } else if (isLotUseful && energy >= 65 && chanLeft >= 32) {
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

    // ── Стратегічна дипломатія: альянс двох проти лідера ───────────────────
    const weakerSlot = slotOrder.find(
      (s) => s !== this.slot && s !== leaderSlot,
    )
    const myPact = obs.pub.pact.active.find(
      (p) => p.a === this.slot || p.b === this.slot,
    )

    // 1. Прийняття вигідної пропозиції пакту:
    const incomingOffer = obs.mine.pact.in.find((offer) => offer.left >= 2)
    if (incomingOffer && chanLeft >= 32 && !myPact) {
      if (incomingOffer.who !== leaderSlot || !isWeLeader) {
        orders.push({ kind: 'pact', op: 'accept', to: incomingOffer.who })
        chanLeft -= 32
      }
    } else if (
      !myPact &&
      obs.pub.pact.active.length === 0 &&
      obs.mine.pact.offersLeft > 0 &&
      obs.mine.pact.out.length === 0 &&
      t >= 140 &&
      t <= 250 &&
      weakerSlot &&
      chanLeft >= 32
    ) {
      // 2. Ініціатива пропозиції пакту слабшому сусіду до того, як лідер його затягне у свій союз:
      orders.push({ kind: 'pact', op: 'offer', to: weakerSlot })
      chanLeft -= 32
    } else if (
      myPact &&
      t >= 950 &&
      t - this.lastPactBreakTick >= 10 &&
      chanLeft >= 32
    ) {
      // 3. Розрив пакту напередодні Зорі для фінального взяття вінця:
      const partner = myPact.a === this.slot ? myPact.b : myPact.a
      orders.push({ kind: 'pact', op: 'break', to: partner })
      this.lastPactBreakTick = t
      chanLeft -= 32
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
    const enemyHasKlinok = obs.foe.some((f) => f.cls === 'клинок')
    const needInterceptor =
      hasJams || enemyHasKlinok || nearbyEnemyKlinok || nearbyEnemyTkach

    if (!isDawn && chanLeft >= 32 && t - this.lastBuildTick >= 6) {
      if (tkachs.length < 3 && energy >= 90 && squadWeight <= 6 && t < 850) {
        // Перші 3 машини — ЗАВЖДИ Ткачі (економічний фундамент, вінець та експансія)
        orders.push({ kind: 'yard', cls: 'ткач' })
        this.lastBuildTick = t
        chanLeft -= 32
      } else if (
        tkachs.length >= 3 &&
        klinoks.length <
          (litNeedles.length >= 5 || t >= 200 || hasJams ? 2 : 1) &&
        energy >= 50 &&
        squadWeight <= 7 &&
        t - this.lastKlinokBuiltAt >= 10 &&
        t < 1100
      ) {
        // 4-та і 5-та машини — бойові Клинки (Sentinel для захисту мережі + Hunter для рейду на лідера)
        // Вага 3 Ткачів (6) + 2 Клинків (2) = 8 <= 8 (100% використання ліміту рою!)
        orders.push({ kind: 'yard', cls: 'клинок' })
        this.lastKlinokBuiltAt = t
        this.lastBuildTick = t
        chanLeft -= 32
      }
    }

    // ── Керування бойовими Клинками (Sentinel & Hunter) ─────────────────────
    // Набір гексів, зайнятих дружніми машинами (для запобігання взаємного блокування bodyBlock)
    const friendlyOccupied = new Set(obs.mine.units.map((u) => `${u.q},${u.r}`))

    // Сортуємо бойові Клинки:
    // Найближчий до нашого вогнища — Sentinel (обороняє базу/мережу)
    // Найдальший від вогнища — Hunter (проводить рейд, замовлення, глушіння)
    const sortedKlinoks = klinoks
      .slice()
      .sort(
        (a, b) =>
          hexDist({ q: a.q, r: a.r }, this.seat) -
          hexDist({ q: b.q, r: b.r }, this.seat),
      )

    for (let ki = 0; ki < sortedKlinoks.length; ki++) {
      if (chanLeft < 32) break
      const k = sortedKlinoks[ki]!
      if (k.wait > 0) continue

      const kBlocked = new Set(
        [...friendlyOccupied].filter((pos) => pos !== `${k.q},${k.r}`),
      )

      // Відстеження позиції Клинка (Deadlock Watchdog)
      const lastKPos = this.unitLastPos.get(k.id)
      if (lastKPos && lastKPos.q === k.q && lastKPos.r === k.r) {
        lastKPos.ticks++
      } else {
        this.unitLastPos.set(k.id, { q: k.q, r: k.r, ticks: 1 })
      }
      const kTicksAtPos = this.unitLastPos.get(k.id)!.ticks
      const kHasPath = (k.task?.path ?? 0) > 0
      const kIsStuck = k.stuck || (kHasPath && kTicksAtPos >= 2)

      // Роль:
      // Якщо є активне замовлення Доглядача (orderBoard) — усі Клинки виступають як Hunters
      // для негайного зриву замовлення супротивника (таран Ткачів ворога, зрив ланцюгів)!
      // Якщо замовлення немає — перший Клинок (ki === 0) захищає мережу (Sentinel).
      const hasActiveOrder = !!(orderBoard && t <= orderBoard.to)
      const hasHomeThreats = obs.foe.some(
        (f) =>
          f.p !== 'K' &&
          f.p !== this.slot &&
          (obs.mine.jams.some((j) => hexDist(f, { q: j.q, r: j.r }) <= 2) ||
            (hexDist(f, this.seat) <= 9 &&
              (ownedKeys.has(`${f.q},${f.r}`) ||
                litNeedles.some(
                  (n) =>
                    hexDist(f, { q: n.q, r: n.r }) <=
                    (f.cls === 'клинок' ? 3 : 2),
                )))),
      )
      const isSentinel =
        ki === 0 &&
        !hasActiveOrder &&
        (sortedKlinoks.length >= 2 || hasHomeThreats)

      // Перевірка можливості негайного тарана (ram):
      // Будь-який ворог у радіусі d <= 2 від цього Клинка
      const foesInRange = obs.foe.filter(
        (f) =>
          f.p !== 'K' &&
          f.p !== this.slot &&
          hexDist({ q: k.q, r: k.r }, f) <= 2,
      )
      if (foesInRange.length > 0) {
        // Пріоритет тарана:
        // 1. Ткач ворога на замовленні або біля нього (зрив утримання лінії)
        // 2. Ворог, що глушить нашу голку
        // 3. Ворожий Ткач
        // 4. Найближчий ворог
        const targetFoe =
          foesInRange.find(
            (f) =>
              f.cls === 'ткач' &&
              orderBoard &&
              t <= orderBoard.to &&
              orderBoard.cells.some((c) => hexDist(f, c) <= 1),
          ) ||
          foesInRange.find((f) =>
            obs.mine.jams.some((j) => hexDist(f, { q: j.q, r: j.r }) <= 2),
          ) ||
          foesInRange.find((f) => f.cls === 'ткач') ||
          foesInRange[0]!

        if (!k.task?.ram && chanLeft >= 32) {
          orders.push({
            kind: 'ram',
            unit: k.id,
            target: targetFoe.id,
          })
          chanLeft -= 32
        }
        continue
      }

      if (isSentinel) {
        // ── РЕЖИМ СЕНТИНЕЛЯ (ОБОРОНА МЕРЕЖІ ТА ВРАЗЛИВИХ МОСТІВ) ───────────
        // Знаходимо загрози для нашої мережі (вороги на наших голках або біля вогнища):
        const homeThreats = obs.foe.filter(
          (f) =>
            f.p !== 'K' &&
            f.p !== this.slot &&
            (obs.mine.jams.some((j) => hexDist(f, { q: j.q, r: j.r }) <= 2) ||
              (hexDist(f, this.seat) <= 9 &&
                (ownedKeys.has(`${f.q},${f.r}`) ||
                  litNeedles.some(
                    (n) =>
                      hexDist(f, { q: n.q, r: n.r }) <=
                      (f.cls === 'клинок' ? 3 : 2),
                  )))),
        )

        if (homeThreats.length > 0) {
          // Сортуємо загрози за відстанню до Сентинеля:
          homeThreats.sort(
            (a, b) =>
              hexDist({ q: k.q, r: k.r }, a) - hexDist({ q: k.q, r: k.r }, b),
          )
          const targetThreat = homeThreats[0]!
          const dThreat = hexDist({ q: k.q, r: k.r }, targetThreat)
          if (dThreat <= 2 && !k.task?.ram && chanLeft >= 32) {
            orders.push({
              kind: 'ram',
              unit: k.id,
              target: targetThreat.id,
            })
            chanLeft -= 32
          } else if (
            ((k.task?.path ?? 0) === 0 || kIsStuck) &&
            chanLeft >= 32
          ) {
            const safeThreat = this.findSafeWaypoint(
              { q: k.q, r: k.r },
              targetThreat,
              isDawn,
              litNeedles,
              kBlocked,
            )
            if (safeThreat && hexDist({ q: k.q, r: k.r }, safeThreat) > 0) {
              orders.push({
                kind: 'move',
                unit: k.id,
                q: safeThreat.q,
                r: safeThreat.r,
                goal: null,
                home: false,
              })
              chanLeft -= 32
            }
          }
        } else {
          // Якщо загроз немає — патрулювати критичну голку-міст біля вогнища:
          let sentinelTarget: Hex = this.seat
          let maxLoss = -1
          for (const ln of litNeedles) {
            const kStr = `${ln.q},${ln.r}`
            const loss = this.computeDownstreamLoss(this.slot, kStr, ownedKeys)
            if (loss > maxLoss) {
              maxLoss = loss
              sentinelTarget = ln
            }
          }

          const dToSentinel = hexDist({ q: k.q, r: k.r }, sentinelTarget)
          if (
            dToSentinel > 1 &&
            ((k.task?.path ?? 0) === 0 || kIsStuck) &&
            chanLeft >= 32
          ) {
            const safeSentinel = this.findSafeWaypoint(
              { q: k.q, r: k.r },
              sentinelTarget,
              isDawn,
              litNeedles,
              kBlocked,
            )
            if (safeSentinel && hexDist({ q: k.q, r: k.r }, safeSentinel) > 0) {
              orders.push({
                kind: 'move',
                unit: k.id,
                q: safeSentinel.q,
                r: safeSentinel.r,
                goal: null,
                home: false,
              })
              chanLeft -= 32
            }
          }
        }
      } else {
        // ── РЕЖИМ МИСЛИВЦЯ (РЕЙД НА ЛІДЕРА ТА ЗАМОВЛЕННЯ) ───────────────────
        const enemyLitNeedles = obs.own.filter(
          (c) =>
            c.owner !== null &&
            c.owner !== this.slot &&
            c.owner !== 'K' &&
            !c.dark &&
            (isDawn || hexDist(c, this.citadel) > this.cherta),
        )

        let targetNeedle: Hex | undefined

        // Пріоритет №1: Замовлення Доглядача (зрив +30/60 очок супротивника)
        if (orderBoard && t <= orderBoard.to) {
          // 1а. Ворожий Ткач біля соти замовлення (перехоплення та таран)
          const enemyOrderWeaver = obs.foe.find(
            (f) =>
              f.p !== 'K' &&
              f.p !== this.slot &&
              f.cls === 'ткач' &&
              orderBoard.cells.some((c) => hexDist(f, c) <= 1),
          )
          if (enemyOrderWeaver) {
            targetNeedle = { q: enemyOrderWeaver.q, r: enemyOrderWeaver.r }
          } else {
            // 1б. Чи бачимо ми вже палаючу ворожу соту замовлення?
            const enemyOrderNeedle = enemyLitNeedles.find((en) =>
              orderBoard.cells.some((c) => hexEq(c, { q: en.q, r: en.r })),
            )
            if (enemyOrderNeedle) {
              targetNeedle = enemyOrderNeedle
            } else {
              // 1в. Соти замовлення в тумані війни: йдемо до найближчої незахопленої нами соти замовлення!
              const unownedOrderCells = orderBoard.cells.filter(
                (c) => !ownedKeys.has(`${c.q},${c.r}`),
              )
              if (unownedOrderCells.length > 0) {
                // Якщо ми вже стоїмо на одній із сот замовлення — патрулюємо інші соти замовлення
                const otherOrderCells = unownedOrderCells.filter(
                  (c) => !hexEq(c, { q: k.q, r: k.r }),
                )
                const candidates =
                  otherOrderCells.length > 0
                    ? otherOrderCells
                    : unownedOrderCells
                const sorted = candidates
                  .slice()
                  .sort(
                    (a, b) =>
                      hexDist({ q: k.q, r: k.r }, a) -
                      hexDist({ q: k.q, r: k.r }, b),
                  )
                targetNeedle = sorted[0]
              }
            }
          }
        }

        if (!targetNeedle && enemyLitNeedles.length > 0) {
          // Пріоритет №2: голка з найбільшим математичним ефектом розриву мережі (Bridge/Cut Loss)
          const candidates = enemyLitNeedles.some(
            (en) => en.owner === leaderSlot,
          )
            ? enemyLitNeedles.filter((en) => en.owner === leaderSlot)
            : enemyLitNeedles

          let bestJamScore = -1
          for (const en of candidates) {
            const owner = en.owner as SlotName
            const ownerOwnedKeys = new Set(
              obs.own
                .filter((c) => c.owner === owner)
                .map((c) => `${c.q},${c.r}`),
            )
            const enKey = `${en.q},${en.r}`
            const damage = this.computeDownstreamLoss(
              owner,
              enKey,
              ownerOwnedKeys,
            )
            const d = hexDist({ q: k.q, r: k.r }, en)
            const score = (damage * 20.0) / (d + 4)
            if (score > bestJamScore) {
              bestJamScore = score
              targetNeedle = en
            }
          }
        }

        if (targetNeedle) {
          const d = hexDist({ q: k.q, r: k.r }, targetNeedle)
          const isOrderCell = !!(
            orderBoard &&
            t <= orderBoard.to &&
            orderBoard.cells.some((c) => hexEq(c, targetNeedle!))
          )
          const targetCell = obs.own.find(
            (c) => c.q === targetNeedle!.q && c.r === targetNeedle!.r,
          )
          const isJamCandidate = !!(
            (targetCell?.owner &&
              targetCell.owner !== this.slot &&
              targetCell.owner !== 'K' &&
              !targetCell.dark) ||
            (isOrderCell &&
              !ownedKeys.has(`${targetNeedle.q},${targetNeedle.r}`))
          )

          // Якщо ціль — ворог поряд, таранимо
          const foeAtTarget = obs.foe.find(
            (f) =>
              f.p !== 'K' &&
              f.p !== this.slot &&
              hexDist({ q: k.q, r: k.r }, f) <= 2 &&
              hexDist(f, targetNeedle!) <= 1,
          )

          if (foeAtTarget && !k.task?.ram && chanLeft >= 32) {
            orders.push({
              kind: 'ram',
              unit: k.id,
              target: foeAtTarget.id,
            })
            chanLeft -= 32
          } else if (d <= 1 && isJamCandidate) {
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
          } else if (
            (d > 1 || !isJamCandidate) &&
            ((k.task?.path ?? 0) === 0 ||
              kIsStuck ||
              (orderBoard &&
                t <= orderBoard.to &&
                k.task?.goal &&
                !orderBoard.cells.some((c) =>
                  hexEq(c, {
                    q: k.task!.goal!.q,
                    r: k.task!.goal!.r,
                  }),
                ))) &&
            chanLeft >= 32
          ) {
            // Безпека шляху: до Зорі не перетинати зону черти цитаделі
            const safeTarget = this.findSafeWaypoint(
              { q: k.q, r: k.r },
              targetNeedle,
              isDawn,
              litNeedles,
              kBlocked,
              kIsStuck,
            )
            if (safeTarget && hexDist({ q: k.q, r: k.r }, safeTarget) > 0) {
              orders.push({
                kind: 'move',
                unit: k.id,
                q: safeTarget.q,
                r: safeTarget.r,
                goal: null,
                home: false,
              })
              chanLeft -= 32
            }
          }
        } else {
          // Пріоритет №3 (Розвідка та рейд): якщо ворожих голок не видно у тумані війни:
          // Йдемо до незахопленої соти замовлення або до стартової голки лідера!
          let reconTarget: Hex | undefined
          if (orderBoard && t <= orderBoard.to) {
            reconTarget =
              orderBoard.cells.find((c) => !ownedKeys.has(`${c.q},${c.r}`)) ||
              orderBoard.cells[0]
          } else {
            const leaderStarts = this.startChainMap.get(leaderSlot) || []
            if (leaderStarts.length > 0) {
              const [lq, lr] = leaderStarts[0]!.split(',').map(Number)
              reconTarget = { q: lq!, r: lr! }
            }
          }

          if (
            reconTarget &&
            (isDawn || hexDist(reconTarget, this.citadel) > this.cherta) &&
            chanLeft >= 32
          ) {
            const dRecon = hexDist({ q: k.q, r: k.r }, reconTarget)
            const reconCell = obs.own.find(
              (c) => c.q === reconTarget!.q && c.r === reconTarget!.r,
            )
            const isReconJamable = !!(
              reconCell?.owner &&
              reconCell.owner !== this.slot &&
              reconCell.owner !== 'K' &&
              !reconCell.dark
            )

            if (dRecon <= 1 && isReconJamable) {
              if (!k.task?.jam) {
                orders.push({
                  kind: 'jam',
                  unit: k.id,
                  target: reconTarget,
                  hold: true,
                })
                chanLeft -= 32
              }
            } else if ((k.task?.path ?? 0) === 0 || kIsStuck) {
              const safeRecon = this.findSafeWaypoint(
                { q: k.q, r: k.r },
                reconTarget,
                isDawn,
                litNeedles,
                kBlocked,
                kIsStuck,
              )
              if (safeRecon && hexDist({ q: k.q, r: k.r }, safeRecon) > 0) {
                orders.push({
                  kind: 'move',
                  unit: k.id,
                  q: safeRecon.q,
                  r: safeRecon.r,
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
      // До Зорі (t < dawnAt) суворо заборонено заходити за Черту — Доглядач миттєво знищує тараном!
      if (!isDawn && hexDist(h, this.citadel) <= this.cherta) return false
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
          !ownedKeys.has(`${c.q},${c.r}`) &&
          !claimedKeys.has(`${c.q},${c.r}`) &&
          (isDawn || hexDist(c, this.citadel) > this.cherta),
      )
      // Беремо соти замовлення, які БЕЗПОСЕРЕДНЬО з'єднуються з нашою палаючою мережею (<= 5 від голки чи бази)
      orderTargets = missingCells.filter((c) => {
        if (
          hexDist(c, this.seat) <= 5 &&
          (this.engine?.linkOk(this.seat.q, this.seat.r, c.q, c.r) ?? true)
        )
          return true
        return litNeedles.some(
          (ln) =>
            hexDist(c, ln) <= 5 &&
            (this.engine?.linkOk(ln.q, ln.r, c.q, c.r) ?? true),
        )
      })
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
      unitId: string,
      u: Hex,
      targetHex: Hex,
      isRingTarget: boolean,
    ): number => {
      const key = `${targetHex.q},${targetHex.r}`
      const stuckUntil = this.stuckTargetCooldown.get(`${unitId}:${key}`)
      if (stuckUntil && stuckUntil > t) return -1

      const d = hexDist(u, targetHex)
      if (!isDawn && !isRingTarget && d > 12) return -1

      // Безпека шляху: до Зорі не перетинати зону Черти Доглядача (запобігає загибелі Ткачів від тарана Доглядача)
      if (!this.isPathSafe(u, targetHex, isDawn)) return -1
      const ownCell = obs.own.find(
        (c) => c.q === targetHex.q && c.r === targetHex.r,
      )
      const isEnemy = !!(
        ownCell &&
        ownCell.owner &&
        ownCell.owner !== this.slot &&
        ownCell.owner !== 'K'
      )
      const isDark = ownCell ? !!ownCell.dark : false

      const heatTicks = isEnemy ? (isDark ? 16 : 24) : 8
      const investTicks = 2 * d + heatTicks
      const remTicks = 1200 - t
      if (investTicks >= remTicks) return -1

      const burnTicks = remTicks - investTicks
      const baseYield = this.getYield(targetHex)
      const multiplier =
        isRingTarget && (isDawn || t + investTicks >= 1000) ? 2.0 : 1.0

      // Перевірка зв'язності: голка має обов'язково з'єднуватися з нашою мережею
      // (напряму від палаючої голки або бази)
      const canLink =
        (hexDist(targetHex, this.seat) <= 5 &&
          (this.engine?.linkOk(
            this.seat.q,
            this.seat.r,
            targetHex.q,
            targetHex.r,
          ) ??
            true)) ||
        litNeedles.some(
          (ln) =>
            hexDist(targetHex, ln) <= 5 &&
            (this.engine?.linkOk(ln.q, ln.r, targetHex.q, targetHex.r) ?? true),
        )

      if (!isRingTarget && !canLink) return -1

      const litD = minLitDist(targetHex)
      const connFactor = litD <= 5 ? 1.0 : 0.75

      // Бонус за замикання циклу Вінця (Crown Cycle Bonus x1.15)
      const crownBonus = this.crownCycleRuins.has(key) ? 1.5 : 1.0

      // Бонус за відбиття голки у суперника (game-theoretic differential)
      const swingBonus = isEnemy
        ? ownCell?.owner === leaderSlot
          ? 1.8
          : 1.3
        : 1.0

      const expectedMinutes =
        baseYield *
        multiplier *
        crownBonus *
        swingBonus *
        0.0005 *
        burnTicks *
        connFactor
      return expectedMinutes / investTicks
    }

    // ── 6. Призначення та керування Ткачами ──────────────────────────────────
    for (const u of tkachs) {
      if (chanLeft < 32) break

      const prevTarget = this.unitTarget.get(u.id)

      // Машина посеред кроку — команди відхиляються
      if (u.wait > 0) continue

      // Відстеження позиції для виявлення та зриву глухих кутів (Body-Block Deadlock Watchdog)
      const lastPos = this.unitLastPos.get(u.id)
      if (lastPos && lastPos.q === u.q && lastPos.r === u.r) {
        lastPos.ticks++
      } else {
        this.unitLastPos.set(u.id, { q: u.q, r: u.r, ticks: 1 })
      }
      const ticksAtPos = this.unitLastPos.get(u.id)!.ticks

      // Перевірка активної цілі
      if (prevTarget) {
        const targetKey = `${prevTarget.q},${prevTarget.r}`
        const atTarget = hexEq({ q: u.q, r: u.r }, prevTarget)
        const isEnemyOwned =
          enemyOwnedKeys.has(targetKey) && !ownedKeys.has(targetKey)
        const isGrace =
          this.enemyGraceUntil.has(targetKey) &&
          this.enemyGraceUntil.get(targetKey)! > t
        const isStuck =
          u.stuck || (!atTarget && u.work === 0 && ticksAtPos >= 6)

        // Чи з'явилося термінове замовлення Доглядача поблизу цього Ткача?
        const isCurrentTargetOrder = !!orderBoard?.cells.some((c) =>
          hexEq(c, prevTarget),
        )
        const canInterceptOrder =
          orderTargets.length > 0 &&
          !atTarget &&
          !isCurrentTargetOrder &&
          orderTargets.some(
            (ot) =>
              hexDist({ q: u.q, r: u.r }, ot) <= 6 &&
              !this.crownCycleRuins.has(targetKey),
          )

        if (atTarget) {
          if (ownedKeys.has(targetKey)) {
            // Голку захоплено — звільняємо машину
            this.unitTarget.delete(u.id)
          } else {
            // Триває процес нагрівання — стоїмо на місці
            continue
          }
        } else if (isEnemyOwned || isGrace || isStuck || canInterceptOrder) {
          // Ціль перехоплена ворогом, Ткач застряг у зіткненні, або термінове замовлення
          this.unitTarget.delete(u.id)
          claimedKeys.delete(targetKey)
          if (isStuck) {
            this.stuckTargetCooldown.set(`${u.id}:${targetKey}`, t + 30)
          }
          // Ткач вільний — перейде до обчислення іншої цілі нижче
        } else {
          // Машина в дорозі: надсилаємо рух ТІЛЬКИ якщо шлях зупинився і вона не гріє
          const hasPath = (u.task?.path ?? 0) > 0
          if (!hasPath && u.work === 0 && !u.task?.goal && chanLeft >= 32) {
            const uBlocked = new Set(
              [...friendlyOccupied].filter((p) => p !== `${u.q},${u.r}`),
            )
            const safeWp = this.findSafeWaypoint(
              { q: u.q, r: u.r },
              prevTarget,
              isDawn,
              litNeedles,
              uBlocked,
            )
            if (safeWp && hexDist({ q: u.q, r: u.r }, safeWp) > 0) {
              orders.push({
                kind: 'move',
                unit: u.id,
                q: safeWp.q,
                r: safeWp.r,
                goal: null,
                home: false,
              })
              chanLeft -= 32
            }
          }
          continue
        }
      }

      // ── Обчислення найкращої цілі ─────────────────────────────────────────
      let bestTarget: Hex | undefined
      let bestScore = -1
      let isRing = false

      // Пріоритет А: Зоряний штурм кільця Ключника (х2 множник)
      if (isDawn && availRing.length > 0) {
        for (const ringHex of availRing) {
          const s = scoreCandidate(u.id, { q: u.q, r: u.r }, ringHex, true)
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
      if (!bestTarget && orderTargets.length > 0 && orderBoard) {
        const sortedOrders = orderTargets
          .slice()
          .sort(
            (a, b) =>
              hexDist({ q: u.q, r: u.r }, a) - hexDist({ q: u.q, r: u.r }, b),
          )
        const nearestOrder = sortedOrders[0]
        if (nearestOrder) {
          const dOrd = hexDist({ q: u.q, r: u.r }, nearestOrder)
          const canLinkOrder =
            (hexDist(nearestOrder, this.seat) <= 5 &&
              (this.engine?.linkOk(
                this.seat.q,
                this.seat.r,
                nearestOrder.q,
                nearestOrder.r,
              ) ??
                true)) ||
            litNeedles.some(
              (ln) =>
                hexDist(nearestOrder, ln) <= 5 &&
                (this.engine?.linkOk(
                  ln.q,
                  ln.r,
                  nearestOrder.q,
                  nearestOrder.r,
                ) ??
                  true),
            )
          if (
            dOrd <= 7 &&
            canLinkOrder &&
            this.isPathSafe(u, nearestOrder, isDawn)
          ) {
            const ownCell = obs.own.find(
              (c) => c.q === nearestOrder.q && c.r === nearestOrder.r,
            )
            const isEnemy = !!(
              ownCell?.owner &&
              ownCell.owner !== this.slot &&
              ownCell.owner !== 'K'
            )
            const heatTicks = isEnemy ? 24 : 8
            const travelTicks = 2 * dOrd
            if (t + travelTicks + heatTicks + 12 <= orderBoard.to) {
              bestTarget = nearestOrder
            }
          }
        }
      }

      // Пріоритет В: Вільні руїни (за ROI з урахуванням Вінця та доходів)
      if (!bestTarget) {
        const validRuins = availRuins.filter(
          (h) => isDawn || hexDist(h, this.citadel) > this.cherta,
        )
        for (const rHex of validRuins) {
          const s = scoreCandidate(u.id, { q: u.q, r: u.r }, rHex, false)
          if (s > bestScore) {
            bestScore = s
            bestTarget = rHex
            isRing = false
          }
        }
      }

      // Пріоритет Г: Якщо вільних цілей для захоплення немає — живити найприбутковішу палаючу голку
      if (!bestTarget && litNeedles.length > 0) {
        // Знаходимо палаючі голки, які ще не живляться іншими Ткачами
        const otherFeedingNeedles = new Set<string>()
        for (const other of tkachs) {
          if (other.id !== u.id && other.task?.feed) {
            otherFeedingNeedles.add(`${other.task.feed.q},${other.task.feed.r}`)
          }
        }

        const friendlyOccupied = new Set(
          obs.mine.units.map((mu) => `${mu.q},${mu.r}`),
        )
        const unheldLit = litNeedles.filter(
          (ln) =>
            !otherFeedingNeedles.has(`${ln.q},${ln.r}`) &&
            (!friendlyOccupied.has(`${ln.q},${ln.r}`) ||
              hexEq({ q: u.q, r: u.r }, ln)),
        )
        const candidates = unheldLit.length > 0 ? unheldLit : litNeedles

        // Сортуємо за дохідністю голки (Yield) з урахуванням відстані
        const sortedLit = candidates.slice().sort((a, b) => {
          const ya = this.getYield(a) / (hexDist({ q: u.q, r: u.r }, a) + 1)
          const yb = this.getYield(b) / (hexDist({ q: u.q, r: u.r }, b) + 1)
          return yb - ya
        })
        const bestLit = sortedLit[0]

        if (bestLit) {
          const atLit = hexEq({ q: u.q, r: u.r }, bestLit)
          if (atLit) {
            if (!u.task?.feed && chanLeft >= 32) {
              orders.push({
                kind: 'feed',
                unit: u.id,
                q: bestLit.q,
                r: bestLit.r,
              })
              chanLeft -= 32
            }
          } else if ((u.task?.path ?? 0) === 0 && chanLeft >= 32) {
            const uBlocked = new Set(
              [...friendlyOccupied].filter((p) => p !== `${u.q},${u.r}`),
            )
            const safeLitWp = this.findSafeWaypoint(
              { q: u.q, r: u.r },
              bestLit,
              isDawn,
              litNeedles,
              uBlocked,
            )
            if (safeLitWp && hexDist({ q: u.q, r: u.r }, safeLitWp) > 0) {
              orders.push({
                kind: 'move',
                unit: u.id,
                q: safeLitWp.q,
                r: safeLitWp.r,
                goal: null,
                home: true,
              })
              chanLeft -= 32
            }
          }
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

        const uBlocked = new Set(
          [...friendlyOccupied].filter((p) => p !== `${u.q},${u.r}`),
        )
        const safeTargetWp = this.findSafeWaypoint(
          { q: u.q, r: u.r },
          bestTarget,
          isDawn,
          litNeedles,
          uBlocked,
        )
        if (safeTargetWp && hexDist({ q: u.q, r: u.r }, safeTargetWp) > 0) {
          orders.push({
            kind: 'move',
            unit: u.id,
            q: safeTargetWp.q,
            r: safeTargetWp.r,
            goal: null,
            home: false,
          })
          chanLeft -= 32
        }
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

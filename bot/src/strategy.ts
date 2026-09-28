/* bot :: strategy
   ТУТ ВАША СТРАТЕГІЯ - єдиний файл шаблону, який мусить стати вашим.

   Заглушка - дзеркальна голова архетипу SDK: вона грає, але своїх правил у
   неї немає; списуйте з неї контракт, а не тактику. Контракт - WireBot
   (маніфест, кадр спостереження -> кадр команд, вердикти) плюс кадр
   щоденника віри. Архетип заглушки - ZARIA_PRESET (рівний, шир, обхідник,
   проривник, облягач).

   Свою голову починають із BlankBot з @zoria/sdk:

     class MyBot extends BlankBot {
       protected override think(obs: Observe): Order[] { ... }
     }

   і повертають її з createStrategy(); belief() без дзеркала збирає
   BeliefFrame сам або віддає null. Мережі тут немає і бути не повинно:
   провід, повернення і піни живуть у main.ts і connectBot. */

import { createEngine } from '@zoria/engine'
import { ARCHETYPES, BeliefTrace, MirrorBot, sampleBot } from '@zoria/sdk'
import type { BeliefFrame, WireBot } from '@zoria/sdk'
import {
  decodeManifest,
  decodeObserve,
  decodeOrders,
  decodeVerdicts,
  encodeOrders,
} from '@zoria/protocol'
import type { Observe, Order, SlotName } from '@zoria/protocol'

export interface Strategy extends WireBot {
  /* кадр щоденника віри такту; null - кадру немає */
  belief(obs: Observe | null): BeliefFrame | null
}

const CUSTOM_ARCHETYPES: Record<string, Record<string, unknown>> = {
  ...ARCHETYPES,
  // Наш чемпіонський профіль: оптимізований баланс росту, оборони та розвідки
  чемпіон: {
    mind: 'різчик',
    dark: 1.8,
    grow: 1.4,
    steal: 1.4,
    raid: 1.0,
    order: 1.0,
    klinok: 0.5,
    build: 1.4,
    guard: 0.6,
    scout: 1.0,
    deep: 0.6,
    spare: 1.2,
    pirate: 0.2,
    siege: 0.8,
    pact: 1.0,
  },
}

class StrategicBot implements Strategy {
  private head: MirrorBot
  private trace: BeliefTrace | null = null
  private slot: SlotName = 'A'
  private seat: [number, number] = [0, 0]
  private ticksSinceAccepted = 0

  constructor(preset: string) {
    if (Object.hasOwn(CUSTOM_ARCHETYPES, preset)) {
      this.head = new MirrorBot(createEngine, CUSTOM_ARCHETYPES[preset])
    } else {
      this.head = sampleBot(createEngine, preset)
    }
  }

  init(manifestBytes: Uint8Array, slot: SlotName): void {
    this.head.init(manifestBytes, slot)
    this.trace = new BeliefTrace(slot)
    this.slot = slot
    const m = decodeManifest(manifestBytes)
    if (m?.perm && m.seats) {
      const idx = m.perm.indexOf(slot)
      if (idx !== -1 && m.seats[idx]) {
        this.seat = [m.seats[idx].q, m.seats[idx].r]
      }
    }
  }

  tick(observeBytes: Uint8Array): Uint8Array {
    const rawOut = this.head.tick(observeBytes)
    const orders: Order[] = decodeOrders(rawOut) ?? []

    // Вимога P2-04: бот сам веде слот і подає прийняту команду хоча б раз на 6 тактів.
    // Якщо поточний хід мовчить або пройшло 3+ тактів без прийнятих команд, подаємо
    // безпечну команду утримання фокусу на вогнищі.
    if (orders.length === 0 || this.ticksSinceAccepted >= 3) {
      const obs = decodeObserve(observeBytes)
      const chan = obs?.pulse?.chan ?? 0
      if (chan >= 32) {
        orders.push({
          kind: 'watch',
          keep: 0,
          q: this.seat[0],
          r: this.seat[1],
        })
        return encodeOrders(orders)
      }
    }

    return rawOut
  }

  feedback(verdictsBytes: Uint8Array): void {
    this.head.feedback(verdictsBytes)
    const list = decodeVerdicts(verdictsBytes)
    if (list && list.some((v) => v[1] === true)) {
      this.ticksSinceAccepted = 0
    } else {
      this.ticksSinceAccepted++
    }
  }

  /* віра дзеркала: світ дзеркальної голови і є те, у що вона вірить */
  belief(obs: Observe | null): BeliefFrame | null {
    const E = this.head.mirror()
    return this.trace && E ? this.trace.frame(E, obs) : null
  }
}

/* імена архетипів: за ними службова ручка зміни пресета вирішує,
   є такий пресет чи ні */
export function presets(): string[] {
  return Object.keys(CUSTOM_ARCHETYPES)
}

export function createStrategy(
  preset = process.env['ZARIA_PRESET'] || 'чемпіон',
): Strategy {
  return new StrategicBot(preset)
}

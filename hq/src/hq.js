/* Заготовка штабу: господар показу, якорі і органи

   Що тут уже є (вимоги P3-01 ... P3-04 і P3-11):
     - розмова з господарем показу через обгортку guest.js;
     - всі якорі контракту в розмітці і всі органи під рукою драйвера;
     - жодного запиту в мережу: файли запису просить господар;
     - чиста консоль за прогін.

   Чого тут немає - можливостей Ш1 ... Ш5. Якорі значень стоять порожні:
   порожнє значення за контрактом означає "нема чого показати", і драйвер
   чесно зарахує нуль. Ваша робота - порахувати ці значення за записом і
   покласти їх у ті самі якорі; вигляд штабу при цьому вільний.

   Як рахувати правду світу, написано у `part3/03-record.md`, розділ 3:
   журнал несе накази, світ з них виводить курсор `openJournal` з SDK.
   Курсор - робота важка, тримайте його у воркері. */

import { openHost } from './guest.js'
import { S } from './strings.js'

const $ = (sel) => document.querySelector(sel)
const anchors = (name) =>
  document.querySelectorAll('[data-zaria="' + name + '"]')

/* покласти значення в якір. Порожньо - означає нема чого показати (контракт 3.1) */
function put(name, value) {
  for (const el of anchors(name)) {
    if (el.matches('input, select, textarea')) continue
    el.textContent = value === null || value === undefined ? '' : String(value)
  }
}

const state = {
  hq: null,
  pack: null,
  packId: null,
  match: 1,
  tick: 0,
  mode: 'truth',
  focus: '',
  cell: '',
  unit: '',
  order: 0,
  preset: 'рівний',
  live: null,
}

/* ---- мова ---- */

function setLang(lang) {
  const dict = S[lang] || S.uk
  for (const el of document.querySelectorAll('[data-t]')) {
    const key = el.getAttribute('data-t')
    if (dict[key]) el.textContent = dict[key]
  }
  document.documentElement.lang = lang
  $('#note').textContent = dict.note
}

/* ---- запис ---- */

function usePack(id) {
  const found = state.hq.packs().find((p) => p.id === id)
  if (!found) return
  state.packId = id
  state.pack = found.pack
  $('#packName').textContent = found.title || id
  const focus = document.querySelector('[data-zaria="go-focus"]')
  focus.innerHTML = ''
  for (const nick of state.pack.roster || []) {
    const o = document.createElement('option')
    o.value = nick
    o.textContent = nick
    focus.append(o)
  }
  const seat = state.pack.belief ? state.pack.belief.seat : 0
  state.focus = (state.pack.roster || [])[seat] || ''
  focus.value = state.focus
  const range = $('#tickRange')
  range.max = String(state.pack.ticks || 0)
  document.querySelector('[data-zaria="go-tick"]').max = String(
    state.pack.ticks || 0,
  )
  paint()
}

function paint() {
  put('match', state.match)
  put('tick', state.tick)
  put('mode', state.mode)
  put('focus', state.focus)
  put('cell', state.cell)
  $('#tickRange').value = String(state.tick)
  /* Тут ваша робота: порахувати значення і покласти їх в якорі.
     put('cell-owner-truth', ...); put('score', ...); put('bytes', ...); ... */
}

/* ---- органи ---- */

function organ(name, fn) {
  for (const el of anchors(name)) {
    const kind = el.matches('input, select, textarea') ? 'field' : 'button'
    if (kind === 'field') {
      const run = () => fn(el.value)
      el.addEventListener('change', run)
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') run()
      })
      /* наказ драйвера приходить і подією input - шкалі це рідний шлях */
      el.addEventListener('input', run)
    } else {
      el.addEventListener('click', () =>
        fn(el.getAttribute('data-zaria-value') || ''),
      )
    }
  }
}

function wire() {
  organ('go-pack', (v) => usePack(v))
  organ('go-match', (v) => {
    state.match = Math.max(1, Math.min(3, Number(v) || 1))
    paint()
  })
  organ('go-tick', (v) => {
    const cap = state.live ? state.live.cap : state.pack ? state.pack.ticks : 0
    state.tick = Math.max(0, Math.min(cap, Math.round(Number(v) || 0)))
    paint()
  })
  organ('go-mode', (v) => {
    state.mode = v
    paint()
  })
  organ('go-focus', (v) => {
    state.focus = v
    paint()
  })
  organ('go-cell', (v) => {
    state.cell = String(v).trim()
    paint()
  })
  organ('go-unit', (v) => {
    state.unit = String(v).trim()
    paint()
  })
  organ('go-order', (v) => {
    state.order = Math.max(0, Math.round(Number(v) || 0))
    paint()
  })
  organ('go-preset', (v) => {
    state.preset = v
  })
  organ('do-promote', async () => {
    /* показ зобов'язаний чекати на відповідь, а не малювати успіх заздалегідь (задача Ш4-4) */
    put('promote-status', '')
    const r = await state.hq.promote(state.preset)
    put('promote-status', r.status)
  })
  $('#tickRange').addEventListener('input', (e) => {
    const field = document.querySelector('[data-zaria="go-tick"]')
    field.value = e.currentTarget.value
    field.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

/* ---- пуск ---- */

async function main() {
  const hq = await openHost({ hq: 'заготовка' })
  state.hq = hq
  setLang(hq.lang)
  hq.on('lang', setLang)
  wire()

  if (hq.mode === 'record') {
    const list = hq.packs()
    const select = document.querySelector('[data-zaria="go-pack"]')
    for (const p of list) {
      const o = document.createElement('option')
      o.value = p.id
      o.textContent = p.title || p.id
      select.append(o)
    }
    if (list.length) {
      select.value = list[0].id
      usePack(list[0].id)
    }
  }

  if (hq.mode === 'live') {
    const live = hq.live()
    state.live = { cap: 0, ticks: live.ticks }
    state.focus = (live.roster || [])[live.seat] || ''
    $('#packName').textContent = S[hq.lang] ? S[hq.lang].liveName : 'ефір'
    $('#tickRange').max = String(live.ticks)
    hq.on('tick', (m) => {
      state.live.cap = m.cap
      state.tick = m.t
      paint()
      /* відмітка живості: господар не бачить DOM рамки, і де стоїть показ, він
         дізнається тільки звідси. Показ, який мовчить, сторож вважає
         застиглим і знімає з трансляції (контракт 6.3) */
      hq.ready(state.tick)
      /* Ваша робота: не відстати від стелі і показати це якорями
         live-lag і live-state (задачі Ш5-1 ... Ш5-3) */
    })
    hq.on('end', () => {
      /* Ваша робота: live-state = end і частки партії в якорі shares */
    })
  }

  paint()
  /* перший кадр відмальовано - кажемо господареві. Звідси починається замір кадру */
  requestAnimationFrame(() => hq.ready(state.tick))
}

void main()

import type { RoomKind, ZonePoint } from '~/types/models'

// Демонстрационные изображения фасадов и планов этажей, собранные как SVG
// data-URI. Настоящие файлы грузит застройщик, но прототип без бэкенда должен
// открываться уже наполненным — иначе разметку областей не на чем показать.
// Геометрия вынесена в экспортируемые функции, поэтому засеянные области
// ложатся ровно по нарисованным этажам и квартирам.

function svgUri(w: number, h: number, body: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/* ---------------------------------- фасад --------------------------------- */

const F_LEFT = 0.07
const F_RIGHT = 0.93
const F_TOP = 0.1
const F_BOTTOM = 0.92

/** Полоса одного этажа на сгенерированном фасаде (этаж 1 — внизу). */
export function facadeFloorBand(floor: number, floors: number) {
  const h = (F_BOTTOM - F_TOP) / floors
  return { x: F_LEFT, y: F_BOTTOM - floor * h, w: F_RIGHT - F_LEFT, h }
}

export function facadeImage(floors: number, opts: { evening?: boolean } = {}) {
  const W = 1600
  const H = 760
  const evening = opts.evening ?? false
  const sky = evening
    ? '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2E3A55"/><stop offset="1" stop-color="#7C6A78"/></linearGradient>'
    : '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#CFE0EE"/><stop offset="1" stop-color="#EFE9E2"/></linearGradient>'
  const wall = evening ? '#4A4552' : '#E8E2DA'
  const wallDark = evening ? '#3B3744' : '#D8D0C6'
  const glass = evening ? '#F2CE7E' : '#8FA8BC'
  const bandH = ((F_BOTTOM - F_TOP) / floors) * H

  const parts: string[] = []
  parts.push(`<defs>${sky}</defs><rect width="${W}" height="${H}" fill="url(#sky)"/>`)
  // корпус
  const bx = F_LEFT * W
  const bw = (F_RIGHT - F_LEFT) * W
  const by = F_TOP * H
  const bh = (F_BOTTOM - F_TOP) * H
  parts.push(`<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="${wall}"/>`)
  // парапет
  parts.push(`<rect x="${bx - 10}" y="${by - 16}" width="${bw + 20}" height="18" rx="3" fill="${wallDark}"/>`)

  // этажи: межэтажные линии, окна и балконы
  for (let f = 1; f <= floors; f++) {
    const band = facadeFloorBand(f, floors)
    const y = band.y * H
    parts.push(`<rect x="${bx}" y="${y}" width="${bw}" height="${bandH}" fill="none" stroke="${wallDark}" stroke-width="2"/>`)
    const cols = 9
    const gap = bw / cols
    for (let c = 0; c < cols; c++) {
      const wx = bx + gap * c + gap * 0.18
      const ww = gap * 0.64
      const wy = y + bandH * 0.2
      const wh = bandH * 0.5
      parts.push(`<rect x="${wx}" y="${wy}" width="${ww}" height="${wh}" rx="2" fill="${glass}"/>`)
      if (c % 3 === 1) {
        parts.push(`<rect x="${wx - gap * 0.06}" y="${wy + wh}" width="${ww + gap * 0.12}" height="${bandH * 0.22}" fill="${wallDark}" opacity=".85"/>`)
      }
    }
    // номер этажа на торце
    parts.push(`<text x="${bx - 18}" y="${y + bandH * 0.62}" text-anchor="end" font-family="Onest, sans-serif" font-size="17" font-weight="600" fill="${evening ? '#CFC6CE' : '#8A8390'}">${f}</text>`)
  }

  // первый этаж — витрины коммерции
  const g = facadeFloorBand(1, floors)
  parts.push(`<rect x="${bx}" y="${g.y * H + bandH * 0.12}" width="${bw}" height="${bandH * 0.76}" fill="${evening ? '#F6D98F' : '#B9C9D6'}" opacity=".55"/>`)

  // земля
  parts.push(`<rect x="0" y="${F_BOTTOM * H}" width="${W}" height="${H - F_BOTTOM * H}" fill="${evening ? '#2B2730' : '#CFC8BE'}"/>`)
  for (let i = 0; i < 7; i++) {
    const cx = 120 + i * 230
    parts.push(`<circle cx="${cx}" cy="${F_BOTTOM * H + 12}" r="26" fill="${evening ? '#1F3A2C' : '#7FA07F'}" opacity=".8"/>`)
  }
  return svgUri(W, H, parts.join(''))
}

/* ------------------------------- план этажа ------------------------------- */

// Г-образные квартиры вокруг центрального ядра, в координатах секции 0..1
const SECTION_APTS: ZonePoint[][] = [
  [{ x: 0.03, y: 0.05 }, { x: 0.485, y: 0.05 }, { x: 0.485, y: 0.36 }, { x: 0.30, y: 0.36 }, { x: 0.30, y: 0.47 }, { x: 0.03, y: 0.47 }],
  [{ x: 0.515, y: 0.05 }, { x: 0.97, y: 0.05 }, { x: 0.97, y: 0.47 }, { x: 0.70, y: 0.47 }, { x: 0.70, y: 0.36 }, { x: 0.515, y: 0.36 }],
  [{ x: 0.03, y: 0.53 }, { x: 0.30, y: 0.53 }, { x: 0.30, y: 0.64 }, { x: 0.485, y: 0.64 }, { x: 0.485, y: 0.95 }, { x: 0.03, y: 0.95 }],
  [{ x: 0.515, y: 0.64 }, { x: 0.70, y: 0.64 }, { x: 0.70, y: 0.53 }, { x: 0.97, y: 0.53 }, { x: 0.97, y: 0.95 }, { x: 0.515, y: 0.95 }],
]

const SECTION_BOXES = [
  { x: 0.015, y: 0.03, w: 0.465, h: 0.94 },
  { x: 0.52, y: 0.03, w: 0.465, h: 0.94 },
]

/** Контуры квартир на сгенерированном плане этажа: 2 секции × 4 квартиры. */
export function floorPlateApartments(sections = 2): ZonePoint[][] {
  const out: ZonePoint[][] = []
  for (let s = 0; s < Math.min(sections, SECTION_BOXES.length); s++) {
    const box = SECTION_BOXES[s]!
    for (const poly of SECTION_APTS) {
      out.push(poly.map((p) => ({ x: box.x + p.x * box.w, y: box.y + p.y * box.h })))
    }
  }
  return out
}

export function floorPlanImage(floor: number, sections = 2) {
  const W = 1600
  const H = 800
  const polys = floorPlateApartments(sections)
  const parts: string[] = []
  parts.push(`<rect width="${W}" height="${H}" fill="#FBFAF8"/>`)
  // сетка подложки — как на подоснове чертежа
  for (let x = 0; x <= W; x += 40) parts.push(`<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#ECE8E2" stroke-width="1"/>`)
  for (let y = 0; y <= H; y += 40) parts.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#ECE8E2" stroke-width="1"/>`)

  for (let s = 0; s < Math.min(sections, SECTION_BOXES.length); s++) {
    const box = SECTION_BOXES[s]!
    // ядро: лифты, лестница, МОП
    const cx = (box.x + 0.30 * box.w) * W
    const cy = (box.y + 0.36 * box.h) * H
    const cw = 0.40 * box.w * W
    const ch = 0.28 * box.h * H
    parts.push(`<rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" fill="#E6E1DB" stroke="#3B3640" stroke-width="4"/>`)
    parts.push(`<rect x="${cx + cw * 0.06}" y="${cy + ch * 0.12}" width="${cw * 0.34}" height="${ch * 0.42}" fill="#FBFAF8" stroke="#3B3640" stroke-width="3"/>`)
    parts.push(`<rect x="${cx + cw * 0.46}" y="${cy + ch * 0.12}" width="${cw * 0.22}" height="${ch * 0.42}" fill="#FBFAF8" stroke="#3B3640" stroke-width="3"/>`)
    parts.push(`<rect x="${cx + cw * 0.72}" y="${cy + ch * 0.12}" width="${cw * 0.22}" height="${ch * 0.42}" fill="#FBFAF8" stroke="#3B3640" stroke-width="3"/>`)
    parts.push(`<text x="${cx + cw / 2}" y="${cy + ch * 0.82}" text-anchor="middle" font-family="Onest, sans-serif" font-size="20" font-weight="600" fill="#6D6772">МОП · лифты · лестница</text>`)
    parts.push(`<text x="${(box.x + box.w / 2) * W}" y="${(box.y - 0.012) * H}" text-anchor="middle" font-family="Onest, sans-serif" font-size="22" font-weight="700" fill="#6D6772">СЕКЦИЯ ${s + 1}</text>`)
  }

  // контуры квартир + условные внутренние перегородки
  for (const poly of polys) {
    const d = poly.map((p) => `${(p.x * W).toFixed(1)},${(p.y * H).toFixed(1)}`).join(' ')
    parts.push(`<polygon points="${d}" fill="#FFFFFF" stroke="#3B3640" stroke-width="5"/>`)
    const xs = poly.map((p) => p.x)
    const ys = poly.map((p) => p.y)
    const x0 = Math.min(...xs)
    const x1 = Math.max(...xs)
    const y0 = Math.min(...ys)
    const y1 = Math.max(...ys)
    const mx = ((x0 + x1) / 2) * W
    const my = ((y0 + y1) / 2) * H
    parts.push(`<line x1="${x0 * W}" y1="${my}" x2="${mx}" y2="${my}" stroke="#B4ADA4" stroke-width="3"/>`)
    parts.push(`<line x1="${mx}" y1="${y0 * H}" x2="${mx}" y2="${my}" stroke="#B4ADA4" stroke-width="3"/>`)
  }

  parts.push(`<text x="28" y="44" font-family="Onest, sans-serif" font-size="26" font-weight="700" fill="#3B3640">План ${floor} этажа</text>`)
  parts.push(`<text x="28" y="${H - 22}" font-family="Onest, sans-serif" font-size="18" fill="#8A8390">Демонстрационная подоснова · масштаб 1:100</text>`)
  return svgUri(W, H, parts.join(''))
}

/* -------------------------------- планировка ------------------------------- */

export interface LayoutRoomRect {
  kind: RoomKind
  label: string
  x: number
  y: number
  w: number
  h: number
}

/**
 * Прямоугольники комнат на демонстрационной планировке, в нормированных
 * координатах. Из них рисуется картинка И засеивается разметка комнат —
 * геометрия одна, поэтому области ложатся точно по нарисованным комнатам.
 */
export function unitLayoutRects(rooms: number): LayoutRoomRect[] {
  const pad = 80 / 900
  const inner = { x: pad, y: pad, w: 1 - pad * 2, h: 1 - pad * 2 }
  const one = Math.max(1, rooms) === 1
  const leftW = inner.w * (one ? 0.58 : 0.5)
  const topH = inner.h * 0.62
  const out: LayoutRoomRect[] = []

  out.push({ kind: 'living', label: one ? 'Жилая комната' : 'Гостиная', x: inner.x, y: inner.y, w: leftW, h: topH })

  if (one) {
    out.push({ kind: 'kitchen', label: 'Кухня-ниша', x: inner.x + leftW, y: inner.y, w: inner.w - leftW, h: topH })
  } else {
    const beds = rooms - 1
    const bh = topH / beds
    for (let i = 0; i < beds; i++) {
      out.push({ kind: 'living', label: `Спальня ${i + 1}`, x: inner.x + leftW, y: inner.y + bh * i, w: inner.w - leftW, h: bh })
    }
  }

  const botY = inner.y + topH
  const botH = inner.h * 0.38
  const cells: { kind: RoomKind; label: string; w: number }[] = one
    ? [{ kind: 'hall', label: 'Прихожая', w: 0.5 }, { kind: 'bath', label: 'С/у', w: 0.5 }]
    : [{ kind: 'kitchen', label: 'Кухня', w: 0.4 }, { kind: 'hall', label: 'Прихожая', w: 0.32 }, { kind: 'bath', label: 'С/у', w: 0.28 }]
  let cx = inner.x
  for (const c of cells) {
    const cw = inner.w * c.w
    out.push({ kind: c.kind, label: c.label, x: cx, y: botY, w: cw, h: botH })
    cx += cw
  }

  out.push({ kind: 'balcony', label: 'Лоджия', x: inner.x + inner.w * 0.1, y: inner.y + inner.h, w: inner.w * 0.5, h: (pad * 0.6) })
  return out
}

/** Картинка типовой планировки помещения для карточки «Планировки помещений». */
export function unitLayoutImage(rooms: number, area: number) {
  const W = 900
  const H = 900
  const parts: string[] = []
  parts.push(`<rect width="${W}" height="${H}" fill="#FBFAF8"/>`)
  for (let x = 0; x <= W; x += 45) parts.push(`<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#EEEAE4" stroke-width="1"/>`)
  for (let y = 0; y <= H; y += 45) parts.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#EEEAE4" stroke-width="1"/>`)

  // подписи комнат в картинку не печатаем: их несёт слой разметки, иначе на
  // размеченном плане каждое название удваивается
  const rects = unitLayoutRects(rooms)
  for (const r of rects) {
    const isOuter = r.kind === 'balcony'
    parts.push(
      `<rect x="${(r.x * W).toFixed(1)}" y="${(r.y * H).toFixed(1)}" width="${(r.w * W).toFixed(1)}" height="${(r.h * H).toFixed(1)}"`
      + ` fill="${isOuter ? '#F3F1ED' : '#FFFFFF'}" stroke="#8C8579" stroke-width="4"/>`,
    )
  }
  // наружная стена поверх комнат, чтобы контур квартиры читался толще перегородок
  const pad = 80
  parts.push(`<rect x="${pad}" y="${pad}" width="${W - pad * 2}" height="${H - pad * 2}" fill="none" stroke="#3B3640" stroke-width="7"/>`)
  parts.push(`<text x="${pad}" y="${pad - 26}" font-family="Onest, sans-serif" font-size="27" font-weight="700" fill="#3B3640">${Math.max(1, rooms)}-комн. · ${area} м²</text>`)
  return svgUri(W, H, parts.join(''))
}

/* -------------------------------- документы -------------------------------- */

/**
 * Скан документа как SVG data-URI. Настоящие файлы менеджер загружает сам
 * (в прототипе — object URL), но демо должно открываться с готовым досье,
 * иначе блок документов не на чем показать. Берём изображение, а не PDF:
 * base-14 шрифты PDF не умеют кириллицу, и превью вышло бы пустым.
 */
export function documentImage(title: string, lines: string[], accent = '#6E4453') {
  const W = 840
  const H = 1188
  const parts: string[] = []
  parts.push(`<rect width="${W}" height="${H}" fill="#FFFFFF"/>`)
  parts.push(`<rect x="0" y="0" width="${W}" height="10" fill="${accent}"/>`)
  parts.push(`<text x="64" y="112" font-family="Onest, sans-serif" font-size="30" font-weight="700" fill="#1A171D">${title}</text>`)
  parts.push(`<line x1="64" y1="140" x2="${W - 64}" y2="140" stroke="#E5E1DE" stroke-width="2"/>`)

  let y = 196
  for (const line of lines) {
    parts.push(`<text x="64" y="${y}" font-family="Onest, sans-serif" font-size="19" fill="#3B3640">${line}</text>`)
    y += 42
  }
  // условные строки текста, чтобы лист выглядел заполненным
  y += 20
  for (let i = 0; i < 16; i++) {
    const w = 380 + ((i * 97) % 300)
    parts.push(`<rect x="64" y="${y}" width="${w}" height="9" rx="4" fill="#ECE8E2"/>`)
    y += 30
  }
  parts.push(`<line x1="64" y1="${H - 150}" x2="300" y2="${H - 150}" stroke="#3B3640" stroke-width="2"/>`)
  parts.push(`<text x="64" y="${H - 124}" font-family="Onest, sans-serif" font-size="15" fill="#8A8390">Подпись</text>`)
  parts.push(`<line x1="${W - 300}" y1="${H - 150}" x2="${W - 64}" y2="${H - 150}" stroke="#3B3640" stroke-width="2"/>`)
  parts.push(`<text x="${W - 300}" y="${H - 124}" font-family="Onest, sans-serif" font-size="15" fill="#8A8390">Дата</text>`)
  return svgUri(W, H, parts.join(''))
}

import type { ExplicationRoom, RoomKind } from '~/types/models'

export const ROOM_KIND_META: Record<RoomKind, { label: string; icon: string; coef: number; living: boolean }> = {
  living: { label: 'Жилая комната', icon: 'ph:bed', coef: 1, living: true },
  kitchen: { label: 'Кухня', icon: 'ph:cooking-pot', coef: 1, living: false },
  bath: { label: 'Санузел', icon: 'ph:shower', coef: 1, living: false },
  hall: { label: 'Коридор / прихожая', icon: 'ph:door-open', coef: 1, living: false },
  storage: { label: 'Кладовая', icon: 'ph:archive-box', coef: 1, living: false },
  balcony: { label: 'Балкон / лоджия', icon: 'ph:wind', coef: 0.5, living: false },
  terrace: { label: 'Терраса', icon: 'ph:sun', coef: 0.3, living: false },
  other: { label: 'Прочее', icon: 'ph:dots-three-circle', coef: 1, living: false },
}

export const ROOM_KINDS = Object.keys(ROOM_KIND_META) as RoomKind[]

/**
 * Цвет комнаты на разметке планировки. Красим не по типу, а по функциональной
 * группе — так на плане читается зонирование (жилое / мокрое / летнее), как на
 * настоящих архитектурных чертежах, и пяти цветов хватает вместо восьми.
 *
 * Значения подобраны валидатором палитры в режиме «все пары» (на плане любая
 * комната может граничить с любой): разделение под протанопией ΔE 11.4 и порог
 * нормального зрения ΔE 16.0 — оба проходят. Предупреждение по контрасту
 * светло-серой группы снимается тем, что на каждой области всегда напечатано
 * её название, то есть цвет никогда не единственный признак.
 *
 * Палитра одна для обеих тем: области лежат поверх загруженного изображения,
 * яркость которого от темы приложения не зависит.
 */
export type RoomGroup = 'living' | 'kitchen' | 'wet' | 'service' | 'outdoor'

export const ROOM_GROUP_OF: Record<RoomKind, RoomGroup> = {
  living: 'living',
  kitchen: 'kitchen',
  bath: 'wet',
  hall: 'service',
  storage: 'service',
  other: 'service',
  balcony: 'outdoor',
  terrace: 'outdoor',
}

export const ROOM_GROUP_META: Record<RoomGroup, { label: string; color: string }> = {
  living: { label: 'Жилые', color: '#8C5566' },
  kitchen: { label: 'Кухня', color: '#C9821A' },
  wet: { label: 'Санузлы', color: '#4A7FB5' },
  service: { label: 'Вспомогательные', color: '#B0A9B5' },
  outdoor: { label: 'Балконы и террасы', color: '#164A2D' },
}

export const ROOM_GROUPS = Object.keys(ROOM_GROUP_META) as RoomGroup[]

export function roomColor(kind: RoomKind) {
  return ROOM_GROUP_META[ROOM_GROUP_OF[kind] ?? 'service'].color
}

/** Название строки экспликации для подписи области. */
export function roomLabel(room: ExplicationRoom) {
  return room.name?.trim() || ROOM_KIND_META[room.kind].label
}

export interface ExplicationTotals {
  /** сумма всех строк без коэффициентов */
  raw: number
  /** площадь по документам: балконы и террасы с понижающим коэффициентом */
  total: number
  /** жилая площадь — только комнаты */
  living: number
  /** площадь без балконов, лоджий и террас */
  withoutLoggia: number
  /** сумма балконов/террас без коэффициента */
  loggia: number
}

export function explicationTotals(rooms: ExplicationRoom[]): ExplicationTotals {
  let raw = 0
  let total = 0
  let living = 0
  let loggia = 0
  for (const r of rooms) {
    const meta = ROOM_KIND_META[r.kind] ?? ROOM_KIND_META.other
    const a = Number.isFinite(r.area) ? r.area : 0
    raw += a
    total += a * meta.coef
    if (meta.living) living += a
    if (meta.coef < 1) loggia += a
  }
  return {
    raw: round1(raw),
    total: round1(total),
    living: round1(living),
    withoutLoggia: round1(raw - loggia),
    loggia: round1(loggia),
  }
}

function round1(v: number) {
  return Math.round(v * 10) / 10
}

// Типовой набор строк по числу комнат — чтобы экспликацию не набивали с нуля.
// Площади подгоняются под фактическую площадь помещения пропорционально.
export function defaultExplication(rooms: number, targetArea: number): Omit<ExplicationRoom, 'id'>[] {
  const base: Omit<ExplicationRoom, 'id'>[] = []
  if (rooms <= 0) {
    base.push({ name: 'Торговый зал', kind: 'other', area: 1 })
    base.push({ name: 'Подсобное помещение', kind: 'storage', area: 0.18 })
    base.push({ name: 'Санузел', kind: 'bath', area: 0.08 })
  } else if (rooms === 1) {
    base.push({ name: 'Жилая комната', kind: 'living', area: 0.42 })
    base.push({ name: 'Кухня-ниша', kind: 'kitchen', area: 0.22 })
    base.push({ name: 'Прихожая', kind: 'hall', area: 0.13 })
    base.push({ name: 'Санузел', kind: 'bath', area: 0.1 })
    base.push({ name: 'Лоджия', kind: 'balcony', area: 0.1 })
  } else {
    for (let i = 1; i <= rooms; i++) base.push({ name: i === 1 ? 'Гостиная' : `Спальня ${i - 1}`, kind: 'living', area: i === 1 ? 0.28 : 0.15 })
    base.push({ name: 'Кухня', kind: 'kitchen', area: 0.16 })
    base.push({ name: 'Прихожая', kind: 'hall', area: 0.1 })
    base.push({ name: 'Санузел', kind: 'bath', area: 0.07 })
    if (rooms >= 3) base.push({ name: 'Санузел гостевой', kind: 'bath', area: 0.04 })
    base.push({ name: 'Лоджия', kind: 'balcony', area: 0.08 })
  }
  // доли нормируем по площади С УЧЁТОМ коэффициентов, чтобы итог «по
  // документам» совпал с заявленной площадью и свежесобранная экспликация
  // не показывала расхождение
  const weighted = base.reduce((s, r) => s + r.area * ROOM_KIND_META[r.kind].coef, 0)
  const rows = base.map((r) => ({ ...r, area: round1((r.area / weighted) * targetArea) }))
  // округление до 0,1 по строкам даёт остаток в пару десятых — списываем его на
  // самую большую комнату, иначе итог не сойдётся с площадью и интерфейс будет
  // ругаться на только что сгенерированную ведомость
  const biggest = rows.reduce((a, c) => (c.area > a.area ? c : a), rows[0]!)
  if (biggest) {
    const achieved = rows.reduce((s, r) => s + r.area * ROOM_KIND_META[r.kind].coef, 0)
    const fix = (targetArea - achieved) / ROOM_KIND_META[biggest.kind].coef
    // здесь намеренно две цифры после запятой, а не одна: повторное округление
    // до 0,1 вернуло бы тот же остаток, из-за которого итог не сходится
    biggest.area = Math.round((biggest.area + fix) * 100) / 100
  }
  return rows
}

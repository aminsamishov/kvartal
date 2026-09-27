import type { LeadInterest, Unit, UnitKind, UnitStatus } from '~/types/models'
import { money } from '~/utils/format'

export type UnitFinishing = Unit['finishing']

/**
 * Единый фильтр фонда. Один и тот же объект применяется к шахматке, фасаду,
 * плану этажа и списку — иначе менеджер, переключив представление, видит другой
 * набор квартир и перестаёт доверять подбору.
 */
export interface UnitFilterState {
  search: string
  projectIds: string[]
  buildingIds: string[]
  kinds: UnitKind[]
  statuses: UnitStatus[]
  finishing: UnitFinishing[]
  sections: number[]
  roomsMin: string
  roomsMax: string
  priceMin: string
  priceMax: string
  areaMin: string
  areaMax: string
  floorMin: string
  floorMax: string
  /** спрятать проданное и закрытое — самый частый запрос менеджера */
  onlyAvailable: boolean
}

export function emptyUnitFilters(): UnitFilterState {
  return {
    search: '', projectIds: [], buildingIds: [], kinds: [], statuses: [], finishing: [], sections: [],
    roomsMin: '', roomsMax: '', priceMin: '', priceMax: '', areaMin: '', areaMax: '', floorMin: '', floorMax: '',
    onlyAvailable: false,
  }
}

const AVAILABLE: UnitStatus[] = ['free', 'reserved']

function num(v: string) {
  const n = Number(v)
  return v === '' || !Number.isFinite(n) ? undefined : n
}

export function matchesUnitFilters(u: Unit, f: UnitFilterState) {
  if (f.onlyAvailable && !AVAILABLE.includes(u.status)) return false
  if (f.projectIds.length && !f.projectIds.includes(u.projectId)) return false
  if (f.buildingIds.length && !f.buildingIds.includes(u.buildingId)) return false
  if (f.kinds.length && !f.kinds.includes(u.kind)) return false
  if (f.statuses.length && !f.statuses.includes(u.status)) return false
  if (f.finishing.length && !f.finishing.includes(u.finishing)) return false
  if (f.sections.length && !f.sections.includes(u.section)) return false

  const roomsMin = num(f.roomsMin); const roomsMax = num(f.roomsMax)
  if (roomsMin !== undefined && u.rooms < roomsMin) return false
  if (roomsMax !== undefined && u.rooms > roomsMax) return false

  const priceMin = num(f.priceMin); const priceMax = num(f.priceMax)
  if (priceMin !== undefined && u.price < priceMin) return false
  if (priceMax !== undefined && u.price > priceMax) return false

  const areaMin = num(f.areaMin); const areaMax = num(f.areaMax)
  if (areaMin !== undefined && u.area < areaMin) return false
  if (areaMax !== undefined && u.area > areaMax) return false

  const floorMin = num(f.floorMin); const floorMax = num(f.floorMax)
  if (floorMin !== undefined && u.floor < floorMin) return false
  if (floorMax !== undefined && u.floor > floorMax) return false

  const q = f.search.trim().toLowerCase()
  if (q && !u.number.toLowerCase().includes(q) && !(u.layoutName ?? '').toLowerCase().includes(q)) return false

  return true
}

/** Сколько фильтров реально ограничивает выборку — для счётчика на кнопке. */
export function activeFilterCount(f: UnitFilterState) {
  let n = 0
  if (f.search.trim()) n++
  if (f.projectIds.length) n++
  if (f.buildingIds.length) n++
  if (f.kinds.length) n++
  if (f.statuses.length) n++
  if (f.finishing.length) n++
  if (f.sections.length) n++
  if (f.roomsMin || f.roomsMax) n++
  if (f.priceMin || f.priceMax) n++
  if (f.areaMin || f.areaMax) n++
  if (f.floorMin || f.floorMax) n++
  if (f.onlyAvailable) n++
  return n
}

export function hasAnyFilter(f: UnitFilterState) {
  return activeFilterCount(f) > 0
}

function rangeLabel(min: string, max: string, unit = '', fmt?: (v: number) => string) {
  const a = num(min); const b = num(max)
  const show = (v: number) => (fmt ? fmt(v) : `${v}${unit}`)
  if (a !== undefined && b !== undefined) return a === b ? show(a) : `${show(a)} – ${show(b)}`
  if (a !== undefined) return `от ${show(a)}`
  if (b !== undefined) return `до ${show(b)}`
  return ''
}

/** Читаемые чипы активного фильтра — менеджер видит, что именно он сузил. */
export function describeFilters(f: UnitFilterState): { key: keyof UnitFilterState; label: string }[] {
  const out: { key: keyof UnitFilterState; label: string }[] = []
  if (f.onlyAvailable) out.push({ key: 'onlyAvailable', label: 'Только доступные' })
  const rooms = rangeLabel(f.roomsMin, f.roomsMax, ' комн.')
  if (rooms) out.push({ key: 'roomsMin', label: rooms })
  const price = rangeLabel(f.priceMin, f.priceMax, '', (v) => money(v))
  if (price) out.push({ key: 'priceMin', label: price })
  const area = rangeLabel(f.areaMin, f.areaMax, ' м²')
  if (area) out.push({ key: 'areaMin', label: area })
  const floor = rangeLabel(f.floorMin, f.floorMax, ' эт.')
  if (floor) out.push({ key: 'floorMin', label: floor })
  if (f.sections.length) out.push({ key: 'sections', label: `Секция ${f.sections.join(', ')}` })
  return out
}

/** Сбросить одну группу фильтров — по ключу из describeFilters. */
export function clearFilterGroup(f: UnitFilterState, key: keyof UnitFilterState) {
  const next = { ...f }
  if (key === 'roomsMin' || key === 'roomsMax') { next.roomsMin = ''; next.roomsMax = '' }
  else if (key === 'priceMin' || key === 'priceMax') { next.priceMin = ''; next.priceMax = '' }
  else if (key === 'areaMin' || key === 'areaMax') { next.areaMin = ''; next.areaMax = '' }
  else if (key === 'floorMin' || key === 'floorMax') { next.floorMin = ''; next.floorMax = '' }
  else if (key === 'sections') next.sections = []
  else if (key === 'onlyAvailable') next.onlyAvailable = false
  return next
}

/**
 * Фильтр из запроса клиента. Бюджет и комнатность переносим как есть, но
 * проданное не показываем: подбор — это то, что можно продать сегодня.
 */
export function filtersFromInterest(interest: LeadInterest): UnitFilterState {
  const f = emptyUnitFilters()
  f.projectIds = [...interest.projectIds]
  f.buildingIds = [...interest.buildingIds]
  f.roomsMin = interest.roomsMin?.toString() ?? ''
  f.roomsMax = interest.roomsMax?.toString() ?? ''
  f.areaMin = interest.areaMin?.toString() ?? ''
  f.areaMax = interest.areaMax?.toString() ?? ''
  f.floorMin = interest.floorMin?.toString() ?? ''
  f.floorMax = interest.floorMax?.toString() ?? ''
  f.priceMin = interest.budgetMin?.toString() ?? ''
  f.priceMax = interest.budgetMax?.toString() ?? ''
  f.onlyAvailable = true
  return f
}

export const FINISHING_META: Record<UnitFinishing, string> = {
  none: 'Без отделки',
  rough: 'Черновая',
  fine: 'Чистовая',
  furnished: 'Меблировано',
}

export const FINISHING_KINDS = Object.keys(FINISHING_META) as UnitFinishing[]

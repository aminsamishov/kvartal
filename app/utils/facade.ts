import type { FacadeView, ImageZone, Unit, ZonePoint } from '~/types/models'
import { facadeFloorBand } from '~/data/placeholders'
import { zoneBBox } from '~/utils/zones'

export interface FacadeUnitZone {
  unitId: string
  polygon: ZonePoint[]
  /** контур не размечен руками, а выведен из полосы этажа */
  derived: boolean
}

/** Полоса этажа: из размеченной области `floor:N`, иначе из геометрии дома. */
function floorBand(facade: FacadeView | undefined, floor: number, floors: number) {
  const marked = facade?.zones.find((z) => z.refId === `floor:${floor}`)
  if (marked) {
    const b = zoneBBox(marked)
    if (b.w > 0.02 && b.h > 0.01) return b
  }
  return facadeFloorBand(floor, Math.max(1, floors))
}

function rect(x: number, y: number, w: number, h: number): ZonePoint[] {
  return [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }]
}

/**
 * Контуры помещений на фасаде.
 *
 * Если застройщик разметил квартиры руками (`refId = unit:<id>`) — берём его
 * разметку. Если размечены только этажи или не размечено ничего, раскладываем
 * помещения этажа по его полосе слева направо: фасад остаётся рабочим
 * инструментом продаж с первого дня, а не пустой картинкой до конца разметки.
 * Такие контуры помечены `derived` — интерфейс честно говорит, что это
 * авторазметка.
 */
export function facadeUnitZones(input: {
  facade: FacadeView | undefined
  floors: number
  units: Unit[]
}): FacadeUnitZone[] {
  const { facade, floors, units } = input
  const out: FacadeUnitZone[] = []

  const marked = new Map<string, ImageZone>()
  for (const z of facade?.zones ?? []) {
    if (z.refId.startsWith('unit:')) marked.set(z.refId.slice(5), z)
  }

  const above = units.filter((u) => u.floor >= 1)
  const byFloor = new Map<number, Unit[]>()
  for (const u of above) {
    const list = byFloor.get(u.floor) ?? []
    list.push(u)
    byFloor.set(u.floor, list)
  }

  for (const [floor, list] of byFloor) {
    const sorted = [...list].sort((a, b) => a.section - b.section
      || a.number.localeCompare(b.number, undefined, { numeric: true }))
    const band = floorBand(facade, floor, floors)
    // зазоры между контурами: иначе соседние квартиры сливаются в одну полосу
    const slot = band.w / sorted.length
    const padX = Math.min(slot * 0.12, 0.006)
    const padY = band.h * 0.14

    sorted.forEach((unit, i) => {
      const hand = marked.get(unit.id)
      if (hand) {
        out.push({ unitId: unit.id, polygon: hand.shape === 'poly' ? hand.points : rect(
          Math.min(hand.points[0]?.x ?? 0, hand.points[1]?.x ?? 0),
          Math.min(hand.points[0]?.y ?? 0, hand.points[1]?.y ?? 0),
          Math.abs((hand.points[1]?.x ?? 0) - (hand.points[0]?.x ?? 0)),
          Math.abs((hand.points[1]?.y ?? 0) - (hand.points[0]?.y ?? 0)),
        ), derived: false })
        return
      }
      out.push({
        unitId: unit.id,
        polygon: rect(band.x + slot * i + padX, band.y + padY, Math.max(slot - padX * 2, 0.004), Math.max(band.h - padY * 2, 0.004)),
        derived: true,
      })
    })
  }

  return out
}

/** Сколько помещений размечено руками — показываем в шапке фасада. */
export function facadeMarkupStats(facade: FacadeView | undefined, unitsCount: number) {
  const hand = (facade?.zones ?? []).filter((z) => z.refId.startsWith('unit:')).length
  const floorsMarked = (facade?.zones ?? []).filter((z) => z.refId.startsWith('floor:')).length
  return { hand, floorsMarked, total: unitsCount, derived: Math.max(0, unitsCount - hand) }
}

/* --------------------------- блоки: секция × этаж -------------------------- */

export interface FacadeBlockZone {
  /** `${section}:${floor}` — секция и этаж однозначно задают блок */
  key: string
  section: number
  floor: number
  polygon: ZonePoint[]
  unitIds: string[]
  /** ни одна квартира блока не размечена руками */
  derived: boolean
}

/**
 * Блоки на фасаде: один контур на пересечение подъезда и этажа.
 *
 * Клиенту на рендере не нужны контуры каждого окна — ему нужно понять, где
 * подъезд, где этаж и что там есть. Поэтому в режиме продажи фасад размечен
 * блоками: контур блока — объединяющий прямоугольник контуров его квартир,
 * откуда бы они ни взялись (ручная разметка или полоса этажа).
 */
export function facadeBlockZones(input: {
  facade: FacadeView | undefined
  floors: number
  units: Unit[]
}): FacadeBlockZone[] {
  const zones = facadeUnitZones(input)
  const byUnit = new Map(input.units.map((u) => [u.id, u]))
  const groups = new Map<string, { section: number; floor: number; zones: FacadeUnitZone[] }>()

  for (const z of zones) {
    const unit = byUnit.get(z.unitId)
    if (!unit) continue
    const key = `${unit.section}:${unit.floor}`
    const group = groups.get(key) ?? { section: unit.section, floor: unit.floor, zones: [] }
    group.zones.push(z)
    groups.set(key, group)
  }

  return [...groups.entries()].map(([key, group]) => {
    const xs = group.zones.flatMap((z) => z.polygon.map((p) => p.x))
    const ys = group.zones.flatMap((z) => z.polygon.map((p) => p.y))
    const x0 = Math.min(...xs); const x1 = Math.max(...xs)
    const y0 = Math.min(...ys); const y1 = Math.max(...ys)
    return {
      key,
      section: group.section,
      floor: group.floor,
      polygon: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }],
      unitIds: group.zones.map((z) => z.unitId),
      derived: group.zones.every((z) => z.derived),
    }
  }).sort((a, b) => b.floor - a.floor || a.section - b.section)
}

export interface RoomTypeSummary {
  rooms: number
  /** сколько таких квартир в блоке */
  count: number
  free: number
  /** минимальная цена среди свободных, иначе среди всех */
  minPrice: number
  minArea: number
  maxArea: number
}

export interface BlockSummary {
  total: number
  free: number
  reserved: number
  sold: number
  /** минимальная цена свободной квартиры блока */
  minPrice: number
  byRooms: RoomTypeSummary[]
}

/**
 * Что есть в блоке: сколько квартир какого типа и от какой суммы. Ровно на
 * этот вопрос отвечает менеджер, когда клиент тычет пальцем в этаж на рендере.
 */
export function blockSummary(units: Unit[]): BlockSummary {
  const sellable = units.filter((u) => u.kind === 'apartment' || u.kind === 'commercial')
  const free = sellable.filter((u) => u.status === 'free')

  const byRooms = new Map<number, Unit[]>()
  for (const u of sellable) {
    const list = byRooms.get(u.rooms) ?? []
    list.push(u)
    byRooms.set(u.rooms, list)
  }

  return {
    total: sellable.length,
    free: free.length,
    reserved: sellable.filter((u) => u.status === 'reserved').length,
    sold: sellable.filter((u) => u.status === 'sold' || u.status === 'installment').length,
    minPrice: free.length ? Math.min(...free.map((u) => u.price)) : 0,
    byRooms: [...byRooms.entries()]
      .map(([rooms, list]) => {
        const freeOnes = list.filter((u) => u.status === 'free')
        const pricePool = freeOnes.length ? freeOnes : list
        return {
          rooms,
          count: list.length,
          free: freeOnes.length,
          minPrice: Math.min(...pricePool.map((u) => u.price)),
          minArea: Math.min(...list.map((u) => u.area)),
          maxArea: Math.max(...list.map((u) => u.area)),
        }
      })
      .sort((a, b) => a.rooms - b.rooms),
  }
}

/** Цвет блока по остатку: клиенту видно, где ещё есть выбор. */
export function blockTone(summary: BlockSummary): { color: string; label: string } {
  if (!summary.total) return { color: 'var(--c-closed)', label: 'нет помещений' }
  if (!summary.free) return { color: 'var(--c-sold)', label: 'всё продано' }
  const share = summary.free / summary.total
  if (share <= 0.25) return { color: 'var(--c-inst)', label: 'осталось мало' }
  if (share <= 0.5) return { color: 'var(--c-reserve)', label: 'выбор ограничен' }
  return { color: 'var(--c-free)', label: 'есть выбор' }
}

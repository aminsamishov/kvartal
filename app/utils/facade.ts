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

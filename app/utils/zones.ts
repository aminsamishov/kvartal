import type { ImageZone, ZonePoint } from '~/types/models'

// Геометрия областей разметки. Все координаты нормализованы 0..1 от размеров
// изображения, поэтому вычисления не зависят от размера отображения.

export function zonePolygon(zone: ImageZone): ZonePoint[] {
  if (zone.shape === 'poly') return zone.points
  const [a, b] = zone.points
  if (!a || !b) return []
  const x0 = Math.min(a.x, b.x)
  const x1 = Math.max(a.x, b.x)
  const y0 = Math.min(a.y, b.y)
  const y1 = Math.max(a.y, b.y)
  return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]
}

export function zonePointsAttr(zone: ImageZone) {
  return zonePolygon(zone).map((p) => `${p.x},${p.y}`).join(' ')
}

export function zoneBBox(zone: ImageZone) {
  const pts = zonePolygon(zone)
  if (!pts.length) return { x: 0, y: 0, w: 0, h: 0 }
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

// центр по площади (центроид многоугольника) — подпись должна стоять внутри
// фигуры, а не в центре описывающего прямоугольника: для Г-образных квартир
// это разные точки, и второй вариант попадает за пределы контура
export function zoneCentroid(zone: ImageZone): ZonePoint {
  const pts = zonePolygon(zone)
  if (pts.length < 3) {
    const b = zoneBBox(zone)
    return { x: b.x + b.w / 2, y: b.y + b.h / 2 }
  }
  let area = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!
    const q = pts[(i + 1) % pts.length]!
    const cross = p.x * q.y - q.x * p.y
    area += cross
    cx += (p.x + q.x) * cross
    cy += (p.y + q.y) * cross
  }
  if (Math.abs(area) < 1e-9) {
    const b = zoneBBox(zone)
    return { x: b.x + b.w / 2, y: b.y + b.h / 2 }
  }
  return { x: cx / (3 * area), y: cy / (3 * area) }
}

export function polygonArea(pts: ZonePoint[]) {
  let area = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!
    const q = pts[(i + 1) % pts.length]!
    area += p.x * q.y - q.x * p.y
  }
  return Math.abs(area) / 2
}

export function zoneArea(zone: ImageZone) {
  return polygonArea(zonePolygon(zone))
}

export function rectZone(a: ZonePoint, b: ZonePoint): Pick<ImageZone, 'shape' | 'points'> {
  return { shape: 'rect', points: [a, b] }
}

export function clamp01(v: number) {
  return Math.min(Math.max(v, 0), 1)
}

export function movePolygon(pts: ZonePoint[], dx: number, dy: number): ZonePoint[] {
  // сдвиг ограничиваем так, чтобы фигура целиком осталась в пределах картинки
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const ddx = Math.min(Math.max(dx, -Math.min(...xs)), 1 - Math.max(...xs))
  const ddy = Math.min(Math.max(dy, -Math.min(...ys)), 1 - Math.max(...ys))
  return pts.map((p) => ({ x: p.x + ddx, y: p.y + ddy }))
}

export function dist(a: ZonePoint, b: ZonePoint) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

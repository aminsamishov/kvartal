import type { AgendaItem } from '~/utils/agenda'
import { AGENDA_KIND_DURATION } from '~/utils/agenda'

/**
 * Раскладка дел по сетке дня. Планнер отличается от списка тем, что показывает
 * не порядок, а занятость: где встречи наложились друг на друга и где в дне
 * осталась дыра под ещё один показ.
 */
export interface PlacedEvent {
  item: AgendaItem
  /** границы в часах от полуночи, дробные: 10.5 — это 10:30 */
  start: number
  end: number
  /** колонка внутри группы наложившихся дел и сколько всего таких колонок */
  col: number
  cols: number
}

export function hoursOf(iso: string) {
  const d = new Date(iso)
  return d.getHours() + d.getMinutes() / 60
}

/**
 * Разложить дела по колонкам так, чтобы пересекающиеся не перекрывали друг
 * друга. Кластер — цепочка дел, связанных пересечениями: внутри него ширина
 * у всех одинаковая, иначе соседние дни «дышат» разной шириной блоков.
 */
export function placeEvents(items: AgendaItem[], fromHour: number, toHour: number): PlacedEvent[] {
  const placed: PlacedEvent[] = items
    .map((item) => {
      const raw = hoursOf(item.at)
      // дело вне рабочего окна не теряем, а прижимаем к его краю
      const start = Math.min(Math.max(raw, fromHour), toHour - 0.25)
      const dur = (AGENDA_KIND_DURATION[item.kind] ?? 30) / 60
      return { item, start, end: Math.min(toHour, start + dur), col: 0, cols: 1 }
    })
    .sort((a, b) => a.start - b.start || a.end - b.end)

  let cluster: PlacedEvent[] = []
  let clusterEnd = -Infinity

  function flush() {
    if (!cluster.length) return
    // жадно занимаем первую колонку, которая освободилась к началу дела
    const lastEnd: number[] = []
    for (const e of cluster) {
      let c = lastEnd.findIndex((end) => end <= e.start + 1e-6)
      if (c === -1) { c = lastEnd.length; lastEnd.push(0) }
      lastEnd[c] = e.end
      e.col = c
    }
    for (const e of cluster) e.cols = lastEnd.length
    cluster = []
  }

  for (const e of placed) {
    if (cluster.length && e.start >= clusterEnd - 1e-6) flush()
    cluster.push(e)
    clusterEnd = cluster.length === 1 ? e.end : Math.max(clusterEnd, e.end)
  }
  flush()

  return placed
}

/** Рабочее окно дня: границы подстраиваются под дела, но не уже 8:00–20:00. */
export function workWindow(items: AgendaItem[]) {
  let from = 8
  let to = 20
  for (const i of items) {
    if (i.allDay) continue
    const h = hoursOf(i.at)
    from = Math.min(from, Math.floor(h))
    to = Math.max(to, Math.ceil(h + 1))
  }
  return { from: Math.max(0, from), to: Math.min(24, to) }
}

/**
 * Ближайший разумный слот для новой задачи: следующий круглый час, но в
 * пределах рабочего дня. Предлагать «перезвонить в 01:00», потому что менеджер
 * открыл CRM ночью, — плохой совет, и его приходится править руками.
 */
export function nextWorkSlot(base = new Date()) {
  const d = new Date(base)
  d.setHours(d.getHours() + 1, 0, 0, 0)
  if (d.getHours() > 18) {
    d.setDate(d.getDate() + 1)
    d.setHours(10, 0, 0, 0)
  } else if (d.getHours() < 9) {
    d.setHours(10, 0, 0, 0)
  }
  return d
}

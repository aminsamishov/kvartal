import type { Contract, Lead, Payment, Reservation, Unit } from '~/types/models'
import { MONTHS } from '~/utils/format'

/** Ключи последних n месяцев, заканчивая месяцем `now`. */
export function lastMonths(now: Date, n: number) {
  const out: { key: string; label: string; year: number; month: number }[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: MONTHS[d.getMonth()]!,
      year: d.getFullYear(),
      month: d.getMonth(),
    })
  }
  return out
}

function monthKey(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}`
}

/** Свернуть записи по месяцам в ряд значений, выровненный по `months`. */
export function seriesBy<T>(
  months: ReturnType<typeof lastMonths>,
  rows: T[],
  dateOf: (r: T) => string | undefined,
  valueOf: (r: T) => number,
) {
  const acc = new Map<string, number>()
  for (const r of rows) {
    const iso = dateOf(r)
    if (!iso) continue
    const k = monthKey(iso)
    acc.set(k, (acc.get(k) ?? 0) + valueOf(r))
  }
  return months.map((m) => acc.get(m.key) ?? 0)
}

/** Изменение последнего месяца к предыдущему, в процентах. */
export function momDelta(series: number[]) {
  const cur = series[series.length - 1] ?? 0
  const prev = series[series.length - 2] ?? 0
  if (!prev) return null
  const pct = Math.round(((cur - prev) / prev) * 100)
  return { pct, dir: (pct >= 0 ? 'up' : 'down') as 'up' | 'down' }
}

export interface ManagerRow {
  id: string
  leads: number
  visits: number
  reservations: number
  deals: number
  conversion: number
}

/** Сводка по менеджерам из того, что реально связано: заявки и брони. */
export function managerRows(userIds: string[], leads: Lead[], reservations: Reservation[]): ManagerRow[] {
  return userIds.map((id) => {
    const own = leads.filter((l) => l.assignedTo === id)
    const deals = own.filter((l) => l.stage === 'deal').length
    return {
      id,
      leads: own.length,
      visits: own.filter((l) => ['visit', 'reserved', 'deal'].includes(l.stage)).length,
      reservations: reservations.filter((r) => r.createdBy === id).length,
      deals,
      conversion: own.length ? Math.round((deals / own.length) * 100) : 0,
    }
  }).sort((a, b) => b.deals - a.deals || b.leads - a.leads)
}

/** Средняя цена квадратного метра по помещениям в продаже. */
export function avgPricePerM2(units: Unit[]) {
  const sellable = units.filter((u) => u.area > 0 && u.price > 0 && u.kind !== 'parking' && u.kind !== 'storage')
  if (!sellable.length) return 0
  return Math.round(sellable.reduce((s, u) => s + u.price / u.area, 0) / sellable.length)
}

export function contractValue(c: Contract) {
  return c.price
}

export function confirmedAmount(p: Payment) {
  return p.status === 'confirmed' ? p.amount : 0
}

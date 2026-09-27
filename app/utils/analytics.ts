import type { Contract, Lead, LeadStage, Payment, Reservation, ScheduleItem, Unit } from '~/types/models'
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

/* --------------------------- KPI руководителя ----------------------------- */

export interface FunnelStep {
  key: string
  label: string
  count: number
  /** конверсия к предыдущему этапу, % */
  conversion: number | null
}

/**
 * Накопительная воронка: «дошли до этапа». Считать по числу заявок, стоящих на
 * этапе прямо сейчас, нельзя — снимок не обязан убывать, и конверсия вышла бы
 * больше 100%. Отказы в воронку не попадают: как далеко такая заявка прошла
 * до отказа, система не хранит.
 */
export function stageFunnel(leads: Lead[], pipeline: LeadStage[], labelOf: (s: LeadStage) => string): FunnelStep[] {
  const live = leads.filter((l) => l.stage !== 'lost')
  return pipeline.map((stage, i) => {
    const count = live.filter((l) => pipeline.indexOf(l.stage) >= i).length
    const prev = i === 0 ? 0 : live.filter((l) => pipeline.indexOf(l.stage) >= i - 1).length
    return { key: stage, label: labelOf(stage), count, conversion: prev ? Math.round((count / prev) * 100) : null }
  })
}

export interface RankedRow {
  key: string
  label: string
  value: number
  /** вторая величина — показывается справа мелким кеглем */
  secondary?: number
  hint?: string
}

/** Продажи по ЖК: сумма договоров и их количество. */
export function salesByProject(contracts: Contract[], nameOf: (id: string) => string): RankedRow[] {
  const acc = new Map<string, { sum: number; count: number }>()
  for (const c of contracts) {
    const cur = acc.get(c.projectId) ?? { sum: 0, count: 0 }
    cur.sum += c.price
    cur.count++
    acc.set(c.projectId, cur)
  }
  return [...acc.entries()]
    .map(([id, v]) => ({ key: id, label: nameOf(id), value: v.sum, secondary: v.count }))
    .sort((a, b) => b.value - a.value)
}

/** Продажи по менеджерам: считаем через заявку, иначе договор не знает автора. */
export function salesByManager(
  contracts: Contract[],
  leads: Lead[],
  nameOf: (id: string) => string,
): RankedRow[] {
  const leadById = new Map(leads.map((l) => [l.id, l]))
  const acc = new Map<string, { sum: number; count: number }>()
  for (const c of contracts) {
    const lead = c.leadId ? leadById.get(c.leadId) : undefined
    if (!lead) continue
    const cur = acc.get(lead.assignedTo) ?? { sum: 0, count: 0 }
    cur.sum += c.price
    cur.count++
    acc.set(lead.assignedTo, cur)
  }
  return [...acc.entries()]
    .map(([id, v]) => ({ key: id, label: nameOf(id), value: v.sum, secondary: v.count }))
    .sort((a, b) => b.value - a.value)
}

/** Источники лидов: сколько пришло и сколько дошло до сделки. */
export function leadSourceStats(leads: Lead[]): RankedRow[] {
  const acc = new Map<string, { total: number; deals: number }>()
  for (const l of leads) {
    const cur = acc.get(l.source) ?? { total: 0, deals: 0 }
    cur.total++
    if (l.stage === 'deal') cur.deals++
    acc.set(l.source, cur)
  }
  return [...acc.entries()]
    .map(([source, v]) => ({
      key: source, label: source, value: v.total, secondary: v.deals,
      hint: v.total ? `${Math.round((v.deals / v.total) * 100)}% в сделку` : undefined,
    }))
    .sort((a, b) => b.value - a.value)
}

/** Средний цикл сделки: от заявки до подписанного договора, в днях. */
export function avgDealCycleDays(contracts: Contract[], leads: Lead[]) {
  const leadById = new Map(leads.map((l) => [l.id, l]))
  const spans: number[] = []
  for (const c of contracts) {
    const lead = c.leadId ? leadById.get(c.leadId) : undefined
    if (!lead || !c.signedAt) continue
    const days = (new Date(c.signedAt).getTime() - new Date(lead.createdAt).getTime()) / 86400000
    if (days >= 0) spans.push(days)
  }
  if (!spans.length) return null
  return Math.round(spans.reduce((s, v) => s + v, 0) / spans.length)
}

/** Конверсия «бронь → договор»: ради этой цифры бронь и существует. */
export function reservationToContract(reservations: Reservation[]) {
  const total = reservations.length
  const converted = reservations.filter((r) => r.status === 'converted').length
  return { total, converted, percent: total ? Math.round((converted / total) * 100) : 0 }
}

/**
 * План / факт поступлений по месяцам. План — суммы по графику, факт —
 * подтверждённые платежи: разрыв между ними и есть кассовый разрыв.
 */
export function planFactSeries(
  months: ReturnType<typeof lastMonths>,
  schedule: ScheduleItem[],
  payments: Payment[],
) {
  const plan = seriesBy(months, schedule, (i) => i.dueDate, (i) => i.amount)
  const fact = seriesBy(months, payments, (p) => (p.status === 'confirmed' ? p.date : undefined), (p) => p.amount)
  return months.map((m, i) => ({
    label: m.label,
    plan: plan[i] ?? 0,
    fact: fact[i] ?? 0,
    done: (plan[i] ?? 0) > 0 ? Math.round(((fact[i] ?? 0) / (plan[i] ?? 1)) * 100) : null,
  }))
}

/** Брони, которые истекают в ближайшие дни или уже просрочены. */
export function expiringReservations(reservations: Reservation[], now: Date, days = 3) {
  return reservations
    .filter((r) => r.status === 'active')
    .map((r) => ({ reservation: r, daysLeft: Math.ceil((new Date(r.expiresAt).getTime() - now.getTime()) / 86400000) }))
    .filter((x) => x.daysLeft <= days)
    .sort((a, b) => a.daysLeft - b.daysLeft)
}

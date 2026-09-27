import type { Currency, UnitKind } from '~/types/models'
import type { ClientProfile, ClientStatus } from '~/utils/clientProfile'

export type NextDuePeriod = '' | 'overdue' | 'week' | 'month' | 'quarter'

export const NEXT_DUE_OPTIONS: { value: NextDuePeriod; label: string }[] = [
  { value: '', label: 'Любой срок' },
  { value: 'overdue', label: 'Просрочен' },
  { value: 'week', label: 'В течение недели' },
  { value: 'month', label: 'В течение месяца' },
  { value: 'quarter', label: 'В течение квартала' },
]

export interface ClientFilterState {
  search: string
  projectIds: string[]
  buildingIds: string[]
  managerIds: string[]
  statuses: ClientStatus[]
  paymentMethodIds: string[]
  banks: string[]
  unitKinds: UnitKind[]
  currency: '' | Currency
  nextDue: NextDuePeriod
  purchaseFrom: string
  purchaseTo: string
  amountMin: string
  amountMax: string
  overdueOnly: boolean
  vipOnly: boolean
  /** реестр покупателей: без договора клиент сюда не относится */
  buyersOnly: boolean
}

export function emptyClientFilters(): ClientFilterState {
  return {
    search: '', projectIds: [], buildingIds: [], managerIds: [], statuses: [],
    paymentMethodIds: [], banks: [], unitKinds: [], currency: '', nextDue: '',
    purchaseFrom: '', purchaseTo: '', amountMin: '', amountMax: '',
    overdueOnly: false, vipOnly: false, buyersOnly: true,
  }
}

function num(v: string) {
  const n = Number(v)
  return v === '' || !Number.isFinite(n) ? undefined : n
}

function daysUntil(iso: string, now: Date) {
  return Math.ceil((new Date(iso).getTime() - now.getTime()) / 86400000)
}

export function matchesClientFilters(p: ClientProfile, f: ClientFilterState, now = new Date()) {
  if (f.buyersOnly && !p.contracts.length) return false
  if (f.vipOnly && !p.client.vip) return false
  if (f.overdueOnly && !p.totals.overdueAmount) return false

  if (f.statuses.length && !f.statuses.includes(p.status)) return false
  if (f.managerIds.length && !(p.manager && f.managerIds.includes(p.manager.id))) return false
  if (f.projectIds.length && !p.units.some((u) => f.projectIds.includes(u.projectId))) return false
  if (f.buildingIds.length && !p.units.some((u) => f.buildingIds.includes(u.buildingId))) return false
  if (f.unitKinds.length && !p.units.some((u) => f.unitKinds.includes(u.kind))) return false
  if (f.currency && !p.contracts.some((c) => c.currency === f.currency)) return false
  if (f.paymentMethodIds.length && !p.contracts.some((c) => c.paymentMethodId && f.paymentMethodIds.includes(c.paymentMethodId))) return false
  if (f.banks.length && !p.contracts.some((c) => c.bank && f.banks.includes(c.bank))) return false

  const amountMin = num(f.amountMin)
  const amountMax = num(f.amountMax)
  if (amountMin !== undefined && p.totals.purchases < amountMin) return false
  if (amountMax !== undefined && p.totals.purchases > amountMax) return false

  if (f.nextDue) {
    if (f.nextDue === 'overdue') {
      if (!p.totals.overdueAmount) return false
    } else {
      const next = p.totals.nextDue
      if (!next) return false
      const limit = f.nextDue === 'week' ? 7 : f.nextDue === 'month' ? 31 : 92
      const left = daysUntil(next.dueDate, now)
      if (left > limit) return false
    }
  }

  if (f.purchaseFrom || f.purchaseTo) {
    if (!p.purchaseAt) return false
    const at = p.purchaseAt.slice(0, 10)
    if (f.purchaseFrom && at < f.purchaseFrom) return false
    if (f.purchaseTo && at > f.purchaseTo) return false
  }

  const q = f.search.trim().toLowerCase()
  if (q) {
    const digits = q.replace(/\D/g, '')
    const hit = p.client.name.toLowerCase().includes(q)
      || (digits.length >= 3 && p.client.phone.includes(digits))
      || (p.client.email ?? '').toLowerCase().includes(q)
      || (p.client.inn ?? '').includes(q)
      || p.contracts.some((c) => c.number.toLowerCase().includes(q))
      || p.units.some((u) => u.number.toLowerCase() === q)
    if (!hit) return false
  }

  return true
}

export function activeClientFilterCount(f: ClientFilterState) {
  let n = 0
  if (f.projectIds.length) n++
  if (f.buildingIds.length) n++
  if (f.managerIds.length) n++
  if (f.statuses.length) n++
  if (f.paymentMethodIds.length) n++
  if (f.banks.length) n++
  if (f.unitKinds.length) n++
  if (f.currency) n++
  if (f.nextDue) n++
  if (f.purchaseFrom || f.purchaseTo) n++
  if (f.amountMin || f.amountMax) n++
  if (f.overdueOnly) n++
  if (f.vipOnly) n++
  if (!f.buyersOnly) n++
  return n
}

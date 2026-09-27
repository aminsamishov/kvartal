import type { ClientProfile } from '~/utils/clientProfile'
import { CLIENT_STATUS_META } from '~/utils/clientProfile'
import { fmtDate, fmtPhone, money } from '~/utils/format'

export type ClientColumnKey =
  | 'client' | 'phone' | 'project' | 'units' | 'manager' | 'contract' | 'status'
  | 'paid' | 'remaining' | 'nextDue' | 'overdue' | 'purchaseAt' | 'lastActivity'

export interface ClientColumn {
  key: ClientColumnKey
  label: string
  align?: 'right'
  width?: string
  /** колонку нельзя ни скрыть, ни открепить: без неё строка безымянная */
  required?: boolean
}

export const CLIENT_COLUMNS: ClientColumn[] = [
  { key: 'client', label: 'Клиент', width: '240px', required: true },
  { key: 'phone', label: 'Телефон', width: '150px' },
  { key: 'project', label: 'ЖК', width: '160px' },
  { key: 'units', label: 'Помещений', align: 'right', width: '110px' },
  { key: 'manager', label: 'Менеджер', width: '170px' },
  { key: 'contract', label: 'Договор', width: '140px' },
  { key: 'status', label: 'Статус', width: '130px' },
  { key: 'paid', label: 'Оплачено', align: 'right', width: '130px' },
  { key: 'remaining', label: 'Остаток', align: 'right', width: '130px' },
  { key: 'nextDue', label: 'Следующий платёж', width: '170px' },
  { key: 'overdue', label: 'Просрочка', align: 'right', width: '120px' },
  { key: 'purchaseAt', label: 'Дата покупки', width: '140px' },
  { key: 'lastActivity', label: 'Последняя активность', width: '200px' },
]

/** Значение для сортировки: строки сравниваем как строки, деньги — как числа. */
export function clientSortValue(p: ClientProfile, key: ClientColumnKey): string | number {
  switch (key) {
    case 'client': return p.client.name
    case 'phone': return p.client.phone
    case 'project': return p.project?.name ?? ''
    case 'units': return p.totals.unitsCount
    case 'manager': return p.manager?.name ?? ''
    case 'contract': return p.contracts[0]?.number ?? ''
    case 'status': return CLIENT_STATUS_META[p.status].label
    case 'paid': return p.totals.paid
    case 'remaining': return p.totals.remaining
    case 'nextDue': return p.totals.nextDue?.dueDate ?? '9999'
    case 'overdue': return p.totals.overdueDays
    case 'purchaseAt': return p.purchaseAt ?? ''
    case 'lastActivity': return p.lastActivityAt ?? ''
  }
}

/** Текстовое представление — для выгрузки в Excel и подсказок. */
export function clientCellText(p: ClientProfile, key: ClientColumnKey): string | number {
  switch (key) {
    case 'client': return p.client.name
    case 'phone': return fmtPhone(p.client.phone)
    case 'project': return p.project?.name ?? '—'
    case 'units': return p.totals.unitsCount
    case 'manager': return p.manager?.name ?? '—'
    case 'contract': return p.contracts.map((c) => c.number).join(', ') || '—'
    case 'status': return CLIENT_STATUS_META[p.status].label
    case 'paid': return p.totals.paid
    case 'remaining': return p.totals.remaining
    case 'nextDue': return p.totals.nextDue ? `${fmtDate(p.totals.nextDue.dueDate)} · ${money(p.totals.nextDue.remaining)}` : '—'
    case 'overdue': return p.totals.overdueDays || 0
    case 'purchaseAt': return p.purchaseAt ? fmtDate(p.purchaseAt) : '—'
    case 'lastActivity': return p.lastActivityAt ? `${fmtDate(p.lastActivityAt)} · ${p.lastActivityLabel}` : '—'
  }
}

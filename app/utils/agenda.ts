import type { Contract, Lead, Reservation, ScheduleItem, Unit } from '~/types/models'
import { LEAD_TASK_KIND_META } from '~/utils/meta'
import { money } from '~/utils/format'

/**
 * Повестка: всё, что привязано ко времени, одним списком — задачи и показы из
 * заявок, платежи по графику, подписанные договоры и истекающие брони.
 *
 * Один сборщик на дашборд и на календарь: «сегодня» — это день из той же
 * ленты, а не отдельный запрос, иначе два экрана начнут расходиться.
 */
export type AgendaKind = 'call' | 'meeting' | 'visit' | 'document' | 'task' | 'payment' | 'contract' | 'reservation'

export interface AgendaItem {
  id: string
  /** момент события; для задач — срок, для платежей — дата по графику */
  at: string
  kind: AgendaKind
  title: string
  subtitle?: string
  icon: string
  tone: 'ok' | 'warn' | 'bad' | 'info' | 'neutral'
  /** ответственный — по нему лента режется под менеджера */
  assignedTo?: string
  amount?: number
  done?: boolean
  overdue?: boolean
  to?: string
  /** ссылки на сущности: по ним открываются быстрые действия */
  leadId?: string
  taskId?: string
  contractId?: string
  unitId?: string
  reservationId?: string
}

export const AGENDA_KIND_META: Record<AgendaKind, { label: string; icon: string; color: string }> = {
  call: { label: 'Звонки', icon: 'ph:phone', color: 'var(--mod-sales)' },
  meeting: { label: 'Встречи', icon: 'ph:users-three', color: 'var(--mod-sales)' },
  visit: { label: 'Показы', icon: 'ph:buildings', color: 'var(--mod-objects)' },
  document: { label: 'Документы', icon: 'ph:file-text', color: 'var(--mod-docs)' },
  task: { label: 'Задачи', icon: 'ph:check-square', color: 'var(--mod-system)' },
  payment: { label: 'Платежи', icon: 'ph:hand-coins', color: 'var(--mod-finance)' },
  contract: { label: 'Договоры', icon: 'ph:file-text', color: 'var(--mod-docs)' },
  reservation: { label: 'Брони', icon: 'ph:bookmark-simple', color: 'var(--mod-reserve)' },
}

export interface AgendaSource {
  leads: Lead[]
  contracts: Contract[]
  schedule: ScheduleItem[]
  reservations: Reservation[]
  clientName: (id: string) => string
  unitOf: (id: string) => Unit | undefined
  contractOf: (id: string) => Contract | undefined
  /** чей это договор — по нему лента режется под менеджера */
  ownerOfContract: (c: Contract) => string | undefined
}

export function dayKey(iso: string | Date) {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Неделя с понедельника: рабочая неделя менеджера начинается не с воскресенья. */
export function startOfWeek(d: Date) {
  const s = startOfDay(d)
  const shift = (s.getDay() + 6) % 7
  s.setDate(s.getDate() - shift)
  return s
}

export function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/**
 * Собрать повестку за период `[from, to)`. `now` нужен отдельно: просрочка
 * считается относительно текущего момента, а не границ периода.
 */
export function buildAgenda(src: AgendaSource, from: Date, to: Date, now = new Date()): AgendaItem[] {
  const items: AgendaItem[] = []
  const inRange = (iso?: string) => {
    if (!iso) return false
    const t = new Date(iso).getTime()
    return t >= from.getTime() && t < to.getTime()
  }

  for (const lead of src.leads) {
    const who = src.clientName(lead.clientId)
    for (const task of lead.tasks) {
      if (!inRange(task.dueAt)) continue
      const kind: AgendaKind = task.kind === 'other' ? 'task' : task.kind
      const overdue = !task.done && new Date(task.dueAt) < now
      items.push({
        id: `task-${task.id}`,
        at: task.dueAt,
        kind,
        title: task.title,
        subtitle: `${who} · ${LEAD_TASK_KIND_META[task.kind].label}`,
        icon: LEAD_TASK_KIND_META[task.kind].icon,
        tone: task.done ? 'ok' : overdue ? 'bad' : kind === 'visit' ? 'info' : 'neutral',
        assignedTo: task.assignedTo || lead.assignedTo,
        done: task.done,
        overdue,
        to: `/leads?lead=${lead.id}`,
        leadId: lead.id,
        taskId: task.id,
      })
    }
  }

  for (const item of src.schedule) {
    if (!inRange(item.dueDate)) continue
    const remaining = item.amount - item.paid
    const contract = src.contractOf(item.contractId)
    // в ContractStatus нет 'cancelled' — расторгнутый договор это 'terminated'.
    // С прежним сравнением проверка не срабатывала никогда, и в повестку дня
    // попадали платежи по расторгнутым договорам.
    if (!contract || contract.status === 'terminated') continue
    const overdue = remaining > 0 && new Date(item.dueDate) < now
    items.push({
      id: `sch-${item.id}`,
      at: item.dueDate,
      kind: 'payment',
      title: remaining > 0 ? `Платёж ${money(remaining, contract.currency)}` : 'Платёж закрыт',
      subtitle: `${src.clientName(contract.clientId)} · ${contract.number}`,
      icon: 'ph:hand-coins',
      tone: remaining <= 0 ? 'ok' : overdue ? 'bad' : 'warn',
      assignedTo: src.ownerOfContract(contract),
      amount: remaining,
      done: remaining <= 0,
      overdue,
      to: `/contracts/${contract.id}`,
      contractId: contract.id,
    })
  }

  for (const contract of src.contracts) {
    if (!inRange(contract.signedAt)) continue
    items.push({
      id: `ct-${contract.id}`,
      at: contract.signedAt!,
      kind: 'contract',
      title: `Договор ${contract.number}`,
      subtitle: `${src.clientName(contract.clientId)} · ${money(contract.price, contract.currency)}`,
      icon: 'ph:file-text',
      tone: 'ok',
      assignedTo: src.ownerOfContract(contract),
      amount: contract.price,
      done: true,
      to: `/contracts/${contract.id}`,
      contractId: contract.id,
    })
  }

  for (const r of src.reservations) {
    if (r.status !== 'active' || !inRange(r.expiresAt)) continue
    const unit = src.unitOf(r.unitId)
    items.push({
      id: `res-${r.id}`,
      at: r.expiresAt,
      kind: 'reservation',
      title: `Истекает бронь${unit ? ` № ${unit.number}` : ''}`,
      subtitle: src.clientName(r.clientId),
      icon: 'ph:hourglass-medium',
      tone: new Date(r.expiresAt) < now ? 'bad' : 'warn',
      assignedTo: r.createdBy,
      overdue: new Date(r.expiresAt) < now,
      to: unit ? `/board?building=${unit.buildingId}` : '/board',
      leadId: r.leadId,
      unitId: r.unitId,
      reservationId: r.id,
    })
  }

  return items.sort((a, b) => a.at.localeCompare(b.at))
}

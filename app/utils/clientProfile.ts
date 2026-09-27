import type {
  AppUser, Client, ClientDocument, Contract, Lead, Payment, Project, Reservation, ScheduleItem, Unit,
} from '~/types/models'
import { money, pluralRu } from '~/utils/format'

export type ClientStatus = 'paid' | 'installment' | 'active' | 'prospect'

export const CLIENT_STATUS_META: Record<ClientStatus, { label: string; tone: 'ok' | 'plum' | 'info' | 'neutral' }> = {
  paid: { label: 'Выплачен', tone: 'ok' },
  installment: { label: 'Рассрочка', tone: 'plum' },
  active: { label: 'Активен', tone: 'info' },
  prospect: { label: 'Без договора', tone: 'neutral' },
}

export interface ScheduleRowView {
  id: string
  contractId: string
  contractNumber: string
  dueDate: string
  plan: number
  fact: number
  remaining: number
  state: 'paid' | 'today' | 'overdue' | 'future'
}

export interface ClientProfile {
  client: Client
  /** статус клиента выводится из его договоров, а не хранится отдельно */
  status: ClientStatus
  contracts: Contract[]
  units: Unit[]
  payments: Payment[]
  schedule: ScheduleRowView[]
  reservations: Reservation[]
  leads: Lead[]
  documents: ClientDocument[]
  manager?: AppUser
  /** основной ЖК — тот, где куплено больше всего */
  project?: Project
  projects: Project[]
  firstLeadAt?: string
  purchaseAt?: string
  lastActivityAt?: string
  lastActivityLabel: string
  totals: {
    purchases: number
    paid: number
    remaining: number
    paidPct: number
    overdueAmount: number
    overdueDays: number
    /** сколько раз за всё время платёж уходил в просрочку */
    overdueCount: number
    unitsCount: number
    area: number
    discount: number
    avgCheck: number
    nextDue?: ScheduleRowView
  }
}

export interface ProfileSources {
  contracts: Contract[]
  scheduleItems: ScheduleItem[]
  payments: Payment[]
  units: Unit[]
  projects: Project[]
  leads: Lead[]
  reservations: Reservation[]
  documents: ClientDocument[]
  users: AppUser[]
  now: Date
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/**
 * Досье клиента. Собирается из существующих сущностей — заявок, броней,
 * договоров, графиков, платежей, документов и фонда. Ничего не дублируем:
 * отдельного «агрегата клиента» в данных нет и быть не должно, иначе он
 * немедленно разойдётся с договорами.
 */
export function buildClientProfile(client: Client, src: ProfileSources): ClientProfile {
  const contracts = src.contracts
    .filter((c) => c.clientId === client.id)
    .sort((a, b) => (b.signedAt ?? b.createdAt).localeCompare(a.signedAt ?? a.createdAt))
  const contractIds = new Set(contracts.map((c) => c.id))

  const unitIds = new Set(contracts.flatMap((c) => c.unitIds))
  const units = src.units.filter((u) => unitIds.has(u.id))
  const payments = src.payments
    .filter((p) => contractIds.has(p.contractId))
    .sort((a, b) => b.date.localeCompare(a.date))
  const leads = src.leads
    .filter((l) => l.clientId === client.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const reservations = src.reservations
    .filter((r) => r.clientId === client.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const documents = src.documents
    .filter((d) => d.clientId === client.id)
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))

  /* --------------------------------- график -------------------------------- */

  const today = startOfDay(src.now)
  const numberOf = new Map(contracts.map((c) => [c.id, c.number]))
  const schedule: ScheduleRowView[] = src.scheduleItems
    .filter((i) => contractIds.has(i.contractId))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map((i) => {
      const due = startOfDay(new Date(i.dueDate))
      const state: ScheduleRowView['state'] = i.paid >= i.amount
        ? 'paid'
        : due < today ? 'overdue' : due === today ? 'today' : 'future'
      return {
        id: i.id,
        contractId: i.contractId,
        contractNumber: numberOf.get(i.contractId) ?? '—',
        dueDate: i.dueDate,
        plan: i.amount,
        fact: i.paid,
        remaining: Math.max(0, i.amount - i.paid),
        state,
      }
    })

  const purchases = contracts.reduce((s, c) => s + c.price, 0)
  const paid = schedule.reduce((s, r) => s + r.fact, 0)
  const overdueRows = schedule.filter((r) => r.state === 'overdue')
  const overdueAmount = overdueRows.reduce((s, r) => s + r.remaining, 0)
  const overdueDays = overdueRows.length
    ? Math.max(...overdueRows.map((r) => Math.round((today - startOfDay(new Date(r.dueDate))) / 86400000)))
    : 0
  const nextDue = schedule.find((r) => r.state !== 'paid')

  // «просрочек за всё время» считаем по платежам, пришедшим после срока:
  // текущее состояние графика этого не хранит
  const overdueCount = overdueRows.length + schedule.filter((r) => {
    if (r.state !== 'paid') return false
    const pay = payments.find((p) => p.contractId === r.contractId && p.status === 'confirmed'
      && startOfDay(new Date(p.date)) > startOfDay(new Date(r.dueDate)))
    return Boolean(pay)
  }).length

  const discount = contracts.reduce((s, c) => {
    if (!c.discount) return s
    const base = Math.round(c.price / (1 - c.discount / 100))
    return s + (base - c.price)
  }, 0)

  /* ------------------------------ связи и даты ----------------------------- */

  const projectCount = new Map<string, number>()
  for (const u of units) projectCount.set(u.projectId, (projectCount.get(u.projectId) ?? 0) + 1)
  const mainProjectId = [...projectCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  const projects = [...projectCount.keys()]
    .map((id) => src.projects.find((p) => p.id === id))
    .filter((p): p is Project => !!p)

  // менеджер сделки записан в договоре; заявка и бронь — запасные источники
  // для тех, кто ещё ничего не купил
  const managerId = contracts.find((c) => c.managerId)?.managerId
    ?? leads.find((l) => contracts.some((c) => c.leadId === l.id))?.assignedTo
    ?? leads[leads.length - 1]?.assignedTo
    ?? reservations[0]?.createdBy
  const manager = src.users.find((u) => u.id === managerId)

  const firstLeadAt = leads[0]?.createdAt
  const purchaseAt = contracts.length
    ? contracts.map((c) => c.signedAt ?? c.createdAt).sort()[0]
    : undefined

  /* ---------------------------- последняя активность ----------------------- */

  const activities: { at: string; label: string }[] = []
  const lastPayment = payments[0]
  if (lastPayment) activities.push({ at: lastPayment.date, label: `платёж ${money(lastPayment.amount, lastPayment.currency)}` })
  for (const lead of leads) {
    const comm = [...lead.comms].sort((a, b) => b.at.localeCompare(a.at))[0]
    if (comm) activities.push({ at: comm.at, label: comm.kind === 'whatsapp' ? 'WhatsApp' : 'звонок' })
    const task = [...lead.tasks].filter((t) => t.done && t.doneAt).sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''))[0]
    if (task?.doneAt) activities.push({ at: task.doneAt, label: task.title.toLowerCase() })
  }
  const lastDoc = documents[0]
  if (lastDoc) activities.push({ at: lastDoc.uploadedAt, label: 'документ' })
  const lastContract = contracts[0]
  if (lastContract) activities.push({ at: lastContract.signedAt ?? lastContract.createdAt, label: `договор ${lastContract.number}` })
  activities.sort((a, b) => b.at.localeCompare(a.at))

  /* --------------------------------- статус -------------------------------- */

  const status: ClientStatus = !contracts.length
    ? 'prospect'
    : contracts.every((c) => c.status === 'paid')
      ? 'paid'
      : units.some((u) => u.status === 'installment') || contracts.some((c) => c.status === 'active')
        ? (units.some((u) => u.status === 'installment') ? 'installment' : 'active')
        : 'active'

  return {
    client,
    status,
    contracts,
    units,
    payments,
    schedule,
    reservations,
    leads,
    documents,
    manager,
    project: mainProjectId ? src.projects.find((p) => p.id === mainProjectId) : undefined,
    projects,
    firstLeadAt,
    purchaseAt,
    lastActivityAt: activities[0]?.at,
    lastActivityLabel: activities[0]?.label ?? '—',
    totals: {
      purchases,
      paid,
      remaining: Math.max(0, purchases - paid),
      paidPct: purchases ? Math.round((paid / purchases) * 100) : 0,
      overdueAmount,
      overdueDays,
      overdueCount,
      unitsCount: units.length,
      area: Math.round(units.reduce((s, u) => s + u.area, 0) * 10) / 10,
      discount,
      avgCheck: contracts.length ? Math.round(purchases / contracts.length) : 0,
      nextDue,
    },
  }
}

/**
 * Резюме клиента одной строкой. Те же правила, что и в заявке: менеджер должен
 * понимать контекст до того, как начнёт листать вкладки.
 */
export function buildClientSummary(profile: ClientProfile): string {
  const { totals, units, project, contracts, status } = profile
  if (!contracts.length) {
    return profile.leads.length
      ? 'Договора пока нет — клиент в работе по заявке.'
      : 'Ни заявок, ни договоров — карточка создана вручную.'
  }

  const apartments = units.filter((u) => u.kind === 'apartment').length
  const extras = units.length - apartments
  const parts: string[] = []
  parts.push(`Купил ${apartments ? `${apartments} ${pluralRu(apartments, 'квартиру', 'квартиры', 'квартир')}` : `${units.length} ${pluralRu(units.length, 'объект', 'объекта', 'объектов')}`}`
    + (extras && apartments ? ` и ещё ${extras} ${pluralRu(extras, 'объект', 'объекта', 'объектов')}` : '')
    + (project ? ` в ${project.name}` : ''))

  if (status === 'paid') {
    parts.push('оплачено полностью')
  } else {
    const last = profile.schedule[profile.schedule.length - 1]
    if (last) {
      const d = new Date(last.dueDate)
      parts.push(`рассрочка до ${d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}`)
    }
    parts.push(totals.overdueAmount
      ? `просрочка ${money(totals.overdueAmount)} · ${totals.overdueDays} дн.`
      : 'просрочек нет')
    if (totals.nextDue) {
      const d = new Date(totals.nextDue.dueDate)
      parts.push(`следующий платёж ${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} — ${money(totals.nextDue.remaining)}`)
    }
  }

  // части соединяем запятыми: с точками получалось «…Аврора». оплачено…»
  return `${parts.join(', ').replace(/,\s*,/g, ',')}.`
}

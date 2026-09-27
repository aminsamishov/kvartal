import type { Contract, Lead, Payment, Reservation, Unit } from '~/types/models'
import { COMM_KIND_META, LEAD_TASK_KIND_META } from '~/utils/meta'
import { money } from '~/utils/format'

export type TimelineGroup = 'comm' | 'stage' | 'task' | 'note' | 'money' | 'object'

export interface TimelineItem {
  id: string
  at: string
  group: TimelineGroup
  icon: string
  title: string
  detail?: string
  author?: string
  tone?: 'ok' | 'warn' | 'bad' | 'plum' | 'neutral'
}

const EVENT_MAP: Record<string, { group: TimelineGroup; icon: string; tone?: TimelineItem['tone'] }> = {
  created: { group: 'stage', icon: 'ph:sparkle', tone: 'plum' },
  stage: { group: 'stage', icon: 'ph:arrow-right' },
  assign: { group: 'stage', icon: 'ph:user-switch' },
  field: { group: 'stage', icon: 'ph:pencil-simple' },
  note: { group: 'note', icon: 'ph:note' },
  task: { group: 'task', icon: 'ph:check-square' },
  task_done: { group: 'task', icon: 'ph:check-circle', tone: 'ok' },
  lost: { group: 'stage', icon: 'ph:prohibit', tone: 'bad' },
  won: { group: 'stage', icon: 'ph:trophy', tone: 'ok' },
  call: { group: 'comm', icon: 'ph:phone' },
}

/**
 * Единая лента заявки. Собирает всё, что произошло с клиентом, в один поток —
 * иначе менеджер перед звонком открывает четыре раздела, чтобы вспомнить
 * контекст.
 */
export function buildLeadTimeline(input: {
  lead: Lead
  reservations: Reservation[]
  contracts: Contract[]
  payments: Payment[]
  unitOf: (id: string) => Unit | undefined
}): TimelineItem[] {
  const { lead, reservations, contracts, payments, unitOf } = input
  const items: TimelineItem[] = []

  for (const e of lead.history) {
    const meta = EVENT_MAP[e.kind] ?? { group: 'stage' as const, icon: 'ph:dot' }
    items.push({ id: e.id, at: e.at, group: meta.group, icon: meta.icon, title: e.text, author: e.author, tone: meta.tone })
  }

  for (const c of lead.comms) {
    const meta = COMM_KIND_META[c.kind]
    const mins = c.durationSec ? `${Math.floor(c.durationSec / 60)}:${String(c.durationSec % 60).padStart(2, '0')}` : null
    items.push({
      id: c.id, at: c.at, group: 'comm', icon: meta.icon,
      title: meta.label + (mins ? ` · ${mins}` : ''),
      detail: c.note, author: c.author,
      tone: c.outcome === 'no_answer' ? 'bad' : c.outcome === 'callback' ? 'warn' : 'ok',
    })
  }

  for (const n of lead.notes) {
    items.push({ id: n.id, at: n.at, group: 'note', icon: 'ph:chat-text', title: n.text, author: n.author })
  }

  for (const t of lead.tasks.filter((x) => x.done && x.doneAt)) {
    items.push({
      id: `${t.id}-done`, at: t.doneAt!, group: 'task', icon: LEAD_TASK_KIND_META[t.kind].icon,
      title: `Выполнено: ${t.title}`, detail: t.result, tone: 'ok',
    })
  }

  for (const r of reservations) {
    const u = unitOf(r.unitId)
    items.push({
      id: r.id, at: r.createdAt, group: 'object', icon: 'ph:bookmark-simple',
      title: `Бронь ${u ? `№ ${u.number}` : ''}`.trim(),
      // задаток ведётся в сомах, в отличие от цен объектов
      detail: r.deposit ? `задаток ${money(r.deposit, 'KGS')}` : 'без задатка',
      tone: r.status === 'cancelled' || r.status === 'expired' ? 'bad' : 'warn',
    })
  }

  for (const c of contracts) {
    items.push({
      id: c.id, at: c.createdAt, group: 'money', icon: 'ph:file-text',
      title: `Договор ${c.number}`, detail: money(c.price, c.currency), tone: 'ok',
    })
  }

  for (const p of payments) {
    items.push({
      id: p.id, at: p.date, group: 'money', icon: 'ph:hand-coins',
      title: p.status === 'confirmed' ? 'Платёж принят' : p.status === 'pending' ? 'Платёж на подтверждении' : 'Платёж отклонён',
      detail: money(p.amount, p.currency),
      tone: p.status === 'confirmed' ? 'ok' : p.status === 'pending' ? 'warn' : 'bad',
    })
  }

  return items.sort((a, b) => b.at.localeCompare(a.at))
}

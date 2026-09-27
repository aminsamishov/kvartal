import type { Contract, Lead, Payment, Reservation, ScheduleItem } from '~/types/models'

export type DealStepKey = 'lead' | 'contact' | 'visit' | 'reserve' | 'contract' | 'first_payment' | 'sold'

export interface DealStep {
  key: DealStepKey
  label: string
  icon: string
  done: boolean
  /** когда шаг был пройден — показываем датой под галочкой */
  at?: string
  /** ближайший непройденный шаг — на нём фокус менеджера */
  current: boolean
  /** что сделать, чтобы пройти шаг */
  hint: string
}

/**
 * Чек-лист сделки. В отличие от воронки этапов, которую менеджер двигает
 * руками, чек-лист считается по фактам: есть звонок — есть контакт, есть
 * подтверждённый платёж — есть первый платёж. Поэтому он и показывает
 * реальное состояние сделки, а не то, куда перетащили карточку.
 */
export function buildDealChecklist(input: {
  lead: Lead
  reservations: Reservation[]
  contracts: Contract[]
  payments: Payment[]
  schedule: ScheduleItem[]
}): { steps: DealStep[]; percent: number; nextStep?: DealStep } {
  const { lead, reservations, contracts, payments, schedule } = input

  const firstComm = [...lead.comms].sort((a, b) => a.at.localeCompare(b.at))[0]
  const doneVisit = lead.tasks
    .filter((t) => t.kind === 'visit' && t.done && t.doneAt)
    .sort((a, b) => (a.doneAt ?? '').localeCompare(b.doneAt ?? ''))[0]
  const firstReservation = [...reservations].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]
  const contract = [...contracts].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]
  const firstPaid = payments
    .filter((p) => p.status === 'confirmed')
    .sort((a, b) => a.date.localeCompare(b.date))[0]

  const contractPaid = Boolean(contract && schedule.length
    && schedule.every((i) => i.paid >= i.amount))

  const raw: Omit<DealStep, 'current'>[] = [
    {
      key: 'lead', label: 'Лид', icon: 'ph:sparkle', done: true, at: lead.createdAt,
      hint: 'Заявка заведена',
    },
    {
      key: 'contact', label: 'Контакт', icon: 'ph:phone-call',
      done: Boolean(firstComm) || ['contacted', 'visit', 'reserved', 'deal'].includes(lead.stage),
      at: firstComm?.at,
      hint: 'Позвоните и зафиксируйте результат',
    },
    {
      key: 'visit', label: 'Показ', icon: 'ph:buildings',
      done: Boolean(doneVisit) || ['visit', 'reserved', 'deal'].includes(lead.stage),
      at: doneVisit?.doneAt,
      hint: 'Назначьте показ объекта',
    },
    {
      key: 'reserve', label: 'Бронь', icon: 'ph:bookmark-simple',
      done: Boolean(firstReservation), at: firstReservation?.createdAt,
      hint: 'Забронируйте квартиру из подбора',
    },
    {
      key: 'contract', label: 'Договор', icon: 'ph:file-text',
      done: Boolean(contract), at: contract?.createdAt,
      hint: 'Оформите договор из брони',
    },
    {
      key: 'first_payment', label: 'Первый платёж', icon: 'ph:hand-coins',
      done: Boolean(firstPaid), at: firstPaid?.date,
      hint: 'Проведите и подтвердите первый взнос',
    },
    {
      key: 'sold', label: 'Продано', icon: 'ph:trophy',
      done: contractPaid, at: contractPaid ? contract?.signedAt : undefined,
      hint: 'График закрыт полностью',
    },
  ]

  const firstOpen = raw.findIndex((s) => !s.done)
  const steps: DealStep[] = raw.map((s, i) => ({ ...s, current: i === firstOpen }))
  const doneCount = steps.filter((s) => s.done).length

  return {
    steps,
    percent: Math.round((doneCount / steps.length) * 100),
    nextStep: steps.find((s) => s.current),
  }
}

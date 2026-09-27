import type { Contract, Lead, Project, Reservation, Unit } from '~/types/models'
import { PAYMENT_PLAN_META } from '~/utils/meta'
import { money, pluralRu } from '~/utils/format'
import type { DealStep } from '~/utils/leadChecklist'

export type WinChance = 'high' | 'medium' | 'low'

export interface LeadSummary {
  /** одна строка, которую менеджер читает перед звонком */
  text: string
  /** факторы оценки — раскрываются под резюме */
  signals: { label: string; tone: 'ok' | 'warn' | 'bad' | 'neutral'; icon: string }[]
  chance: WinChance
  chanceScore: number
  nextStep: string
}

const CHANCE_META: Record<WinChance, string> = {
  high: 'высокий шанс покупки',
  medium: 'средний шанс покупки',
  low: 'низкий шанс — клиент остывает',
}

export const WIN_CHANCE_META: Record<WinChance, { label: string; tone: 'ok' | 'warn' | 'bad' }> = {
  high: { label: 'Высокий шанс', tone: 'ok' },
  medium: { label: 'Средний шанс', tone: 'warn' },
  low: { label: 'Низкий шанс', tone: 'bad' },
}

function roomsText(min?: number, max?: number) {
  if (min === undefined && max === undefined) return null
  if (min !== undefined && max !== undefined && min !== max) return `${min}–${max}-комнатную`
  const n = min ?? max!
  return `${n}-комнатную`
}

/**
 * Краткое резюме клиента. Собирается из тех же данных, что видит менеджер, —
 * запроса, активности и стадии сделки. Никакой магии: это правила, но они
 * экономят минуту на каждый звонок, потому что не нужно читать всю ленту.
 */
export function buildLeadSummary(input: {
  lead: Lead
  reservation?: Reservation
  contract?: Contract
  unit?: Unit
  project?: Project
  daysInStage: number
  taskState: 'overdue' | 'today' | 'planned' | 'none'
  nextStep?: DealStep
  overdueAmount?: number
}): LeadSummary {
  const { lead, reservation, contract, unit, project, daysInStage, taskState, nextStep, overdueAmount } = input
  const i = lead.interest
  const signals: LeadSummary['signals'] = []

  /* ------------------------------ что ищет ------------------------------- */

  const wants: string[] = []
  const rooms = roomsText(i.roomsMin, i.roomsMax)
  if (rooms) wants.push(`Ищет ${rooms}`)
  else wants.push('Ищет квартиру')

  if (i.budgetMax) wants.push(`до ${money(i.budgetMax)}`)
  else if (lead.budget) wants.push(`бюджет около ${money(lead.budget)}`)

  if (project) wants.push(`в «${project.name}»`)
  if (i.floorMin || i.floorMax) {
    wants.push(i.floorMin && i.floorMax
      ? `этаж ${i.floorMin}–${i.floorMax}`
      : i.floorMin ? `этаж от ${i.floorMin}` : `этаж до ${i.floorMax}`)
  }
  if (i.paymentMethod) wants.push(PAYMENT_PLAN_META[i.paymentMethod].label.toLowerCase())

  /* ------------------------------- оценка -------------------------------- */

  let score = 35
  const stageWeight: Record<Lead['stage'], number> = {
    new: 0, contacted: 8, visit: 18, reserved: 30, deal: 45, lost: -50,
  }
  score += stageWeight[lead.stage]

  if (contract) { score += 15; signals.push({ label: 'Договор оформлен', tone: 'ok', icon: 'ph:file-text' }) }
  if (reservation) { score += 12; signals.push({ label: 'Активная бронь', tone: 'ok', icon: 'ph:bookmark-simple' }) }
  if (reservation?.deposit) { score += 8; signals.push({ label: `Внесён задаток ${money(reservation.deposit, 'KGS')}`, tone: 'ok', icon: 'ph:coins' }) }

  const answered = lead.comms.filter((c) => c.outcome === 'answered').length
  const noAnswer = lead.comms.filter((c) => c.outcome === 'no_answer').length
  if (answered >= 2) { score += 10; signals.push({ label: `На связи: ${answered} ${pluralRu(answered, 'разговор', 'разговора', 'разговоров')}`, tone: 'ok', icon: 'ph:phone-call' }) }
  if (noAnswer >= 2 && answered === 0) { score -= 15; signals.push({ label: `Не берёт трубку: ${noAnswer} попытки`, tone: 'bad', icon: 'ph:phone-x' }) }

  if (lead.interestedUnitIds.length) { score += 6; signals.push({ label: `Смотрит ${lead.interestedUnitIds.length} ${pluralRu(lead.interestedUnitIds.length, 'квартиру', 'квартиры', 'квартир')}`, tone: 'ok', icon: 'ph:eye' }) }
  if (lead.priority === 'high') { score += 6; signals.push({ label: 'Высокий приоритет', tone: 'warn', icon: 'ph:flame' }) }

  if (taskState === 'overdue') { score -= 12; signals.push({ label: 'Задача просрочена', tone: 'bad', icon: 'ph:warning-circle' }) }
  if (taskState === 'none' && lead.stage !== 'deal' && lead.stage !== 'lost') {
    score -= 10
    signals.push({ label: 'Нет следующего шага', tone: 'bad', icon: 'ph:question' })
  }
  if (daysInStage > 14 && lead.stage !== 'deal' && lead.stage !== 'lost') {
    score -= 10
    signals.push({ label: `Висит на этапе ${daysInStage} дн.`, tone: 'warn', icon: 'ph:hourglass' })
  }
  if (overdueAmount) { score -= 8; signals.push({ label: `Просрочка по графику ${money(overdueAmount)}`, tone: 'bad', icon: 'ph:hand-coins' }) }
  if (lead.stage === 'lost') signals.push({ label: `Отказ: ${lead.lostReason ?? 'без причины'}`, tone: 'bad', icon: 'ph:prohibit' })

  const chanceScore = Math.max(0, Math.min(100, score))
  const chance: WinChance = lead.stage === 'lost' ? 'low' : chanceScore >= 65 ? 'high' : chanceScore >= 40 ? 'medium' : 'low'

  /* ---------------------------- следующий шаг ----------------------------- */

  const openTask = [...lead.tasks].filter((t) => !t.done).sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0]
  const step = lead.stage === 'lost'
    ? 'вернуть в работу или закрыть'
    : openTask
      ? openTask.title.toLowerCase()
      : nextStep
        ? nextStep.hint.toLowerCase()
        : 'поставить следующий шаг'

  const tail: string[] = []
  if (i.comment) tail.push(i.comment.replace(/\.$/, ''))
  if (unit) tail.push(`в работе № ${unit.number}`)
  tail.push(CHANCE_META[chance])

  const text = `${wants.join(' ')}. ${tail.join(', ')}. Следующий шаг — ${step}.`
    .replace(/\s+/g, ' ')
    .replace(' .', '.')

  return { text, signals, chance, chanceScore, nextStep: step }
}

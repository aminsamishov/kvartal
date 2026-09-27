import type { ClientDocument, Contract, DiscountRequest, Lead, LeadTask, Reservation, Unit } from '~/types/models'
import { money } from '~/utils/format'

export type LeadActionKind =
  | 'call' | 'whatsapp' | 'task' | 'complete_task' | 'picker'
  | 'reserve' | 'extend' | 'contract' | 'docs' | 'approvals' | 'payment' | 'lost'

export interface LeadAction {
  key: string
  kind: LeadActionKind
  title: string
  /** почему система это предлагает — менеджер должен понимать, а не угадывать */
  reason: string
  icon: string
  tone: 'bad' | 'warn' | 'ok' | 'plum' | 'neutral'
  /** чем выше, тем раньше в списке */
  weight: number
  /** объект, к которому относится действие */
  unitId?: string
}

/**
 * Рекомендации следующего шага.
 *
 * Это не «AI ради AI»: правила собраны из того, на чём реально рассыпаются
 * сделки — просроченная задача, заявка без следующего шага, бронь на исходе,
 * договор без первого платежа. Каждая карточка сразу выполняет действие,
 * иначе совет остаётся советом.
 */
export function buildLeadActions(input: {
  lead: Lead
  taskState: 'overdue' | 'today' | 'planned' | 'none'
  openTask?: LeadTask
  daysInStage: number
  reservation?: Reservation
  contract?: Contract
  overdueAmount: number
  paidAnything: boolean
  documents: ClientDocument[]
  topMatch?: { unit: Unit; score: number }
  pendingDiscount?: DiscountRequest
  linkedUnits: number
}): LeadAction[] {
  const {
    lead, taskState, openTask, daysInStage, reservation, contract, overdueAmount,
    paidAnything, documents, topMatch, pendingDiscount, linkedUnits,
  } = input

  const out: LeadAction[] = []
  if (lead.stage === 'lost') {
    out.push({
      key: 'revive', kind: 'call', title: 'Позвонить и уточнить причину',
      reason: `Отказ: ${lead.lostReason ?? 'без причины'} — часть таких клиентов возвращается`,
      icon: 'ph:phone-call', tone: 'neutral', weight: 10,
    })
    return out
  }

  /* ------------------------------ горит ---------------------------------- */

  if (taskState === 'overdue' && openTask) {
    out.push({
      key: 'overdue-task', kind: 'complete_task', title: `Закрыть просроченную задачу: ${openTask.title}`,
      reason: 'Срок прошёл — это первая причина, по которой клиенты уходят молча',
      icon: 'ph:warning-circle', tone: 'bad', weight: 100,
    })
  }

  if (reservation) {
    const daysLeft = Math.ceil((new Date(reservation.expiresAt).getTime() - Date.now()) / 86400000)
    if (daysLeft <= 2) {
      out.push({
        key: 'reserve-expiring', kind: 'extend', title: daysLeft <= 0 ? 'Бронь истекла — продлить' : `Бронь истекает через ${daysLeft} дн.`,
        reason: 'После истечения объект уходит в продажу или следующему в очереди',
        icon: 'ph:hourglass', tone: 'bad', weight: 95, unitId: reservation.unitId,
      })
    }
    if (!contract) {
      out.push({
        key: 'reserve-to-contract', kind: 'contract', title: 'Оформить договор по брони',
        reason: 'Бронь без договора — самый дорогой простой фонда',
        icon: 'ph:file-text', tone: 'plum', weight: 88, unitId: reservation.unitId,
      })
    }
  }

  if (overdueAmount) {
    out.push({
      key: 'overdue-money', kind: 'payment', title: `Напомнить о платеже ${money(overdueAmount)}`,
      reason: 'По графику договора есть просрочка',
      icon: 'ph:hand-coins', tone: 'bad', weight: 92,
    })
  }

  if (pendingDiscount) {
    out.push({
      key: 'approval', kind: 'approvals', title: `Скидка ${pendingDiscount.percent}% ждёт согласования`,
      reason: 'Пока решение не принято, договор печатать нельзя',
      icon: 'ph:percent', tone: 'warn', weight: 80,
    })
  }

  /* ----------------------------- движение -------------------------------- */

  if (taskState === 'none') {
    out.push({
      key: 'no-task', kind: 'task', title: 'Поставить следующий шаг',
      reason: 'У заявки нет открытой задачи — она выпадет из работы',
      icon: 'ph:plus-circle', tone: 'warn', weight: 78,
    })
  }

  if (!lead.comms.length && lead.stage === 'new') {
    out.push({
      key: 'first-call', kind: 'call', title: 'Первый звонок клиенту',
      reason: 'Контакта ещё не было — скорость ответа решает больше, чем цена',
      icon: 'ph:phone-outgoing', tone: 'plum', weight: 90,
    })
  }

  const noAnswer = lead.comms.filter((c) => c.outcome === 'no_answer').length
  const answered = lead.comms.filter((c) => c.outcome === 'answered').length
  if (noAnswer >= 2 && !answered) {
    out.push({
      key: 'whatsapp', kind: 'whatsapp', title: 'Написать в WhatsApp',
      reason: `Не отвечает на звонки ${noAnswer} раза — в переписке шансов больше`,
      icon: 'ph:whatsapp-logo', tone: 'warn', weight: 76,
    })
  }

  if (!linkedUnits && topMatch) {
    out.push({
      key: 'pick', kind: 'picker', title: `Показать № ${topMatch.unit.number} — совпадение ${topMatch.score}%`,
      reason: `${money(topMatch.unit.price)} · ${topMatch.unit.rooms || '—'} комн. · ${topMatch.unit.area} м² под запрос клиента`,
      icon: 'ph:target', tone: 'plum', weight: 74, unitId: topMatch.unit.id,
    })
  }

  const hadVisit = lead.tasks.some((t) => t.kind === 'visit')
  if (linkedUnits && !hadVisit && !reservation) {
    out.push({
      key: 'visit', kind: 'task', title: 'Назначить показ объекта',
      reason: 'Клиент смотрит варианты, но показ ещё не назначен',
      icon: 'ph:buildings', tone: 'plum', weight: 72,
    })
  }

  const visitDone = lead.tasks.some((t) => t.kind === 'visit' && t.done)
  if (visitDone && !reservation && topMatch) {
    out.push({
      key: 'reserve', kind: 'reserve', title: `Забронировать № ${topMatch.unit.number}`,
      reason: 'После показа бронь фиксирует выбор — иначе клиент уходит «подумать»',
      icon: 'ph:bookmark-simple', tone: 'ok', weight: 70, unitId: topMatch.unit.id,
    })
  }

  if ((reservation || contract) && !documents.some((d) => d.kind === 'passport')) {
    out.push({
      key: 'passport', kind: 'docs', title: 'Запросить паспорт клиента',
      reason: 'Без паспорта договор не оформить — лучше собрать заранее',
      icon: 'ph:identification-card', tone: 'warn', weight: 64,
    })
  }

  if (contract && !paidAnything) {
    out.push({
      key: 'first-payment', kind: 'payment', title: 'Проконтролировать первый взнос',
      reason: 'Договор подписан, но денег по нему ещё не было',
      icon: 'ph:coins', tone: 'warn', weight: 68,
    })
  }

  if (daysInStage > 14 && !reservation && !contract) {
    out.push({
      key: 'stale', kind: 'lost', title: 'Оживить или закрыть заявку',
      reason: `Висит на этапе ${daysInStage} дн. — держать её в работе дороже, чем закрыть`,
      icon: 'ph:hourglass-medium', tone: 'neutral', weight: 40,
    })
  }

  return out.sort((a, b) => b.weight - a.weight)
}

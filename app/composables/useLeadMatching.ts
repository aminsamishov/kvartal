import type { Lead, LeadInterest, Unit } from '~/types/models'
import { money } from '~/utils/format'

/** Один критерий совпадения — из них собирается процент и подсказка «почему». */
export interface MatchFactor {
  key: 'budget' | 'rooms' | 'floor' | 'area' | 'status'
  label: string
  ok: boolean
  /** сколько баллов снял этот критерий */
  penalty: number
  detail: string
}

export interface MatchedUnit {
  unit: Unit
  /** 0..100 — насколько подходит под интерес; сортируем по убыванию */
  score: number
  /** чем именно не подошло — показываем как причину в списке */
  misses: string[]
  factors: MatchFactor[]
}

function inRange(v: number, min?: number, max?: number) {
  if (min !== undefined && v < min) return false
  if (max !== undefined && v > max) return false
  return true
}

function rangeText(min?: number, max?: number, unit = '') {
  if (min !== undefined && max !== undefined) return min === max ? `${min}${unit}` : `${min}–${max}${unit}`
  if (min !== undefined) return `от ${min}${unit}`
  if (max !== undefined) return `до ${max}${unit}`
  return 'не важно'
}

/**
 * Подбор квартир под интерес клиента. Жёстко фильтруем только по доступности
 * и проекту — остальные критерии дают штраф, а не исключают: клиент, который
 * просил 2 комнаты, почти всегда посмотрит трёшку на 5% дороже, и прятать её
 * от менеджера вредно.
 */
export function matchUnits(units: Unit[], interest: LeadInterest, opts: { includeReserved?: boolean } = {}): MatchedUnit[] {
  const available = units.filter((u) => {
    if (u.kind !== 'apartment' && u.kind !== 'commercial') return false
    if (u.status === 'sold' || u.status === 'installment' || u.status === 'closed') return false
    if (u.status === 'reserved' && !opts.includeReserved) return false
    if (interest.projectIds.length && !interest.projectIds.includes(u.projectId)) return false
    if (interest.buildingIds.length && !interest.buildingIds.includes(u.buildingId)) return false
    return true
  })

  return available.map((unit) => scoreUnit(unit, interest)).sort((a, b) => b.score - a.score || a.unit.price - b.unit.price)
}

/**
 * Оценка одной квартиры. Вынесена отдельно, потому что процент совпадения
 * показывается не только в списке подбора, но и на ячейке шахматки, на фасаде
 * и в сравнении — там квартира приходит из фонда, а не из результата подбора.
 */
export function scoreUnit(unit: Unit, interest: LeadInterest): MatchedUnit {
  const misses: string[] = []
  const factors: MatchFactor[] = []
  let score = 100

  const roomsOk = inRange(unit.rooms, interest.roomsMin, interest.roomsMax)
  let roomsPenalty = 0
  if (!roomsOk) {
    const delta = Math.min(
      Math.abs(unit.rooms - (interest.roomsMin ?? unit.rooms)),
      Math.abs(unit.rooms - (interest.roomsMax ?? unit.rooms)),
    )
    roomsPenalty = 18 * Math.min(delta, 2)
    score -= roomsPenalty
    misses.push(`${unit.rooms} комн.`)
  }
  factors.push({
    key: 'rooms', label: 'Комнатность', ok: roomsOk, penalty: roomsPenalty,
    detail: `${unit.rooms || '—'} комн. · запрос ${rangeText(interest.roomsMin, interest.roomsMax)}`,
  })

  const areaOk = inRange(unit.area, interest.areaMin, interest.areaMax)
  let areaPenalty = 0
  if (!areaOk) {
    areaPenalty = 12
    score -= areaPenalty
    misses.push(`${unit.area} м²`)
  }
  factors.push({
    key: 'area', label: 'Площадь', ok: areaOk, penalty: areaPenalty,
    detail: `${unit.area} м² · запрос ${rangeText(interest.areaMin, interest.areaMax, ' м²')}`,
  })

  const floorOk = inRange(unit.floor, interest.floorMin, interest.floorMax)
  let floorPenalty = 0
  if (!floorOk) {
    floorPenalty = 14
    score -= floorPenalty
    misses.push(`этаж ${unit.floor}`)
  }
  factors.push({
    key: 'floor', label: 'Этаж', ok: floorOk, penalty: floorPenalty,
    detail: `${unit.floor} этаж · запрос ${rangeText(interest.floorMin, interest.floorMax)}`,
  })

  const budgetOk = inRange(unit.price, interest.budgetMin, interest.budgetMax)
  let budgetPenalty = 0
  if (!budgetOk) {
    const over = interest.budgetMax ? (unit.price - interest.budgetMax) / interest.budgetMax : 0
    // перебор бюджета штрафуем пропорционально: +3% это не то же самое, что +40%
    budgetPenalty = over > 0 ? Math.min(60, Math.round(over * 180)) : 15
    score -= budgetPenalty
    misses.push(over > 0 ? `+${Math.round(over * 100)}% к бюджету` : 'дешевле запроса')
  }
  factors.push({
    key: 'budget', label: 'Бюджет', ok: budgetOk, penalty: budgetPenalty,
    detail: `${money(unit.price)} · запрос ${interest.budgetMin || interest.budgetMax
      ? rangeText(interest.budgetMin, interest.budgetMax).replace(/(\d+)/g, (m) => Number(m).toLocaleString('ru-RU'))
      : 'не указан'}`,
  })

  const statusOk = unit.status === 'free'
  let statusPenalty = 0
  if (unit.status === 'reserved') {
    statusPenalty = 25
    score -= statusPenalty
  }
  factors.push({
    key: 'status', label: 'Доступность', ok: statusOk, penalty: statusPenalty,
    detail: statusOk ? 'свободна' : 'под бронью — можно встать в очередь',
  })

  return { unit, score: Math.max(0, score), misses, factors }
}

/** Интерес, выведенный из заявки, если поля ещё не заполнены руками. */
export function interestFromLead(lead: Lead): LeadInterest {
  const base = lead.interest
  if (base.budgetMax || base.roomsMin || base.projectIds.length) return base
  return { ...base, budgetMax: lead.budget || undefined }
}

/** Есть ли в запросе хоть один критерий — без него процент совпадения бессмыслен. */
export function hasInterestCriteria(interest: LeadInterest) {
  return Boolean(interest.budgetMin || interest.budgetMax || interest.roomsMin || interest.roomsMax
    || interest.areaMin || interest.areaMax || interest.floorMin || interest.floorMax)
}

/** Тон бейджа совпадения: 90+ — точное, 70+ — рабочее, ниже — компромисс. */
export function scoreTone(score: number): 'ok' | 'warn' | 'neutral' {
  if (score >= 90) return 'ok'
  if (score >= 70) return 'warn'
  return 'neutral'
}

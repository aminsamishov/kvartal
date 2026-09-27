import type { Lead, LeadInterest, Unit } from '~/types/models'

export interface MatchedUnit {
  unit: Unit
  /** 0..100 — насколько подходит под интерес; сортируем по убыванию */
  score: number
  /** чем именно не подошло — показываем как причину в списке */
  misses: string[]
}

function inRange(v: number, min?: number, max?: number) {
  if (min !== undefined && v < min) return false
  if (max !== undefined && v > max) return false
  return true
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

  return available.map((unit) => {
    const misses: string[] = []
    let score = 100

    if (!inRange(unit.rooms, interest.roomsMin, interest.roomsMax)) {
      const delta = Math.min(
        Math.abs(unit.rooms - (interest.roomsMin ?? unit.rooms)),
        Math.abs(unit.rooms - (interest.roomsMax ?? unit.rooms)),
      )
      score -= 18 * Math.min(delta, 2)
      misses.push(`${unit.rooms} комн.`)
    }
    if (!inRange(unit.area, interest.areaMin, interest.areaMax)) {
      score -= 12
      misses.push(`${unit.area} м²`)
    }
    if (!inRange(unit.floor, interest.floorMin, interest.floorMax)) {
      score -= 14
      misses.push(`этаж ${unit.floor}`)
    }
    if (!inRange(unit.price, interest.budgetMin, interest.budgetMax)) {
      const over = interest.budgetMax ? (unit.price - interest.budgetMax) / interest.budgetMax : 0
      // перебор бюджета штрафуем пропорционально: +3% это не то же самое, что +40%
      score -= over > 0 ? Math.min(60, Math.round(over * 180)) : 15
      misses.push(over > 0 ? `+${Math.round(over * 100)}% к бюджету` : 'дешевле запроса')
    }
    if (unit.status === 'reserved') score -= 25

    return { unit, score: Math.max(0, score), misses }
  }).sort((a, b) => b.score - a.score || a.unit.price - b.unit.price)
}

/** Интерес, выведенный из заявки, если поля ещё не заполнены руками. */
export function interestFromLead(lead: Lead): LeadInterest {
  const base = lead.interest
  if (base.budgetMax || base.roomsMin || base.projectIds.length) return base
  return { ...base, budgetMax: lead.budget || undefined }
}

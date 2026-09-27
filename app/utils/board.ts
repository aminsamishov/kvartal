import type { Promotion, Unit } from '~/types/models'
import type { PaymentBucket } from './meta'

// Компания редко таргетирует акцию на конкретный объект — в прототипе показываем
// бейдж первой активной публичной акции с широким охватом (тип/вид помещения)
// на свободных квартирах проекта, как это устроено у Profitbase и в исходном макете.
export function bestPromoForUnit(unit: Unit, promotions: Promotion[]): Promotion | null {
  if (unit.status !== 'free' || unit.kind !== 'apartment') return null
  const match = promotions.find((p) => p.active && p.public && p.projectIds.includes(unit.projectId) && (p.scope === 'unit_kind' || p.scope === 'unit_type'))
  if (!match) return null
  // акция не бывает буквально на всём — берём стабильную ~1 из 5 выборку по id объекта,
  // чтобы бейдж на шахматке выглядел как реальная адресная акция, а не заливка всей сетки
  let hash = 0
  for (let i = 0; i < unit.id.length; i++) hash = (hash * 31 + unit.id.charCodeAt(i)) >>> 0
  return hash % 5 === 0 ? match : null
}

export type PaymentHealth = 'ok' | 'warn' | 'bad'

export function healthFromBucket(bucket: PaymentBucket): PaymentHealth {
  if (bucket === 'ok' || bucket === 'soon') return 'ok'
  if (bucket === 'today' || bucket === 'd1_7') return 'warn'
  return 'bad'
}

export const PAYMENT_HEALTH_META: Record<PaymentHealth, { label: string; bg: string; border: string; text: string }> = {
  ok: { label: 'Платит вовремя', bg: 'bg-board-ok', border: 'border-board-ok', text: 'text-board-ok-ink' },
  warn: { label: 'Платёж скоро', bg: 'bg-board-warn', border: 'border-board-warn', text: 'text-board-warn-ink' },
  bad: { label: 'Просрочка', bg: 'bg-board-bad', border: 'border-board-bad', text: 'text-board-bad-ink' },
}

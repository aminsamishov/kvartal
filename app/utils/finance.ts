import type { PaymentPlanKind } from '~/types/models'

/**
 * Расчёт условий сделки. Вынесен со страницы «Мастер сделок», чтобы карточка
 * заявки показывала тот же прогноз, что потом окажется в договоре — иначе
 * менеджер называет клиенту одну цифру, а договор печатает другую.
 */
export interface DealTerms {
  price: number
  discountPct: number
  downPct: number
  months: number
  plan: PaymentPlanKind
}

export interface ScheduleRow {
  index: number
  dueAt: string
  amount: number
  isDown: boolean
}

export interface DealForecast {
  base: number
  discount: number
  total: number
  down: number
  rest: number
  monthly: number
  months: number
  schedule: ScheduleRow[]
}

export function calcForecast(terms: DealTerms, from = new Date()): DealForecast {
  const base = Math.max(0, Math.round(terms.price))
  const discount = Math.round(base * (terms.discountPct / 100))
  const total = base - discount
  const full = terms.plan === 'full'
  const months = full ? 1 : Math.max(1, Math.round(terms.months))
  const down = full ? total : Math.round(total * (terms.downPct / 100))
  const rest = total - down
  // последний платёж добирает остаток, иначе сумма графика расходится с ценой
  const monthly = months <= 1 ? 0 : Math.round(rest / (months - 1))

  const schedule: ScheduleRow[] = [{ index: 0, dueAt: from.toISOString(), amount: down, isDown: true }]
  for (let m = 1; m < months; m++) {
    const due = new Date(new Date(from).setMonth(from.getMonth() + m))
    const amount = m === months - 1 ? rest - monthly * (months - 2) : monthly
    schedule.push({ index: m, dueAt: due.toISOString(), amount, isDown: false })
  }
  return { base, discount, total, down, rest, monthly, months, schedule }
}

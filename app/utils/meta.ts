import type { CommKind, CommOutcome, ContractStatus, DealType, DocKind, FacadeTag, LeadPriority, LeadStage, LeadTaskKind, PaymentKind, PaymentPlanKind, PaymentStatus, ReservationKind, UnitKind, UnitStatus } from '~/types/models'

export const UNIT_STATUS_META: Record<UnitStatus, { label: string; tone: 'ok' | 'warn' | 'bad' | 'info' | 'neutral' | 'plum'; boardBg: string; boardBorder: string }> = {
  free: { label: 'Свободно', tone: 'neutral', boardBg: 'bg-panel', boardBorder: 'border-line' },
  reserved: { label: 'Бронь', tone: 'warn', boardBg: 'bg-reserve-bg', boardBorder: 'border-reserve' },
  installment: { label: 'Рассрочка', tone: 'plum', boardBg: 'bg-inst-bg', boardBorder: 'border-inst' },
  sold: { label: 'Продано', tone: 'info', boardBg: 'bg-sold-bg', boardBorder: 'border-sold' },
  closed: { label: 'Закрыто', tone: 'neutral', boardBg: 'bg-soft', boardBorder: 'border-line' },
}

// Заливка самих ячеек шахматки: используем --board-* токены (не зависят от темы),
// а не UNIT_STATUS_META.boardBg (те бледные "-bg" тона для тегов/легенды —
// на них белый текст в светлой теме почти не читается).
export const UNIT_BOARD_FILL: Record<UnitStatus, { bg: string; border: string; text: string }> = {
  free: { bg: 'bg-panel', border: 'border-line', text: 'text-ink' },
  reserved: { bg: 'bg-board-reserve', border: 'border-board-reserve', text: 'text-board-reserve-ink' },
  installment: { bg: 'bg-board-inst', border: 'border-board-inst', text: 'text-board-inst-ink' },
  sold: { bg: 'bg-board-sold', border: 'border-board-sold', text: 'text-board-sold-ink' },
  closed: { bg: 'bg-soft', border: 'border-line', text: 'text-muted' },
}

// то же самое, но как реальные hex-значения — для inline-стилей (canvas-зоны на
// фото, где нельзя обойтись классами Tailwind). Держать в синхроне с --board-*
// в main.css.
export const UNIT_BOARD_COLOR: Record<UnitStatus, string> = {
  free: '#9D95A2',
  reserved: '#C9821A',
  installment: '#8C5566',
  sold: '#34495A',
  closed: '#6D6772',
}

export const FACADE_TAG_META: Record<FacadeTag, { label: string; icon: string }> = {
  none: { label: 'Без тега', icon: 'ph:tag-simple' },
  yard: { label: 'Вид со двора', icon: 'ph:tree' },
  street: { label: 'Вид с улицы', icon: 'ph:road-horizon' },
  lobby: { label: 'Парадная (лобби)', icon: 'ph:door' },
  masterplan: { label: 'Генплан', icon: 'ph:map-trifold' },
  playground: { label: 'Детская площадка', icon: 'ph:baby-carriage' },
  sport: { label: 'Спортивная площадка', icon: 'ph:basketball' },
}

export const FACADE_TAGS = Object.keys(FACADE_TAG_META) as FacadeTag[]

export const UNIT_KIND_META: Record<UnitKind, { label: string; icon: string; short: string }> = {
  apartment: { label: 'Квартира', icon: 'ph:door', short: 'Кв.' },
  commercial: { label: 'Коммерция', icon: 'ph:storefront', short: 'Ком.' },
  parking: { label: 'Машиноместо', icon: 'ph:car', short: 'МП' },
  storage: { label: 'Кладовая', icon: 'ph:package', short: 'Кл.' },
  cottage: { label: 'Коттедж', icon: 'ph:house', short: 'Котт.' },
  townhouse: { label: 'Таунхаус', icon: 'ph:buildings', short: 'ТХ' },
  land: { label: 'Участок', icon: 'ph:map-trifold', short: 'Уч.' },
}

export const LEAD_STAGE_META: Record<LeadStage, { label: string; tone: 'ok' | 'warn' | 'bad' | 'info' | 'neutral' | 'plum' }> = {
  new: { label: 'Новая', tone: 'info' },
  contacted: { label: 'Связались', tone: 'plum' },
  visit: { label: 'Показ', tone: 'warn' },
  reserved: { label: 'Бронь', tone: 'warn' },
  deal: { label: 'Сделка', tone: 'ok' },
  lost: { label: 'Отказ', tone: 'bad' },
}


/**
 * Цвет этапа воронки — порядковая шкала --c-step-* (проверена на монотонность
 * светлоты и контраст к поверхности в обеих темах). Этап тем темнее, чем ближе
 * к сделке; «Отказ» вне шкалы — это не следующий шаг, а выход из воронки.
 */
export const LEAD_STAGE_COLOR: Record<LeadStage, string> = {
  new: 'var(--c-step-1)',
  contacted: 'var(--c-step-2)',
  visit: 'var(--c-step-3)',
  reserved: 'var(--c-step-4)',
  deal: 'var(--c-step-5)',
  lost: 'var(--muted)',
}

export const LEAD_STAGES: LeadStage[] = ['new', 'contacted', 'visit', 'reserved', 'deal', 'lost']
/** Этапы, по которым считается конверсия: «Отказ» — не ступень воронки. */
export const LEAD_PIPELINE: LeadStage[] = ['new', 'contacted', 'visit', 'reserved', 'deal']

export const LEAD_STAGE_ICON: Record<LeadStage, string> = {
  new: 'ph:sparkle',
  contacted: 'ph:phone-call',
  visit: 'ph:buildings',
  reserved: 'ph:bookmark-simple',
  deal: 'ph:trophy',
  lost: 'ph:prohibit',
}

export const LEAD_PRIORITY_META: Record<LeadPriority, { label: string; tone: 'bad' | 'warn' | 'neutral'; color: string }> = {
  high: { label: 'Высокий', tone: 'bad', color: 'var(--bad)' },
  normal: { label: 'Обычный', tone: 'neutral', color: 'var(--muted)' },
  low: { label: 'Низкий', tone: 'neutral', color: 'var(--line)' },
}

export const LEAD_TASK_KIND_META: Record<LeadTaskKind, { label: string; icon: string }> = {
  call: { label: 'Звонок', icon: 'ph:phone' },
  meeting: { label: 'Встреча', icon: 'ph:users-three' },
  visit: { label: 'Показ объекта', icon: 'ph:buildings' },
  document: { label: 'Документы', icon: 'ph:file-text' },
  other: { label: 'Другое', icon: 'ph:check-square' },
}

export const LEAD_TASK_KINDS = Object.keys(LEAD_TASK_KIND_META) as LeadTaskKind[]

export const LEAD_CHANNEL_ICON: Record<string, string> = {
  'Instagram': 'ph:instagram-logo',
  'WhatsApp': 'ph:whatsapp-logo',
  'Сайт': 'ph:globe',
  'Звонок': 'ph:phone-call',
  'Telegram': 'ph:telegram-logo',
}

export const LEAD_TAGS = ['Ипотека', 'Рассрочка', 'Срочно', 'Инвестор', 'Повторное обращение', 'Нужен паркинг', 'Наличные'] as const


export const COMM_KIND_META: Record<CommKind, { label: string; icon: string; short: string }> = {
  call_out: { label: 'Исходящий звонок', icon: 'ph:phone-outgoing', short: 'Звонок' },
  call_in: { label: 'Входящий звонок', icon: 'ph:phone-incoming', short: 'Входящий' },
  whatsapp: { label: 'WhatsApp', icon: 'ph:whatsapp-logo', short: 'WhatsApp' },
  email: { label: 'Письмо', icon: 'ph:envelope-simple', short: 'Письмо' },
  meeting: { label: 'Встреча', icon: 'ph:users-three', short: 'Встреча' },
}

export const COMM_OUTCOME_META: Record<CommOutcome, { label: string; tone: 'ok' | 'warn' | 'bad' }> = {
  answered: { label: 'Дозвонился', tone: 'ok' },
  no_answer: { label: 'Не ответил', tone: 'bad' },
  callback: { label: 'Просил перезвонить', tone: 'warn' },
}

export const DOC_KIND_META: Record<DocKind, { label: string; icon: string }> = {
  passport: { label: 'Паспорт', icon: 'ph:identification-card' },
  contract: { label: 'Договор', icon: 'ph:file-text' },
  annex: { label: 'Доп. соглашение', icon: 'ph:file-plus' },
  receipt: { label: 'Квитанция', icon: 'ph:receipt' },
  other: { label: 'Прочее', icon: 'ph:paperclip' },
}

export const DOC_KINDS = Object.keys(DOC_KIND_META) as DocKind[]

export const PAYMENT_PLAN_META: Record<PaymentPlanKind, { label: string; icon: string }> = {
  full: { label: '100% оплата', icon: 'ph:money' },
  installment: { label: 'Рассрочка', icon: 'ph:calendar-dots' },
  mortgage: { label: 'Ипотека', icon: 'ph:bank' },
}

export const PAYMENT_PLANS = Object.keys(PAYMENT_PLAN_META) as PaymentPlanKind[]

export const CONTRACT_STATUS_META: Record<ContractStatus, { label: string; tone: 'ok' | 'warn' | 'bad' | 'info' | 'neutral' | 'plum' }> = {
  draft: { label: 'Черновик', tone: 'neutral' },
  pending_approval: { label: 'На согласовании', tone: 'warn' },
  active: { label: 'Активен', tone: 'info' },
  paid: { label: 'Оплачен', tone: 'ok' },
  terminated: { label: 'Расторгнут', tone: 'bad' },
}

export const DEAL_TYPE_META: Record<DealType, string> = {
  regular: 'Обычная', barter: 'Бартер', barter_land: 'Бартер на участок', pledge: 'Залог', preferential: 'Льготная',
}

export const RESERVATION_KIND_META: Record<ReservationKind, { label: string; days: number }> = {
  no_deposit: { label: 'Без задатка', days: 1 },
  confirmed: { label: 'С подтверждением', days: 3 },
  with_deposit: { label: 'С задатком', days: 30 },
}

export const PAYMENT_STATUS_META: Record<PaymentStatus, { label: string; tone: 'ok' | 'warn' | 'bad' }> = {
  pending: { label: 'Ожидает подтверждения', tone: 'warn' },
  confirmed: { label: 'Подтверждён', tone: 'ok' },
  rejected: { label: 'Отклонён', tone: 'bad' },
}

export const PAYMENT_KIND_META: Record<PaymentKind, string> = {
  cash: 'Наличные (ПКО)', bank: 'Банк', online: 'Онлайн', barter: 'Бартер', exchange: 'Обмен',
  offset: 'Зачёт недвижимости', preferential: 'Льготный', discount: 'Скидка', refund: 'Возврат',
}

export type PaymentBucket = 'ok' | 'soon' | 'today' | 'd1_7' | 'd8_30' | 'd30_plus'

export const PAYMENT_BUCKET_META: Record<PaymentBucket, { label: string; tone: 'ok' | 'warn' | 'bad' | 'info' | 'neutral' }> = {
  ok: { label: 'Оплачено', tone: 'ok' },
  soon: { label: 'Скоро', tone: 'info' },
  today: { label: 'Сегодня', tone: 'warn' },
  d1_7: { label: '1–7 дней', tone: 'warn' },
  d8_30: { label: '8–30 дней', tone: 'bad' },
  d30_plus: { label: '30+ дней', tone: 'bad' },
}

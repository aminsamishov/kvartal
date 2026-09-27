import type {
  ActionKind, AutomationAction, AutomationCondition, AutomationContext, AutomationRule,
  AutomationTriggerKind, ConditionField, ConditionOp,
} from '~/types/automation'
import { ACTION_META, FIELD_META, OP_LABEL, TARGET_LABEL, TRIGGER_META } from '~/types/automation'
import { LEAD_PRIORITY_META, LEAD_STAGE_META, LEAD_TASK_KIND_META, RESERVATION_KIND_META, UNIT_KIND_META, UNIT_STATUS_META } from '~/utils/meta'
import { money } from '~/utils/format'

/**
 * Разбор и сборка правил. Здесь нет обращений к сторам: правило — данные, и
 * проверить его можно в тесте, в предпросмотре конструктора и в журнале
 * одинаково.
 */

let seq = 0
function rid(prefix: string) {
  seq += 1
  return `${prefix}-${Date.now().toString(36)}-${seq}`
}

/* ------------------------------ значения полей ---------------------------- */

export interface FieldOption { value: string; label: string }

/**
 * Справочники для селектов условий. Проекты приходят снаружи — остальное
 * живёт в общих словарях приложения.
 */
export function fieldOptions(field: ConditionField, projects: FieldOption[], sources: string[]): FieldOption[] {
  switch (FIELD_META[field].source) {
    case 'projects': return projects
    case 'stages': return Object.entries(LEAD_STAGE_META).map(([value, m]) => ({ value, label: m.label }))
    case 'sources': return sources.map((s) => ({ value: s, label: s }))
    case 'unitStatuses': return Object.entries(UNIT_STATUS_META).map(([value, m]) => ({ value, label: m.label }))
    case 'unitKinds': return Object.entries(UNIT_KIND_META).map(([value, m]) => ({ value, label: m.label }))
    case 'priorities': return Object.entries(LEAD_PRIORITY_META).map(([value, m]) => ({ value, label: m.label }))
    case 'reservationKinds': return Object.entries(RESERVATION_KIND_META).map(([value, m]) => ({ value, label: m.label }))
    default: return []
  }
}

/** Подпись значения условия: в правиле хранится код, читать нужно словами. */
export function valueLabel(field: ConditionField, value: string | number, projects: FieldOption[]): string {
  const meta = FIELD_META[field]
  if (meta.kind === 'number') {
    const n = Number(value) || 0
    return meta.suffix === '$' ? money(n) : `${n} ${meta.suffix ?? ''}`.trim()
  }
  const found = fieldOptions(field, projects, []).find((o) => o.value === String(value))
  return found?.label ?? String(value)
}

/* --------------------------------- условия -------------------------------- */

function compare(fact: string | number | undefined, op: ConditionOp, value: string | number): boolean {
  if (fact === undefined || fact === null || fact === '') return false
  if (op === 'gt') return Number(fact) > Number(value)
  if (op === 'lt') return Number(fact) < Number(value)
  const equal = String(fact) === String(value)
  return op === 'eq' ? equal : !equal
}

/** Все условия правила — «и»: набор «или» менеджеры собирают вторым правилом. */
export function matchesConditions(rule: AutomationRule, ctx: AutomationContext): boolean {
  return rule.conditions.every((c) => compare(ctx.facts[c.field], c.op, c.value))
}

/* -------------------------------- подстановки ------------------------------ */

/** {клиент}, {объект}, {срок} — из контекста; неизвестное просто вырезаем. */
export function fillTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{([^}]+)\}/g, (_, key: string) => vars[key.trim()] ?? '').replace(/\s{2,}/g, ' ').trim()
}

export const TEMPLATE_VARS = ['клиент', 'объект', 'дом', 'проект', 'срок', 'сумма', 'менеджер', 'договор'] as const

/* ------------------------------ чтение правила ---------------------------- */

export function triggerLabel(rule: AutomationRule): string {
  const meta = TRIGGER_META[rule.trigger]
  if (!meta.offset || !rule.offsetHours) return meta.label
  if (rule.trigger === 'reservation.expiring') {
    const h = rule.offsetHours
    return h % 24 === 0 ? `${meta.label} через ${h / 24} дн.` : `${meta.label} через ${h} ч.`
  }
  if (rule.trigger === 'lead.stalled') return `${meta.label} ${Math.round(rule.offsetHours / 24)} дн.`
  if (rule.trigger === 'payment.overdue') return `${meta.label} больше ${Math.round(rule.offsetHours / 24)} дн.`
  return meta.label
}

export function conditionLabel(c: AutomationCondition, projects: FieldOption[]): string {
  return `${FIELD_META[c.field].label} ${OP_LABEL[c.op]} ${valueLabel(c.field, c.value, projects)}`
}

export function actionLabel(a: AutomationAction, userName: (id: string) => string): string {
  const meta = ACTION_META[a.kind]
  const target = a.target ? TARGET_LABEL[a.target] ?? userName(a.target) : ''
  const delay = a.delayHours
    ? a.delayHours % 24 === 0 ? ` через ${a.delayHours / 24} дн.` : ` через ${a.delayHours} ч.`
    : ''
  switch (a.kind) {
    case 'notify': return `Уведомить ${target}${a.text ? `: «${a.text}»` : ''}`
    case 'task': return `Задача «${a.text || 'без названия'}»${delay}${target ? ` — ${target}` : ''}`
    case 'stage': return `Перевести на этап «${LEAD_STAGE_META[a.value as keyof typeof LEAD_STAGE_META]?.label ?? a.value}»`
    case 'tag': return `Добавить метку «${a.value}»`
    default: return meta.label
  }
}

/** Человеческая формула правила — она же предпросмотр в конструкторе. */
export function describeRule(rule: AutomationRule, projects: FieldOption[], userName: (id: string) => string): string {
  const ifs = rule.conditions.map((c) => conditionLabel(c, projects))
  const then = rule.actions.map((a) => actionLabel(a, userName))
  const when = [triggerLabel(rule), ...ifs].join(' и ')
  return `Если ${when.toLowerCase()} → ${then.join(', ').toLowerCase() || 'ничего не делать'}`
}

/* ------------------------------ сборка правила ---------------------------- */

export function newCondition(field: ConditionField): AutomationCondition {
  const meta = FIELD_META[field]
  return { id: rid('cond'), field, op: meta.ops[0]!, value: meta.kind === 'number' ? 0 : '' }
}

export function newAction(kind: ActionKind): AutomationAction {
  const base: AutomationAction = { id: rid('act'), kind }
  if (kind === 'notify') return { ...base, target: 'manager', text: '' }
  if (kind === 'task') return { ...base, text: '', value: 'call', delayHours: 24, target: 'manager' }
  if (kind === 'stage') return { ...base, value: 'contacted' }
  if (kind === 'tag') return { ...base, value: 'Срочно' }
  return base
}

export function newRule(trigger: AutomationTriggerKind): AutomationRule {
  const meta = TRIGGER_META[trigger]
  return {
    id: rid('rule'),
    name: meta.label,
    enabled: true,
    trigger,
    offsetHours: meta.offset ? meta.offset.default * (meta.offset.suffix === 'дн.' ? 24 : 1) : undefined,
    conditions: [],
    actions: [newAction(meta.actions[0]!)],
    runs: 0,
  }
}

export function taskKindOptions() {
  return Object.entries(LEAD_TASK_KIND_META).map(([value, m]) => ({ value, label: m.label }))
}

import type { AutomationRule } from '~/types/automation'

/**
 * Встроенные сценарии. Это не «настройки», а обычные правила конструктора:
 * их видно целиком, можно переписать условия, добавить действия или выключить.
 * Удалить нельзя — они описывают поведение, на которое рассчитан весь процесс.
 */
export function builtinRules(): AutomationRule[] {
  return [
    {
      id: 'rule-lead-first-call', name: 'Первый звонок по новой заявке', enabled: true, builtin: true,
      trigger: 'lead.created', conditions: [], runs: 0,
      actions: [{
        id: 'a1', kind: 'task', text: 'Первый звонок клиенту', value: 'call', delayHours: 24, target: 'manager',
      }],
    },
    {
      id: 'rule-visit-followup', name: 'Follow-up после показа', enabled: true, builtin: true,
      trigger: 'visit.completed', conditions: [], runs: 0,
      actions: [{
        id: 'a1', kind: 'task', text: 'Узнать впечатления после показа', value: 'call', delayHours: 24, target: 'manager',
      }],
    },
    {
      id: 'rule-reservation-warning', name: 'Предупредить, что бронь на исходе', enabled: true, builtin: true,
      trigger: 'reservation.expiring', offsetHours: 24, conditions: [], runs: 0,
      actions: [
        { id: 'a1', kind: 'notify', target: 'manager', text: 'Бронь на {объект} истекает {срок} — свяжитесь с клиентом {клиент}' },
        { id: 'a2', kind: 'task', text: 'Подтвердить бронь {объект} с клиентом {клиент}', value: 'call', delayHours: 2, target: 'manager' },
      ],
    },
    {
      id: 'rule-reservation-expired', name: 'Снятие истёкшей брони', enabled: true, builtin: true,
      trigger: 'reservation.expired', conditions: [], runs: 0,
      actions: [
        { id: 'a1', kind: 'offerQueue' },
        { id: 'a2', kind: 'freeUnit' },
        { id: 'a3', kind: 'notify', target: 'manager', text: 'Бронь на {объект} истекла — объект вернулся в продажу' },
      ],
    },
    {
      id: 'rule-payment-overdue', name: 'Оповещение о просрочке', enabled: true, builtin: true,
      trigger: 'payment.overdue', offsetHours: 24, conditions: [], runs: 0,
      actions: [{
        id: 'a1', kind: 'notify', target: 'head', text: 'Просрочка по договору {договор}: {сумма}, {срок}',
      }],
    },
    {
      id: 'rule-contract-signed', name: 'Договор подписан — предупредить финансы', enabled: true, builtin: true,
      trigger: 'contract.signed', conditions: [], runs: 0,
      actions: [{
        id: 'a1', kind: 'notify', target: 'head', text: 'Договор {договор} на {сумма} подписан — график платежей создан',
      }],
    },
    {
      id: 'rule-lead-stalled', name: 'Заявка застряла на этапе', enabled: true, builtin: true,
      trigger: 'lead.stalled', offsetHours: 120, conditions: [], runs: 0,
      actions: [
        { id: 'a1', kind: 'notify', target: 'manager', text: 'Заявка {клиент} не двигается {срок} — вернитесь к ней' },
      ],
    },
  ]
}

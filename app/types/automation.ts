/**
 * Конструктор автоматизаций: правило = триггер + условия + действия.
 *
 * Сценарии продаж меняются чаще, чем выходит релиз: «бронь истекает — предупреди
 * за сутки», «показ прошёл — перезвони завтра». Поэтому правила описываются
 * данными, а не кодом, и собираются руководителем отдела в интерфейсе.
 */

export type AutomationTriggerKind =
  | 'lead.created'
  | 'lead.stalled'
  | 'visit.completed'
  | 'reservation.created'
  | 'reservation.expiring'
  | 'reservation.expired'
  | 'contract.signed'
  | 'payment.overdue'

export type ConditionField =
  | 'project' | 'priority' | 'source' | 'stage' | 'budget'
  | 'unitStatus' | 'unitKind' | 'rooms' | 'price'
  | 'reservationKind' | 'deposit' | 'overdueDays' | 'amount'

export type ConditionOp = 'eq' | 'neq' | 'gt' | 'lt'

export interface AutomationCondition {
  id: string
  field: ConditionField
  op: ConditionOp
  value: string | number
}

export type ActionKind = 'notify' | 'task' | 'stage' | 'freeUnit' | 'offerQueue' | 'tag'

export interface AutomationAction {
  id: string
  kind: ActionKind
  /** кому: менеджер объекта, руководитель или конкретный сотрудник */
  target?: 'manager' | 'head' | 'director' | string
  /** текст уведомления или заголовок задачи; поддерживает подстановки {клиент} */
  text?: string
  /** отложить действие на N часов после срабатывания */
  delayHours?: number
  /** вид задачи, этап воронки или метка — зависит от действия */
  value?: string
}

export interface AutomationRule {
  id: string
  name: string
  enabled: boolean
  trigger: AutomationTriggerKind
  /** «за N часов до события» — для триггеров с окном ожидания */
  offsetHours?: number
  conditions: AutomationCondition[]
  actions: AutomationAction[]
  /** встроенный сценарий: настраивается и отключается, но не удаляется */
  builtin?: boolean
  runs: number
  lastRunAt?: string
  createdBy?: string
  createdAt?: string
}

/** Запись журнала: что сработало, по какому объекту и что сделало. */
export interface AutomationRun {
  id: string
  ruleId: string
  ruleName: string
  at: string
  subject: string
  effects: string[]
}

/**
 * Контекст срабатывания. `facts` — значения для условий, `vars` — подстановки
 * в текст. Всё остальное — ссылки на сущности, по которым работают действия.
 */
export interface AutomationContext {
  leadId?: string
  unitId?: string
  reservationId?: string
  contractId?: string
  assignedTo?: string
  /** человекочитаемое «по чему сработало» — идёт в журнал */
  subject: string
  /** ключ дедупликации: одно и то же событие не должно звенеть дважды */
  key: string
  facts: Partial<Record<ConditionField, string | number>>
  vars: Record<string, string>
}

export interface TriggerMeta {
  label: string
  /** что именно происходит — подсказка под названием в конструкторе */
  hint: string
  icon: string
  group: 'Продажи' | 'Бронь' | 'Финансы'
  /** проверяется по времени при входе в систему, а не в момент действия */
  timed?: boolean
  /** окно ожидания: «за N часов до» или «через N дней без движения» */
  offset?: { label: string; suffix: string; default: number; min: number; max: number }
  fields: ConditionField[]
  actions: ActionKind[]
}

export const TRIGGER_META: Record<AutomationTriggerKind, TriggerMeta> = {
  'lead.created': {
    label: 'Создана заявка', hint: 'Клиент появился в воронке — с формы, из мастера сделок или с сайта',
    icon: 'ph:sparkle', group: 'Продажи',
    fields: ['project', 'priority', 'source', 'budget'],
    actions: ['task', 'notify', 'tag'],
  },
  'lead.stalled': {
    label: 'Заявка висит без движения', hint: 'Этап не меняется дольше указанного срока',
    icon: 'ph:clock-countdown', group: 'Продажи', timed: true,
    offset: { label: 'Дней без движения', suffix: 'дн.', default: 5, min: 1, max: 60 },
    fields: ['stage', 'priority', 'source', 'budget'],
    actions: ['notify', 'task', 'tag'],
  },
  'visit.completed': {
    label: 'Показ завершён', hint: 'Менеджер отметил задачу-показ выполненной',
    icon: 'ph:buildings', group: 'Продажи',
    fields: ['project', 'priority', 'stage'],
    actions: ['task', 'notify', 'stage'],
  },
  'reservation.created': {
    label: 'Оформлена бронь', hint: 'Помещение ушло в бронь — с задатком или без',
    icon: 'ph:bookmark-simple', group: 'Бронь',
    fields: ['project', 'reservationKind', 'deposit', 'price', 'unitKind'],
    actions: ['notify', 'task'],
  },
  'reservation.expiring': {
    label: 'Бронь истекает', hint: 'До конца брони осталось меньше указанного времени',
    icon: 'ph:hourglass-medium', group: 'Бронь', timed: true,
    offset: { label: 'За сколько предупредить', suffix: 'ч.', default: 24, min: 1, max: 168 },
    fields: ['project', 'reservationKind', 'deposit', 'price'],
    actions: ['notify', 'task'],
  },
  'reservation.expired': {
    label: 'Срок брони вышел', hint: 'Бронь не превратилась в договор и снимается',
    icon: 'ph:hourglass', group: 'Бронь', timed: true,
    fields: ['project', 'reservationKind', 'price'],
    actions: ['offerQueue', 'freeUnit', 'notify', 'task'],
  },
  'contract.signed': {
    label: 'Договор подписан', hint: 'Сделка закрыта: график платежей создаётся в любом случае',
    icon: 'ph:file-text', group: 'Финансы',
    fields: ['project', 'amount', 'unitKind'],
    actions: ['notify', 'task', 'tag'],
  },
  'payment.overdue': {
    label: 'Платёж просрочен', hint: 'Деньги по графику не поступили в срок',
    icon: 'ph:warning-circle', group: 'Финансы', timed: true,
    offset: { label: 'Начиная с просрочки', suffix: 'дн.', default: 1, min: 1, max: 90 },
    fields: ['project', 'overdueDays', 'amount'],
    actions: ['notify', 'task'],
  },
}

export interface FieldMeta {
  label: string
  kind: 'select' | 'number'
  ops: ConditionOp[]
  /** динамический список значений берётся из данных, а не из справочника */
  source?: 'projects' | 'stages' | 'sources' | 'unitStatuses' | 'unitKinds' | 'priorities' | 'reservationKinds'
  suffix?: string
}

export const FIELD_META: Record<ConditionField, FieldMeta> = {
  project: { label: 'ЖК', kind: 'select', ops: ['eq', 'neq'], source: 'projects' },
  priority: { label: 'Приоритет заявки', kind: 'select', ops: ['eq', 'neq'], source: 'priorities' },
  source: { label: 'Источник', kind: 'select', ops: ['eq', 'neq'], source: 'sources' },
  stage: { label: 'Этап воронки', kind: 'select', ops: ['eq', 'neq'], source: 'stages' },
  budget: { label: 'Бюджет клиента', kind: 'number', ops: ['gt', 'lt'], suffix: '$' },
  unitStatus: { label: 'Статус помещения', kind: 'select', ops: ['eq', 'neq'], source: 'unitStatuses' },
  unitKind: { label: 'Тип помещения', kind: 'select', ops: ['eq', 'neq'], source: 'unitKinds' },
  rooms: { label: 'Комнат', kind: 'number', ops: ['eq', 'gt', 'lt'] },
  price: { label: 'Цена помещения', kind: 'number', ops: ['gt', 'lt'], suffix: '$' },
  reservationKind: { label: 'Вид брони', kind: 'select', ops: ['eq', 'neq'], source: 'reservationKinds' },
  deposit: { label: 'Задаток', kind: 'number', ops: ['gt', 'lt'], suffix: '$' },
  overdueDays: { label: 'Дней просрочки', kind: 'number', ops: ['gt', 'lt'], suffix: 'дн.' },
  amount: { label: 'Сумма', kind: 'number', ops: ['gt', 'lt'], suffix: '$' },
}

export const OP_LABEL: Record<ConditionOp, string> = {
  eq: 'равно', neq: 'не равно', gt: 'больше', lt: 'меньше',
}

export interface ActionMeta {
  label: string
  icon: string
  hint: string
  /** какие поля показывает конструктор */
  params: ('target' | 'text' | 'delay' | 'taskKind' | 'stage' | 'tag')[]
}

export const ACTION_META: Record<ActionKind, ActionMeta> = {
  notify: {
    label: 'Уведомить', icon: 'ph:bell-ringing', hint: 'Строка в колокольчике у выбранного сотрудника',
    params: ['target', 'text'],
  },
  task: {
    label: 'Поставить задачу', icon: 'ph:check-square-offset', hint: 'Задача в карточке заявки со сроком',
    params: ['text', 'taskKind', 'delay', 'target'],
  },
  stage: {
    label: 'Перевести на этап', icon: 'ph:flow-arrow', hint: 'Заявка двигается по воронке сама',
    params: ['stage'],
  },
  freeUnit: {
    label: 'Вернуть в продажу', icon: 'ph:lock-open', hint: 'Помещение снова свободно',
    params: [],
  },
  offerQueue: {
    label: 'Предложить очереди', icon: 'ph:users-three', hint: 'Первый в очереди получает бронь без задатка',
    params: [],
  },
  tag: {
    label: 'Добавить метку', icon: 'ph:tag', hint: 'Метка на заявке — по ней потом фильтруют',
    params: ['tag'],
  },
}

export const TARGET_LABEL: Record<string, string> = {
  manager: 'менеджеру объекта',
  head: 'руководителю отдела',
  director: 'директору',
}

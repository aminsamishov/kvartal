import type { UserRole } from '~/types/models'

/**
 * Права ролей. Раньше матрица доступа жила текстом на странице «Права
 * доступа», а интерфейс показывал всем одно и то же: менеджер открывал
 * дашборд директора и видел выручку компании, прайс-листы и журнал действий.
 *
 * Право — это возможность, а не страница: одна и та же возможность
 * закрывает пункт меню, маршрут и кнопку внутри экрана.
 */
export type Capability =
  | 'dashboard.company'
  | 'board.view' | 'unit.editStatus' | 'unit.editPrice'
  | 'objects.view' | 'objects.edit'
  | 'pricing.view' | 'pricing.edit'
  | 'leads.viewAll' | 'leads.work'
  | 'deals.create'
  | 'approvals.view' | 'approvals.decide'
  | 'clients.view'
  | 'contracts.view'
  | 'payments.view' | 'payments.confirm'
  | 'documents.view'
  | 'analytics.view'
  | 'calendar.view'
  | 'users.manage'
  | 'settings.manage'
  | 'audit.view'

/**
 * Рабочее место: от него зависит, какой дашборд человек видит утром.
 * Руководителю нужны деньги компании, менеджеру — его день, финансам —
 * поступления и просрочка, юристу — договоры и документы.
 */
export type Workspace = 'exec' | 'sales' | 'finance' | 'legal'

export const WORKSPACE_OF: Record<UserRole, Workspace> = {
  admin: 'exec', director: 'exec', commercial_director: 'exec', partner: 'exec', auditor: 'exec',
  manager: 'sales', agent: 'sales', care_manager: 'sales',
  finance_director: 'finance', accountant: 'finance', cashier: 'finance', head_cashier: 'finance', controller: 'finance',
  lawyer: 'legal',
}

/**
 * Продавец ничего не правит в каталоге. Ни цену, ни планировку, ни статус
 * помещения вручную: статус меняется сам — через бронь, договор и истечение
 * срока. Руками выставленный статус ломает эту связь, потому что за ним не
 * стоит ни брони, ни сделки, и объект оказывается занят без причины.
 *
 * Бронь и договор правом unit.editStatus не закрыты — это продажа, а не
 * редактирование карточки.
 */
const SALES_BASE: Capability[] = [
  'board.view', 'objects.view', 'leads.work', 'deals.create',
  'approvals.view', 'clients.view', 'contracts.view', 'documents.view', 'calendar.view',
  // платежи менеджер видит, но не проводит: график своих клиентов — часть его работы
  'payments.view',
]

const FINANCE_BASE: Capability[] = [
  'board.view', 'objects.view', 'clients.view', 'contracts.view',
  'payments.view', 'documents.view', 'analytics.view', 'audit.view', 'calendar.view',
]

const EXEC_ALL: Capability[] = [
  'dashboard.company', 'board.view', 'unit.editStatus', 'unit.editPrice', 'objects.view', 'objects.edit',
  'pricing.view', 'pricing.edit', 'leads.viewAll', 'leads.work', 'deals.create',
  'approvals.view', 'approvals.decide', 'clients.view', 'contracts.view',
  'payments.view', 'payments.confirm', 'documents.view', 'analytics.view', 'calendar.view',
  'users.manage', 'settings.manage', 'audit.view',
]

export const ROLE_CAPS: Record<UserRole, Capability[]> = {
  admin: EXEC_ALL,
  director: EXEC_ALL,
  commercial_director: EXEC_ALL.filter((c) => c !== 'users.manage'),
  partner: ['dashboard.company', 'board.view', 'objects.view', 'analytics.view', 'contracts.view', 'payments.view'],
  auditor: ['dashboard.company', 'board.view', 'objects.view', 'analytics.view', 'contracts.view', 'payments.view', 'documents.view', 'audit.view', 'clients.view'],

  // менеджер работает своими заявками: чужие заявки и деньги компании ему
  // не нужны, а прайс и настройки он не меняет
  manager: SALES_BASE,
  agent: ['board.view', 'objects.view', 'leads.work', 'clients.view', 'calendar.view'],
  care_manager: [...SALES_BASE, 'leads.viewAll', 'payments.view'],

  finance_director: [...FINANCE_BASE, 'dashboard.company', 'payments.confirm', 'pricing.view', 'approvals.view', 'approvals.decide'],
  accountant: [...FINANCE_BASE, 'payments.confirm'],
  cashier: ['board.view', 'objects.view', 'contracts.view', 'payments.view', 'payments.confirm', 'clients.view', 'calendar.view'],
  head_cashier: [...FINANCE_BASE, 'payments.confirm'],
  controller: [...FINANCE_BASE, 'approvals.view'],

  lawyer: ['board.view', 'objects.view', 'contracts.view', 'documents.view', 'clients.view', 'audit.view', 'calendar.view'],
}

export function capsOf(role: UserRole | undefined): Set<Capability> {
  return new Set(role ? ROLE_CAPS[role] ?? [] : [])
}

/**
 * Какое право открывает маршрут. Проверка идёт по самому длинному совпадению,
 * поэтому `/settings/automations` закрыт тем же правом, что и `/settings`.
 */
const ROUTE_CAPS: [string, Capability][] = [
  ['/objects', 'objects.view'],
  ['/buildings', 'objects.view'],
  ['/facades', 'objects.edit'],
  ['/board', 'board.view'],
  ['/pricing', 'pricing.view'],
  ['/leads', 'leads.work'],
  ['/deals/new', 'deals.create'],
  ['/approvals', 'approvals.view'],
  ['/clients', 'clients.view'],
  ['/contracts', 'contracts.view'],
  ['/payments', 'payments.view'],
  ['/documents', 'documents.view'],
  ['/reports', 'analytics.view'],
  ['/calendar', 'calendar.view'],
  ['/users', 'users.manage'],
  ['/offices', 'users.manage'],
  ['/settings', 'settings.manage'],
]

export function routeCapability(path: string): Capability | null {
  const hit = ROUTE_CAPS
    .filter(([prefix]) => path === prefix || path.startsWith(`${prefix}/`))
    .sort((a, b) => b[0].length - a[0].length)[0]
  return hit?.[1] ?? null
}


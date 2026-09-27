/**
 * Цвет модуля. Иконка в меню работает ориентиром: раздел узнаётся по цвету
 * раньше, чем прочитано название, — поэтому роль задаётся в данных, а не
 * подбирается в компоненте.
 */
import type { Capability } from '~/utils/access'

export type NavAccent =
  | 'objects' | 'price' | 'sales' | 'reserve' | 'finance' | 'docs' | 'analytics' | 'users' | 'system'

export interface NavItem {
  label: string
  to: string
  icon: string
  accent: NavAccent
  /** право, без которого пункт не показываем; маршрут закрыт тем же правом */
  can?: Capability
}
export interface NavGroup {
  label?: string
  items: NavItem[]
}

export const NAV: NavGroup[] = [
  { items: [{ label: 'Дашборд', to: '/', icon: 'ph:squares-four', accent: 'analytics' }] },
  {
    label: 'Мои объекты',
    items: [
      { label: 'Проекты', to: '/objects', icon: 'ph:buildings', accent: 'objects', can: 'objects.view' },
      { label: 'Шахматка', to: '/board', icon: 'ph:grid-nine', accent: 'objects', can: 'board.view' },
    ],
  },
  {
    label: 'Ценообразование',
    items: [{ label: 'Прайс-листы', to: '/pricing', icon: 'ph:tag', accent: 'price', can: 'pricing.view' }],
  },
  {
    label: 'Продажи',
    items: [
      { label: 'Заявки', to: '/leads', icon: 'ph:funnel', accent: 'sales', can: 'leads.work' },
      { label: 'Календарь', to: '/calendar', icon: 'ph:calendar-dots', accent: 'sales', can: 'calendar.view' },
      { label: 'Мастер сделок', to: '/deals/new', icon: 'ph:magic-wand', accent: 'sales', can: 'deals.create' },
      { label: 'Согласования', to: '/approvals', icon: 'ph:gavel', accent: 'reserve', can: 'approvals.view' },
      { label: 'Клиенты', to: '/clients', icon: 'ph:address-book', accent: 'sales', can: 'clients.view' },
    ],
  },
  {
    label: 'Договоры',
    items: [{ label: 'Список договоров', to: '/contracts', icon: 'ph:file-text', accent: 'docs', can: 'contracts.view' }],
  },
  {
    label: 'Платежи',
    items: [{ label: 'Доска оплат', to: '/payments', icon: 'ph:kanban', accent: 'finance', can: 'payments.view' }],
  },
  {
    label: 'Документы',
    items: [{ label: 'Сформированные документы', to: '/documents', icon: 'ph:files', accent: 'docs', can: 'documents.view' }],
  },
  {
    label: 'Отчёты',
    items: [{ label: 'Аналитика', to: '/reports', icon: 'ph:chart-line-up', accent: 'analytics', can: 'analytics.view' }],
  },
  {
    label: 'Пользователи',
    items: [
      { label: 'Права доступа', to: '/users', icon: 'ph:users-three', accent: 'users', can: 'users.manage' },
      { label: 'Офисы продаж', to: '/offices', icon: 'ph:storefront', accent: 'users', can: 'users.manage' },
    ],
  },
  {
    label: 'Настройки',
    items: [{ label: 'Все настройки', to: '/settings', icon: 'ph:gear-six', accent: 'system', can: 'settings.manage' }],
  },
]

/**
 * Цвет модуля. Иконка в меню работает ориентиром: раздел узнаётся по цвету
 * раньше, чем прочитано название, — поэтому роль задаётся в данных, а не
 * подбирается в компоненте.
 */
export type NavAccent =
  | 'objects' | 'price' | 'sales' | 'reserve' | 'finance' | 'docs' | 'analytics' | 'users' | 'system'

export interface NavItem {
  label: string
  to: string
  icon: string
  accent: NavAccent
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
      { label: 'Проекты', to: '/objects', icon: 'ph:buildings', accent: 'objects' },
      { label: 'Шахматка', to: '/board', icon: 'ph:grid-nine', accent: 'objects' },
    ],
  },
  {
    label: 'Ценообразование',
    items: [{ label: 'Прайс-листы', to: '/pricing', icon: 'ph:tag', accent: 'price' }],
  },
  {
    label: 'Продажи',
    items: [
      { label: 'Заявки', to: '/leads', icon: 'ph:funnel', accent: 'sales' },
      { label: 'Мастер сделок', to: '/deals/new', icon: 'ph:magic-wand', accent: 'sales' },
      { label: 'Согласования', to: '/approvals', icon: 'ph:gavel', accent: 'reserve' },
      { label: 'Клиенты', to: '/clients', icon: 'ph:address-book', accent: 'sales' },
    ],
  },
  {
    label: 'Договоры',
    items: [{ label: 'Список договоров', to: '/contracts', icon: 'ph:file-text', accent: 'docs' }],
  },
  {
    label: 'Платежи',
    items: [{ label: 'Доска оплат', to: '/payments', icon: 'ph:kanban', accent: 'finance' }],
  },
  {
    label: 'Документы',
    items: [{ label: 'Сформированные документы', to: '/documents', icon: 'ph:files', accent: 'docs' }],
  },
  {
    label: 'Отчёты',
    items: [{ label: 'Аналитика', to: '/reports', icon: 'ph:chart-line-up', accent: 'analytics' }],
  },
  {
    label: 'Пользователи',
    items: [
      { label: 'Права доступа', to: '/users', icon: 'ph:users-three', accent: 'users' },
      { label: 'Офисы продаж', to: '/offices', icon: 'ph:storefront', accent: 'users' },
    ],
  },
  {
    label: 'Настройки',
    items: [{ label: 'Все настройки', to: '/settings', icon: 'ph:gear-six', accent: 'system' }],
  },
]

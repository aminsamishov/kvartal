export interface NavItem {
  label: string
  to: string
  icon: string
}
export interface NavGroup {
  label?: string
  items: NavItem[]
}

export const NAV: NavGroup[] = [
  { items: [{ label: 'Дашборд', to: '/', icon: 'ph:squares-four' }] },
  {
    label: 'Мои объекты',
    items: [
      { label: 'Проекты', to: '/objects', icon: 'ph:buildings' },
      { label: 'Шахматка', to: '/board', icon: 'ph:grid-nine' },
    ],
  },
  {
    label: 'Ценообразование',
    items: [{ label: 'Прайс-листы', to: '/pricing', icon: 'ph:tag' }],
  },
  {
    label: 'Продажи',
    items: [
      { label: 'Заявки', to: '/leads', icon: 'ph:funnel' },
      { label: 'Мастер сделок', to: '/deals/new', icon: 'ph:magic-wand' },
      { label: 'Согласования', to: '/approvals', icon: 'ph:gavel' },
      { label: 'Клиенты', to: '/clients', icon: 'ph:address-book' },
    ],
  },
  {
    label: 'Договоры',
    items: [{ label: 'Список договоров', to: '/contracts', icon: 'ph:file-text' }],
  },
  {
    label: 'Платежи',
    items: [{ label: 'Доска оплат', to: '/payments', icon: 'ph:kanban' }],
  },
  {
    label: 'Документы',
    items: [{ label: 'Сформированные документы', to: '/documents', icon: 'ph:files' }],
  },
  {
    label: 'Отчёты',
    items: [{ label: 'Аналитика', to: '/reports', icon: 'ph:chart-line-up' }],
  },
  {
    label: 'Пользователи',
    items: [
      { label: 'Права доступа', to: '/users', icon: 'ph:users-three' },
      { label: 'Офисы продаж', to: '/offices', icon: 'ph:storefront' },
    ],
  },
  {
    label: 'Настройки',
    items: [{ label: 'Все настройки', to: '/settings', icon: 'ph:gear-six' }],
  },
]

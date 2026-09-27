export interface SettingsNavItem {
  slug: string
  label: string
  icon: string
  group: string
}

export const SETTINGS_NAV: SettingsNavItem[] = [
  { slug: 'templates', label: 'Шаблоны документов', icon: 'ph:files', group: 'Документы' },
  { slug: 'numerators', label: 'Нумераторы документов', icon: 'ph:hash', group: 'Документы' },
  { slug: 'payment-methods', label: 'Способы оплаты', icon: 'ph:credit-card', group: 'Продажи' },
  { slug: 'promotions', label: 'Акции', icon: 'ph:percent', group: 'Продажи' },
  { slug: 'options', label: 'Опции', icon: 'ph:package', group: 'Продажи' },
  { slug: 'statuses', label: 'Статусы', icon: 'ph:flag', group: 'Продажи' },
  { slug: 'calculator', label: 'Калькулятор условий покупки', icon: 'ph:calculator', group: 'Продажи' },
  { slug: 'deal-settings', label: 'Настройки Мастера сделок', icon: 'ph:magic-wand', group: 'Процессы' },
  { slug: 'account', label: 'Настройки аккаунта', icon: 'ph:buildings', group: 'Аккаунт' },
]

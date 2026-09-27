import { money } from '~/utils/format'

export interface AutomationRule {
  key: 'leadTask' | 'visitFollowUp' | 'reservationExpiry' | 'contractSchedule' | 'overdueAlert'
  title: string
  trigger: string
  action: string
  icon: string
}

/**
 * Бизнес-сценарии, которые система выполняет без менеджера. Описание держим
 * рядом с реализацией: экран настроек показывает ровно те правила, которые
 * действительно работают, а не список намерений.
 */
export const AUTOMATION_RULES: AutomationRule[] = [
  {
    key: 'leadTask', title: 'Задача на новую заявку',
    trigger: 'Создана заявка', action: 'Ставим «Первый звонок клиенту» на завтра',
    icon: 'ph:sparkle',
  },
  {
    key: 'visitFollowUp', title: 'Напоминание после показа',
    trigger: 'Показ отмечен выполненным', action: 'Через 24 часа — задача «Узнать впечатления после показа»',
    icon: 'ph:buildings',
  },
  {
    key: 'reservationExpiry', title: 'Снятие истёкшей брони',
    trigger: 'Истёк срок брони', action: 'Объект освобождается или уходит первому в очереди, менеджер получает уведомление',
    icon: 'ph:hourglass',
  },
  {
    key: 'contractSchedule', title: 'График платежей по договору',
    trigger: 'Договор подписан', action: 'Создаётся график платежей, заявка переводится в «Сделку»',
    icon: 'ph:file-text',
  },
  {
    key: 'overdueAlert', title: 'Оповещение о просрочке',
    trigger: 'Платёж не поступил в срок', action: 'Уведомление менеджеру и руководителю, договор — в «Требует внимания»',
    icon: 'ph:warning-circle',
  },
]

/**
 * Прогон отложенных правил. Часть автоматизаций срабатывает в момент действия
 * (задача при создании заявки, график при договоре), а часть зависит от
 * времени — их и проверяем при входе в приложение.
 */
export function runAutomations() {
  const settings = useSettingsStore()
  const sales = useSalesStore()
  const deals = useDealsStore()
  const units = useUnitsStore()
  const misc = useMiscStore()

  let expired = 0
  if (settings.automations.reservationExpiry) {
    const before = sales.reservations.filter((r) => r.status === 'active').map((r) => r.id)
    expired = sales.expireReservations()
    if (expired) {
      for (const r of sales.reservations.filter((x) => x.status === 'expired' && before.includes(x.id))) {
        const unit = units.unit(r.unitId)
        misc.notify({
          key: `auto-exp-${r.id}`,
          text: `Бронь истекла: ${unit ? `№ ${unit.number}` : 'объект'} — снята автоматически`,
          kind: 'reservation',
        })
      }
      misc.log('Автоматизации', `Снято истёкших броней: ${expired}`, 'Система')
    }
  }

  let overdue = 0
  if (settings.automations.overdueAlert) {
    for (const contract of deals.contracts) {
      if (contract.status !== 'active') continue
      const balance = deals.balance(contract.id)
      if (!balance.overdueAmount) continue
      overdue++
      misc.notify({
        key: `auto-overdue-${contract.id}-${balance.overdueDays}`,
        text: `Просрочка ${balance.overdueDays} дн. по договору ${contract.number} — ${money(balance.overdueAmount, contract.currency)}`,
        kind: 'payment',
      })
    }
  }

  return { expired, overdue }
}

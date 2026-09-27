import type { AgendaItem } from '~/utils/agenda'

/**
 * Куда ведёт клик по делу из повестки. Раньше любое дело вело ссылкой на
 * список заявок — менеджер попадал на доску и искал там ту же заявку руками.
 * Теперь дело открывает то, о чём оно: задача и показ — карточку заявки прямо
 * поверх текущего экрана, платёж и подписание — договор, бронь — помещение.
 *
 * Композабл общий для дашборда и календаря: поведение клика не должно
 * отличаться между двумя экранами, где лежит одна и та же лента.
 */
export function useAgendaOpen() {
  const leadId = ref<string | null>(null)
  const unitId = ref<string | null>(null)

  function open(item: AgendaItem) {
    if (item.leadId) { leadId.value = item.leadId; return }
    if (item.unitId) { unitId.value = item.unitId; return }
    if (item.contractId) { navigateTo(`/contracts/${item.contractId}`); return }
    if (item.to) navigateTo(item.to)
  }

  function close() {
    leadId.value = null
    unitId.value = null
  }

  return { leadId, unitId, open, close }
}

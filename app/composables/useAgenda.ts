import { addDays, buildAgenda, startOfDay, type AgendaItem } from '~/utils/agenda'

/**
 * Повестка за период с учётом роли. Менеджер видит свой день, руководитель —
 * день отдела: фильтр по ответственному живёт здесь, а не в каждом экране.
 */
export function useAgenda(from: Ref<Date>, to: Ref<Date>) {
  const salesStore = useSalesStore()
  const dealsStore = useDealsStore()
  const unitsStore = useUnitsStore()
  const { seesEveryone, myId } = useAccess()

  const all = computed(() => buildAgenda({
    leads: salesStore.leads,
    contracts: dealsStore.contracts,
    schedule: dealsStore.scheduleItems,
    reservations: salesStore.reservations,
    clientName: (id) => salesStore.client(id)?.name ?? 'клиент',
    unitOf: (id) => unitsStore.unit(id),
    contractOf: (id) => dealsStore.contract(id),
    ownerOfContract: (c) => (c.leadId ? salesStore.lead(c.leadId)?.assignedTo : undefined),
  }, from.value, to.value))

  /** Своё или всё: у руководителя лента отдела, у менеджера — только его. */
  const items = computed<AgendaItem[]>(() => (seesEveryone.value
    ? all.value
    : all.value.filter((i) => !i.assignedTo || i.assignedTo === myId.value)))

  return { items, all }
}

/** Повестка на сегодня — самый частый период, чтобы не собирать его руками. */
export function useTodayAgenda() {
  const from = computed(() => startOfDay(new Date()))
  const to = computed(() => addDays(from.value, 1))
  return useAgenda(from, to)
}

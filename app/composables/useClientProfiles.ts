import { buildClientProfile, type ClientProfile, type ProfileSources } from '~/utils/clientProfile'

/**
 * Досье клиентов, собранные из сторов. Один источник на весь модуль: таблица,
 * фильтры, карточка и экспорт читают одни и те же вычисленные значения —
 * поэтому в списке и в карточке не может оказаться разных сумм.
 */
export function useClientProfiles() {
  const salesStore = useSalesStore()
  const dealsStore = useDealsStore()
  const unitsStore = useUnitsStore()
  const settingsStore = useSettingsStore()

  const sources = computed<ProfileSources>(() => ({
    contracts: dealsStore.contracts,
    scheduleItems: dealsStore.scheduleItems,
    payments: dealsStore.payments,
    units: unitsStore.units,
    projects: unitsStore.projects,
    leads: salesStore.leads,
    reservations: salesStore.reservations,
    documents: salesStore.documents,
    users: settingsStore.users,
    now: new Date(),
  }))

  const profiles = computed<ClientProfile[]>(() =>
    salesStore.clients.map((c) => buildClientProfile(c, sources.value)))

  const byId = computed(() => new Map(profiles.value.map((p) => [p.client.id, p])))

  function profile(clientId: string | null | undefined) {
    return clientId ? byId.value.get(clientId) : undefined
  }

  return { profiles, profile, byId }
}

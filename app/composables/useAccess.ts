import type { Capability, Workspace } from '~/utils/access'
import { capsOf, WORKSPACE_OF } from '~/utils/access'

/**
 * Права текущего пользователя. Один источник для меню, маршрутов и кнопок:
 * если возможность закрыта, она не должна появляться ни в одном из трёх мест.
 */
export function useAccess() {
  const auth = useAuthStore()

  const role = computed(() => auth.user?.role)
  const caps = computed(() => capsOf(role.value))
  const workspace = computed<Workspace>(() => (role.value ? WORKSPACE_OF[role.value] : 'sales'))

  function can(cap: Capability) {
    return caps.value.has(cap)
  }

  /**
   * Видит ли человек чужие заявки и сделки. Своим участком ограничены только
   * продавцы: бухгалтеру и юристу «свои заявки» не назначают, и лента,
   * отфильтрованная по ним, оказалась бы пустой.
   */
  const seesEveryone = computed(() => workspace.value !== 'sales' || caps.value.has('leads.viewAll'))
  const myId = computed(() => auth.user?.id ?? '')

  /** Отбор по ответственному: руководителю — всё, менеджеру — своё. */
  function mine<T extends { assignedTo?: string }>(rows: T[]) {
    return seesEveryone.value ? rows : rows.filter((r) => r.assignedTo === myId.value)
  }

  return { role, caps, can, workspace, seesEveryone, myId, mine }
}

import type { LeadStage } from '~/types/models'

/**
 * Состояние перетаскивания карточек воронки. Живёт в useState, а не в пропсах:
 * тянут карточку в одной колонке, а подсветить нужно другую, и прокидывать это
 * через всё дерево ради одного флага не стоит.
 */
export function useLeadDnd() {
  const draggingId = useState<string | null>('lead-dnd-id', () => null)
  const draggingFrom = useState<LeadStage | null>('lead-dnd-from', () => null)
  const overStage = useState<LeadStage | null>('lead-dnd-over', () => null)

  function start(id: string, from: LeadStage) {
    draggingId.value = id
    draggingFrom.value = from
  }
  function end() {
    draggingId.value = null
    draggingFrom.value = null
    overStage.value = null
  }
  return { draggingId, draggingFrom, overStage, start, end }
}

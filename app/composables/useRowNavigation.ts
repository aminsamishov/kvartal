/**
 * Клавиатура в таблице: ↑/↓ ведут курсор по строкам, Enter открывает,
 * Esc снимает. Реестр на сотню строк листать мышью дольше, чем стрелками,
 * а руки менеджера и так на клавиатуре.
 */
export function useRowNavigation(options: {
  count: () => number
  onOpen?: (index: number) => void
  onToggle?: (index: number) => void
  /** пока открыт дровер или модалка, стрелки принадлежат им */
  enabled?: () => boolean
}) {
  const cursor = ref(-1)

  function clamp(i: number) {
    const n = options.count()
    if (!n) return -1
    return Math.min(n - 1, Math.max(0, i))
  }

  function focusRow(index: number) {
    cursor.value = clamp(index)
    nextTick(() => {
      const el = document.querySelector<HTMLElement>(`[data-row-index="${cursor.value}"]`)
      el?.scrollIntoView({ block: 'nearest' })
    })
  }

  function onKey(e: KeyboardEvent) {
    if (options.enabled && !options.enabled()) return
    const el = e.target as HTMLElement | null
    if (el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable)) return

    if (e.key === 'ArrowDown') { e.preventDefault(); focusRow(cursor.value + 1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusRow(cursor.value - 1) }
    else if (e.key === 'Home') { e.preventDefault(); focusRow(0) }
    else if (e.key === 'End') { e.preventDefault(); focusRow(options.count() - 1) }
    else if (e.key === 'Enter' && cursor.value >= 0) { e.preventDefault(); options.onOpen?.(cursor.value) }
    else if (e.key === ' ' && cursor.value >= 0 && options.onToggle) { e.preventDefault(); options.onToggle(cursor.value) }
    else if (e.key === 'Escape') cursor.value = -1
  }

  onMounted(() => window.addEventListener('keydown', onKey))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

  return { cursor, focusRow }
}

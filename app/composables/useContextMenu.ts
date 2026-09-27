/**
 * Состояние контекстного меню строки: где открыли и по какой записи.
 * Логика одинакова в каждом реестре, поэтому живёт отдельно от таблиц.
 */
export function useContextMenu<T>() {
  const x = ref<number | null>(null)
  const y = ref<number | null>(null)
  const row = ref<T | null>(null) as Ref<T | null>

  function open(event: MouseEvent, item: T) {
    event.preventDefault()
    x.value = event.clientX
    y.value = event.clientY
    row.value = item
  }

  function close() {
    x.value = null
    y.value = null
    row.value = null
  }

  return { x, y, row, open, close }
}

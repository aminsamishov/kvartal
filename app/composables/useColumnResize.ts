/**
 * Ширины колонок, которые пользователь настроил сам. В реестре у каждого своя
 * работа: кому-то важен телефон, кому-то — сумма договора, и таскать колонку
 * мышью привычнее, чем прятать её через меню.
 *
 * Ширины переживают перезагрузку: настроил один раз — работает дальше.
 */
export function useColumnResize(storageKey: string, defaults: Record<string, number> = {}) {
  const widths = ref<Record<string, number>>({ ...defaults })
  const active = ref<string | null>(null)

  const key = `inhouse:cols:${storageKey}`

  onMounted(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw) widths.value = { ...widths.value, ...JSON.parse(raw) as Record<string, number> }
    } catch {
      // приватный режим — таблица работает и с ширинами по умолчанию
    }
  })

  function persist() {
    try {
      localStorage.setItem(key, JSON.stringify(widths.value))
    } catch {
      // ignore
    }
  }

  /** Стиль ячейки: пока колонку не трогали, ширину задаёт содержимое. */
  function style(col: string, fallback?: string) {
    const w = widths.value[col]
    return w ? { width: `${w}px`, minWidth: `${w}px`, maxWidth: `${w}px` } : (fallback ? { minWidth: fallback } : {})
  }

  const MIN = 64

  function start(col: string, e: PointerEvent) {
    e.preventDefault()
    e.stopPropagation()
    const th = (e.target as HTMLElement).closest('th')
    const startX = e.clientX
    const startW = widths.value[col] ?? th?.getBoundingClientRect().width ?? 120
    active.value = col

    function move(ev: PointerEvent) {
      widths.value = { ...widths.value, [col]: Math.max(MIN, Math.round(startW + ev.clientX - startX)) }
    }
    function up() {
      active.value = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      persist()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  /** Двойной клик по ручке возвращает колонке автоширину. */
  function reset(col: string) {
    const next = { ...widths.value }
    delete next[col]
    widths.value = next
    persist()
  }

  function resetAll() {
    widths.value = { ...defaults }
    persist()
  }

  return { widths, active, style, start, reset, resetAll }
}

export interface HotkeyHandlers {
  /** B — забронировать выбранную квартиру */
  reserve?: () => void
  /** D — оформить договор */
  contract?: () => void
  /** C — сравнить выделенные */
  compare?: () => void
  /** Esc — закрыть/сбросить */
  escape?: () => void
  /** пока возвращает false, горячие клавиши молчат */
  enabled?: () => boolean
}

export const HOTKEY_HINTS = [
  { key: 'B', label: 'бронь' },
  { key: 'D', label: 'договор' },
  { key: 'C', label: 'сравнение' },
]

/**
 * Горячие клавиши подбора. Менеджер за день проходит один и тот же путь
 * «выбрал → забронировал → договор» десятки раз, и каждый раз тянуться к
 * кнопке мышью — это и есть те самые лишние клики.
 *
 * Буквы латиницей и кириллицей: раскладку никто не переключает ради брони.
 */
const MAP: Record<string, keyof HotkeyHandlers> = {
  b: 'reserve', и: 'reserve',
  d: 'contract', в: 'contract',
  c: 'compare', с: 'compare',
}

export function useHotkeys(handlers: HotkeyHandlers) {
  function onKey(e: KeyboardEvent) {
    if (handlers.enabled && !handlers.enabled()) return
    // в поле ввода буквы принадлежат тексту, а не интерфейсу
    const target = e.target as HTMLElement | null
    if (target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)) return
    if (e.metaKey || e.ctrlKey || e.altKey) return

    if (e.key === 'Escape') {
      if (!handlers.escape) return
      handlers.escape()
      return
    }

    const action = MAP[e.key.toLowerCase()]
    const fn = action ? handlers[action] : undefined
    if (typeof fn !== 'function') return
    e.preventDefault()
    fn()
  }

  onMounted(() => window.addEventListener('keydown', onKey))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
}

// Подписи областей разметки лежат прямо на цветной плашке, а цвет плашки
// задаёт пользователь (палитра этажей, статусы помещений). Жёстко белый текст
// проваливается на светлых цветах, поэтому выбираем чернила по яркости фона.

const DARK_INK = '#1A171D'

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  let h = m[1]!
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  return [
    Number.parseInt(h.slice(0, 2), 16),
    Number.parseInt(h.slice(2, 4), 16),
    Number.parseInt(h.slice(4, 6), 16),
  ]
}

/** Относительная яркость по WCAG, 0 (чёрный) … 1 (белый). */
export function luminance(hex: string): number | null {
  const rgb = parseHex(hex)
  if (!rgb) return null
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Читаемый цвет текста на плашке цвета `bg`.
 * Для значений вида `var(--…)` яркость неизвестна — там договорённость такая:
 * это всегда наши насыщенные fill-токены, на них белый текст корректен.
 */
export function readableInk(bg: string): string {
  const l = luminance(bg)
  if (l === null) return '#fff'
  // 0.18 — точка, где контраст к белому и к тёмным чернилам совпадает; выше неё
  // тёмный текст читается лучше. На этом же пороге построены --board-*-ink
  // (например, оранжевый --board-reserve носит тёмные чернила).
  return l > 0.18 ? DARK_INK : '#fff'
}

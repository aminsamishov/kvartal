// Детерминированный генератор случайных чисел (mulberry32).
// Нужен, чтобы мок-данные были одинаковыми на сервере и на клиенте при SSR —
// обычный Math.random() дал бы разные значения и сломал гидратацию.

export function makeRng(seed: number) {
  let a = seed >>> 0
  return function rng() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Rng = ReturnType<typeof makeRng>

export function rInt(rng: Rng, min: number, max: number) {
  return Math.floor(rng() * (max - min + 1)) + min
}

export function rPick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[rInt(rng, 0, arr.length - 1)] as T
}

export function rBool(rng: Rng, chance = 0.5) {
  return rng() < chance
}

export function rWeighted<T>(rng: Rng, entries: [T, number][]): T {
  const total = entries.reduce((s, [, w]) => s + w, 0)
  let x = rng() * total
  for (const [value, weight] of entries) {
    if (x < weight) return value
    x -= weight
  }
  return entries[entries.length - 1]![0]
}

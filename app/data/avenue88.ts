import type { Building, ExplicationRoom, Unit } from '~/types/models'

/**
 * Каталог планировок ЖК Avenue 88 — из рабочих чертежей застройщика.
 *
 * Типы названы так же, как в буклете: первая цифра — комнатность, буква —
 * позиция на этаже, блок — подъезд. Экспликации перенесены построчно из
 * таблиц на листах планировок, площади до сотых. Ничего не округляли и не
 * досочиняли: если менеджер сверит карточку с буклетом, цифры сойдутся.
 *
 * «Студия» в названии — не студия в привычном смысле, а евроформат из
 * буклета: кухня-гостиная плюс спальни. Комнатность у них та же, что и у
 * обычных типов с той же цифрой.
 */

function rooms(id: string, list: [string, ExplicationRoom['kind'], number][]): ExplicationRoom[] {
  return list.map(([name, kind, area], i) => ({ id: `${id}-r${i + 1}`, name, kind, area }))
}

export const AVENUE88_PRESETS: Building['unitTypePresets'] = [
  {
    id: 'av88-a-2a', name: '2А · блок А', rooms: 2, area: 75.68,
    imageUrl: null, orientation: [], visible: true, roomZones: [],
    explication: rooms('av88-a-2a', [
      ['Холл', 'hall', 10.28],
      ['Туалет', 'bath', 2.47],
      ['Кухня', 'kitchen', 16.87],
      ['Гостиная', 'living', 22.86],
      ['Лоджия', 'balcony', 4.27],
      ['Спальня', 'living', 15.36],
      ['Санузел', 'bath', 3.57],
    ]),
  },
  {
    id: 'av88-a-2b', name: '2Б · блок А', rooms: 2, area: 76.03,
    imageUrl: null, orientation: [], visible: true, roomZones: [],
    explication: rooms('av88-a-2b', [
      ['Холл', 'hall', 11.76],
      ['Туалет', 'bath', 2.13],
      ['Спальня', 'living', 15.04],
      ['Лоджия', 'balcony', 4.27],
      ['Гостиная', 'living', 22.85],
      ['Кухня', 'kitchen', 16.81],
      ['Санузел', 'bath', 3.17],
    ]),
  },
  {
    id: 'av88-a-2v', name: '2В · блок А', rooms: 2, area: 77.11,
    imageUrl: null, orientation: [], visible: true, roomZones: [],
    explication: rooms('av88-a-2v', [
      ['Холл', 'hall', 12.54],
      ['Туалет', 'bath', 1.89],
      ['Гостиная', 'living', 21.88],
      ['Кухня', 'kitchen', 16.10],
      ['Спальня', 'living', 16.17],
      ['Лоджия', 'balcony', 4.57],
      ['Санузел', 'bath', 3.96],
    ]),
  },
  {
    id: 'av88-a-3g-st', name: '3Г (студия) · блок А', rooms: 3, area: 96.65,
    imageUrl: null, orientation: [], visible: true, roomZones: [],
    explication: rooms('av88-a-3g-st', [
      ['Холл', 'hall', 12.39],
      ['Мастер-спальня', 'living', 22.00],
      ['Балкон', 'balcony', 5.32],
      ['Гардероб', 'storage', 4.91],
      ['Санузел', 'bath', 4.20],
      ['Кухня-гостиная', 'kitchen', 24.07],
      ['Спальня', 'living', 15.24],
      ['Лоджия', 'balcony', 4.62],
      ['Санузел', 'bath', 3.90],
    ]),
  },
  {
    id: 'av88-b-1b', name: '1Б · блок Б', rooms: 1, area: 54.7,
    imageUrl: null, orientation: [], visible: true, roomZones: [],
    explication: rooms('av88-b-1b', [
      ['Холл', 'hall', 7.83],
      ['Санузел', 'bath', 3.60],
      ['Кухня', 'kitchen', 18.29],
      ['Лоджия', 'balcony', 3.90],
      ['Гостиная', 'living', 21.08],
    ]),
  },
  {
    id: 'av88-b-2b', name: '2Б · блок Б', rooms: 2, area: 82.59,
    imageUrl: null, orientation: [], visible: true, roomZones: [],
    explication: rooms('av88-b-2b', [
      ['Холл', 'hall', 13.12],
      ['Санузел', 'bath', 3.60],
      ['Кухня', 'kitchen', 18.29],
      ['Лоджия', 'balcony', 3.90],
      ['Гостиная', 'living', 21.74],
      ['Спальня', 'living', 20.42],
      ['Туалет', 'bath', 1.52],
    ]),
  },
  {
    id: 'av88-b-3a-st', name: '3А (студия) · блок Б', rooms: 3, area: 93.09,
    imageUrl: null, orientation: [], visible: true, roomZones: [],
    explication: rooms('av88-b-3a-st', [
      ['Холл', 'hall', 13.32],
      ['Санузел', 'bath', 3.58],
      ['Спальня', 'living', 15.02],
      ['Кухня-гостиная', 'kitchen', 24.07],
      ['Мастер-спальня', 'living', 23.09],
      ['Лоджия', 'balcony', 4.90],
      ['Гардероб', 'storage', 4.91],
      ['Санузел', 'bath', 4.20],
    ]),
  },
  {
    id: 'av88-b-3v', name: '3В · блок Б', rooms: 3, area: 112.23,
    imageUrl: null, orientation: [], visible: true, roomZones: [],
    explication: rooms('av88-b-3v', [
      ['Холл', 'hall', 18.41],
      ['Туалет', 'bath', 2.40],
      ['Спальня', 'living', 15.36],
      ['Гостиная', 'living', 33.34],
      ['Кухня', 'kitchen', 15.58],
      ['Лоджия', 'balcony', 4.71],
      ['Детская', 'living', 16.51],
      ['Гардероб', 'storage', 2.53],
      ['С/У', 'bath', 3.39],
    ]),
  },
  {
    id: 'av88-b-3g', name: '3Г · блок Б', rooms: 3, area: 116.82,
    imageUrl: null, orientation: [], visible: true, roomZones: [],
    explication: rooms('av88-b-3g', [
      ['Холл', 'hall', 15.69],
      ['Санузел', 'bath', 4.32],
      ['Гостиная', 'living', 23.17],
      ['Кухня', 'kitchen', 18.59],
      ['Лоджия', 'balcony', 4.41],
      ['Спальня', 'living', 16.95],
      ['Балкон', 'balcony', 5.32],
      ['Мастер-спальня', 'living', 19.37],
      ['Гардероб', 'storage', 5.05],
      ['Санузел', 'bath', 3.95],
    ]),
  },
  {
    id: 'av88-b-4v', name: '4В · блок Б', rooms: 4, area: 139.39,
    imageUrl: null, orientation: [], visible: true, roomZones: [],
    explication: rooms('av88-b-4v', [
      ['Холл', 'hall', 18.08],
      ['Мастер-спальня', 'living', 21.53],
      ['Санузел', 'bath', 4.62],
      ['Гардероб', 'storage', 4.76],
      ['Спальня', 'living', 14.54],
      ['Гостиная', 'living', 33.34],
      ['Кухня', 'kitchen', 15.58],
      ['Лоджия', 'balcony', 4.71],
      ['Детская', 'living', 16.51],
      ['Санузел', 'bath', 3.70],
      ['Туалет', 'bath', 2.02],
    ]),
  },
  {
    id: 'av88-v-1b', name: '1Б · блок В', rooms: 1, area: 50.5,
    imageUrl: null, orientation: [], visible: true, roomZones: [],
    explication: rooms('av88-v-1b', [
      ['Холл', 'hall', 9.38],
      ['Санузел', 'bath', 3.57],
      ['Гостиная', 'living', 18.63],
      ['Кухня', 'kitchen', 14.45],
      ['Лоджия', 'balcony', 4.47],
    ]),
  },
  {
    id: 'av88-v-1v', name: '1В · блок В', rooms: 1, area: 45.91,
    imageUrl: null, orientation: [], visible: true, roomZones: [],
    explication: rooms('av88-v-1v', [
      ['Холл', 'hall', 5.40],
      ['Гостиная', 'living', 21.12],
      ['Кухня', 'kitchen', 11.89],
      ['Лоджия', 'balcony', 4.00],
      ['Санузел', 'bath', 3.50],
    ]),
  },
  {
    id: 'av88-v-1g', name: '1Г · блок В', rooms: 1, area: 50.5,
    imageUrl: null, orientation: [], visible: true, roomZones: [],
    explication: rooms('av88-v-1g', [
      ['Холл', 'hall', 9.38],
      ['Кухня', 'kitchen', 14.45],
      ['Лоджия', 'balcony', 4.86],
      ['Гостиная', 'living', 18.24],
      ['Санузел', 'bath', 3.57],
    ]),
  },
  {
    id: 'av88-v-3a', name: '3А · блок В', rooms: 3, area: 99.51,
    imageUrl: null, orientation: [], visible: true, roomZones: [],
    explication: rooms('av88-v-3a', [
      ['Холл', 'hall', 16.74],
      ['Кухня', 'kitchen', 12.34],
      ['Лоджия', 'balcony', 4.31],
      ['Гостиная', 'living', 21.44],
      ['Спальня', 'living', 19.17],
      ['Туалет', 'bath', 2.28],
      ['Санузел', 'bath', 4.06],
      ['Спальня', 'living', 19.17],
    ]),
  },
  {
    id: 'av88-v-3d', name: '3Д · блок В', rooms: 3, area: 98.57,
    imageUrl: null, orientation: [], visible: true, roomZones: [],
    explication: rooms('av88-v-3d', [
      ['Холл', 'hall', 17.00],
      ['Спальня', 'living', 18.60],
      ['Санузел', 'bath', 3.87],
      ['Туалет', 'bath', 2.28],
      ['Спальня', 'living', 18.60],
      ['Гостиная', 'living', 21.44],
      ['Кухня', 'kitchen', 12.34],
      ['Лоджия', 'balcony', 4.44],
    ]),
  },
]

/**
 * Типовой этаж: какой тип в каком блоке и в каком порядке слева направо.
 *
 * На чертежах два варианта плана. Они отличаются только блоком Б: в первом
 * там 2Б и трёхкомнатная 3В, во втором на их месте однокомнатная 1Б и
 * четырёхкомнатная 4В. Блоки А и В в обоих вариантах одинаковые.
 */
export const AVENUE88_PLATES: { block: 'А' | 'Б' | 'В'; presetId: string }[][] = [
  [
    { block: 'А', presetId: 'av88-a-2a' },
    { block: 'А', presetId: 'av88-a-2b' },
    { block: 'А', presetId: 'av88-a-2v' },
    { block: 'А', presetId: 'av88-a-3g-st' },
    { block: 'Б', presetId: 'av88-b-3a-st' },
    { block: 'Б', presetId: 'av88-b-2b' },
    { block: 'Б', presetId: 'av88-b-3v' },
    { block: 'Б', presetId: 'av88-b-3g' },
    { block: 'В', presetId: 'av88-v-3a' },
    { block: 'В', presetId: 'av88-v-1b' },
    { block: 'В', presetId: 'av88-v-1v' },
    { block: 'В', presetId: 'av88-v-1g' },
    { block: 'В', presetId: 'av88-v-3d' },
  ],
  [
    { block: 'А', presetId: 'av88-a-2a' },
    { block: 'А', presetId: 'av88-a-2b' },
    { block: 'А', presetId: 'av88-a-2v' },
    { block: 'А', presetId: 'av88-a-3g-st' },
    { block: 'Б', presetId: 'av88-b-3a-st' },
    { block: 'Б', presetId: 'av88-b-1b' },
    { block: 'Б', presetId: 'av88-b-4v' },
    { block: 'Б', presetId: 'av88-b-3g' },
    { block: 'В', presetId: 'av88-v-3a' },
    { block: 'В', presetId: 'av88-v-1b' },
    { block: 'В', presetId: 'av88-v-1v' },
    { block: 'В', presetId: 'av88-v-1g' },
    { block: 'В', presetId: 'av88-v-3d' },
  ],
]

/* --------------------------- проект и дом -------------------------------- */

/** Жилые этажи: 1–2 отданы под коммерцию, квартиры начинаются с третьего. */
export const AV88_FIRST_LIVING = 3
export const AV88_LIVING_FLOORS = 9
export const AV88_TOP = AV88_FIRST_LIVING + AV88_LIVING_FLOORS - 1

/**
 * Средний прайс 1 500 $/м². По этажам он расходится на ±6% — квартира на
 * третьем стоит 1 410 $/м², на одиннадцатом 1 590 $/м², а средняя по дому
 * ровно та, что назвал застройщик. Никакого случайного разброса: прайс
 * должен сходиться, когда менеджер пересчитает его на калькуляторе.
 */
export const AV88_PRICE_M2 = 1500
export function av88PerM2(floor: number) {
  const span = AV88_TOP - AV88_FIRST_LIVING
  const k = span ? (floor - AV88_FIRST_LIVING) / span : 0.5
  return Math.round(AV88_PRICE_M2 * (0.94 + k * 0.12))
}

export const BLOCK_SECTION: Record<'А' | 'Б' | 'В', number> = { А: 1, Б: 2, В: 3 }

/* ------------------------------- фонд ------------------------------------ */

/**
 * Фонд Avenue 88 целиком, без случайных чисел.
 *
 * Квартиры собираются по настоящему плану этажа: 13 штук, по блокам А-Б-В,
 * площади и комнатность — из каталога планировок выше. Поэтому шахматка
 * сходится с буклетом поквартирно, а не «примерно похожа».
 */
export function avenue88Units(input: {
  buildingId: string
  projectId: string
  /** номера проданных квартир — остальное свободно */
  sold: string[]
  parkingPerLevel: number
  commercialPerFloor: number
}): Unit[] {
  const units: Unit[] = []
  const presets = new Map(AVENUE88_PRESETS.map((p) => [p.id, p]))
  const sold = new Set(input.sold)

  // коммерция на 1–2 этажах: планов этих этажей в буклетах нет, поэтому
  // помещения заведены каркасом — нарезка и площади уточняются по обмерам
  for (let floor = 1; floor < AV88_FIRST_LIVING; floor++) {
    for (let i = 1; i <= input.commercialPerFloor; i++) {
      const area = 60 + (i - 1) * 24
      const price = Math.round((area * av88PerM2(AV88_FIRST_LIVING) * 1.35) / 10) * 10
      const number = `К-${floor}${String(i).padStart(2, '0')}`
      units.push({
        id: `${input.buildingId}-${number}`, number, buildingId: input.buildingId, projectId: input.projectId,
        section: Math.min(3, Math.ceil(i / 2)), floor, kind: 'commercial', rooms: 0, area,
        status: sold.has(number) ? 'sold' : 'free', price, basePrice: price, finishing: 'none',
      })
    }
  }

  // квартиры: два варианта плана этажа, они отличаются только блоком Б
  for (let floor = AV88_FIRST_LIVING; floor <= AV88_TOP; floor++) {
    const plate = AVENUE88_PLATES[floor <= 7 ? 0 : 1]!
    const perM2 = av88PerM2(floor)
    plate.forEach((cell, i) => {
      const preset = presets.get(cell.presetId)
      if (!preset) return
      const number = `${floor}${String(i + 1).padStart(2, '0')}`
      const price = Math.round((preset.area * perM2) / 10) * 10
      units.push({
        id: `${input.buildingId}-${number}`, number, buildingId: input.buildingId, projectId: input.projectId,
        section: BLOCK_SECTION[cell.block], floor, kind: 'apartment', rooms: preset.rooms, area: preset.area,
        status: sold.has(number) ? 'sold' : 'free', price, basePrice: price, finishing: 'none',
        layoutName: preset.name, layoutPresetId: preset.id, explication: preset.explication,
      })
    })
  }

  // паркинг на двух подземных уровнях
  for (const level of [-1, -2]) {
    for (let i = 1; i <= input.parkingPerLevel; i++) {
      const number = `P${Math.abs(level)}-${String(i).padStart(2, '0')}`
      units.push({
        id: `${input.buildingId}-${number}`, number, buildingId: input.buildingId, projectId: input.projectId,
        section: 0, floor: level, kind: 'parking', rooms: 0, area: 13.5,
        status: sold.has(number) ? 'sold' : 'free', price: 13000, basePrice: 13000, finishing: 'none',
      })
    }
  }

  return units
}

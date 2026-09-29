import type { ExplicationRoom, RoomKind, Unit, UnitStatus, UnitTypePreset } from '~/types/models'

/**
 * ЖК «Айни Ороз» — настоящий объект застройщика: буклет, поэтажные планы и
 * рендеры. Всё, что здесь описано, взято из документов, а не придумано:
 * площади комнат сходятся с экспликацией буклета до сотых, нумерация квартир
 * повторяет поэтажные планы.
 *
 * Генератор мок-данных остаётся для объёма — на нём живут вторые ЖК. Но
 * главный объект в демонстрации должен быть настоящим: на выдуманных
 * планировках не видно, работает ли разметка комнат и экспликация на том,
 * что реально приходит от застройщика.
 *
 * Изображения собираются скриптом scripts/build-media.sh из папки с буклетом.
 */

/** Ярусы: планировки блоков на этих группах этажей различаются. */
export type AiniTier = 't3' | 't4-7' | 't8-14'

export function tierOfFloor(floor: number): AiniTier {
  if (floor <= 3) return 't3'
  if (floor <= 7) return 't4-7'
  return 't8-14'
}

export const AINI_FLOORS = 14
/** Жильё начинается с третьего этажа: ниже коммерция и паркинг. */
export const AINI_FIRST_LIVING = 3

type Row = [name: string, kind: RoomKind, area: number]

export interface AiniType {
  id: string
  /** литер из буклета: «2А», «3Г студия» */
  code: string
  name: string
  rooms: number
  area: number
  /** блок, в котором эта планировка встречается: a | b | v */
  block: 'a' | 'b' | 'v'
  /** файл 3D-планировки в public/media/aini/layouts без яруса */
  art: string
  /**
   * Ярус, с которого берётся изображение. По умолчанию средний (4–7) — он
   * занимает больше всего этажей. У планировок, которые есть только наверху,
   * указан явно: на среднем ярусе такого файла просто нет.
   */
  tier?: AiniTier
  rows: Row[]
}

/**
 * Экспликации переписаны из буклета построчно. Порядок строк сохранён — он же
 * порядок нумерации помещений в документах застройщика.
 */
export const AINI_TYPES: AiniType[] = [
  /* ------------------------------ блок А ------------------------------ */
  {
    id: 'aini-2a', code: '2А', name: '2-комн. 2А', rooms: 2, area: 75.68, block: 'a', art: 'a-2a',
    rows: [
      ['Холл', 'hall', 10.28], ['Туалет', 'bath', 2.47], ['Кухня', 'kitchen', 16.87],
      ['Гостиная', 'living', 22.86], ['Лоджия', 'balcony', 4.27], ['Спальня', 'living', 15.36],
      ['Санузел', 'bath', 3.57],
    ],
  },
  {
    id: 'aini-2b-a', code: '2Б', name: '2-комн. 2Б', rooms: 2, area: 75.97, block: 'a', art: 'a-2b',
    rows: [
      ['Холл', 'hall', 11.77], ['Туалет', 'bath', 2.13], ['Спальня', 'living', 15.04],
      ['Лоджия', 'balcony', 4.27], ['Гостиная', 'living', 22.85], ['Кухня', 'kitchen', 16.74],
      ['Санузел', 'bath', 3.17],
    ],
  },
  {
    id: 'aini-2v', code: '2В', name: '2-комн. 2В', rooms: 2, area: 77.04, block: 'a', art: 'a-2v',
    rows: [
      ['Холл', 'hall', 12.54], ['Туалет', 'bath', 1.89], ['Гостиная', 'living', 21.81],
      ['Кухня', 'kitchen', 16.10], ['Спальня', 'living', 16.17], ['Лоджия', 'balcony', 4.57],
      ['Санузел', 'bath', 3.96],
    ],
  },
  {
    id: 'aini-3g-studio', code: '3Г студия', name: '3-комн. 3Г студия', rooms: 3, area: 96.65, block: 'a', art: 'a-3g-studio',
    rows: [
      ['Холл', 'hall', 12.39], ['Мастер-спальня', 'living', 22.00], ['Балкон', 'balcony', 5.32],
      ['Гардероб', 'storage', 4.91], ['Санузел', 'bath', 4.20], ['Кухня-гостиная', 'kitchen', 24.07],
      ['Спальня', 'living', 15.24], ['Лоджия', 'balcony', 4.62], ['Санузел', 'bath', 3.90],
    ],
  },

  /* ------------------------------ блок Б ------------------------------ */
  {
    id: 'aini-3a-studio', code: '3А студия', name: '3-комн. 3А студия', rooms: 3, area: 93.09, block: 'b', art: 'b-3a-studio',
    rows: [
      ['Холл', 'hall', 13.32], ['Санузел', 'bath', 3.58], ['Спальня', 'living', 15.02],
      ['Кухня-гостиная', 'kitchen', 24.07], ['Мастер-спальня', 'living', 23.09], ['Лоджия', 'balcony', 4.90],
      ['Гардероб', 'storage', 4.91], ['Санузел', 'bath', 4.20],
    ],
  },
  {
    id: 'aini-2b-b', code: '2Б', name: '2-комн. 2Б (блок Б)', rooms: 2, area: 82.59, block: 'b', art: 'b-2b',
    rows: [
      ['Холл', 'hall', 13.12], ['Санузел', 'bath', 3.60], ['Кухня', 'kitchen', 18.29],
      ['Лоджия', 'balcony', 3.90], ['Гостиная', 'living', 21.74], ['Спальня', 'living', 20.42],
      ['Туалет', 'bath', 1.52],
    ],
  },
  {
    id: 'aini-3v', code: '3В', name: '3-комн. 3В', rooms: 3, area: 112.23, block: 'b', art: 'b-3v',
    rows: [
      ['Холл', 'hall', 18.41], ['Туалет', 'bath', 2.40], ['Спальня', 'living', 15.36],
      ['Гостиная', 'living', 33.34], ['Кухня', 'kitchen', 15.58], ['Лоджия', 'balcony', 4.71],
      ['Детская', 'living', 16.51], ['Гардероб', 'storage', 2.53], ['С/У', 'bath', 3.39],
    ],
  },
  {
    id: 'aini-3g', code: '3Г', name: '3-комн. 3Г', rooms: 3, area: 116.81, block: 'b', art: 'b-3g',
    rows: [
      ['Холл', 'hall', 15.69], ['Санузел', 'bath', 4.32], ['Гостиная', 'living', 23.17],
      ['Кухня', 'kitchen', 18.59], ['Лоджия', 'balcony', 4.40], ['Спальня', 'living', 16.95],
      ['Балкон', 'balcony', 5.32], ['Мастер-спальня', 'living', 19.37], ['Гардероб', 'storage', 5.05],
      ['Санузел', 'bath', 3.95],
    ],
  },
  // верхние этажи блока Б перепланированы: двушка ужалась, а трёшка стала
  // четырёхкомнатной — это реальная разница яруса 8–14, а не ошибка данных
  {
    id: 'aini-2b-mini', code: '2Б', name: '2-комн. 2Б компактная', rooms: 2, area: 54.70, block: 'b', art: 'b-2b', tier: 't8-14',
    rows: [
      ['Холл', 'hall', 7.83], ['Гостиная', 'living', 21.08], ['Кухня', 'kitchen', 18.29],
      ['Лоджия', 'balcony', 3.90], ['Ванная', 'bath', 3.60],
    ],
  },
  {
    id: 'aini-4v', code: '4В', name: '4-комн. 4В', rooms: 4, area: 139.39, block: 'b', art: 'b-4v', tier: 't8-14',
    rows: [
      ['Холл', 'hall', 18.08], ['Гостиная', 'living', 33.34], ['Кухня', 'kitchen', 15.58],
      ['Лоджия', 'balcony', 4.71], ['Детская', 'living', 16.51], ['Спальня', 'living', 14.54],
      ['Спальня', 'living', 21.53], ['Гардеробная', 'storage', 4.76], ['Ванная', 'bath', 3.70],
      ['Ванная', 'bath', 4.62], ['С/У', 'bath', 2.02],
    ],
  },

  /* ------------------------------ блок В ------------------------------ */
  {
    id: 'aini-3a', code: '3А', name: '3-комн. 3А', rooms: 3, area: 99.51, block: 'v', art: 'v-3a',
    rows: [
      ['Холл', 'hall', 16.74], ['Кухня', 'kitchen', 12.34], ['Лоджия', 'balcony', 4.31],
      ['Гостиная', 'living', 21.44], ['Спальня', 'living', 19.17], ['Туалет', 'bath', 2.28],
      ['С/У', 'bath', 4.06], ['Спальня', 'living', 19.17],
    ],
  },
  {
    id: 'aini-1b', code: '1Б', name: '1-комн. 1Б', rooms: 1, area: 50.50, block: 'v', art: 'v-1b',
    rows: [
      ['Холл', 'hall', 9.38], ['Санузел', 'bath', 3.57], ['Гостиная', 'living', 18.63],
      ['Кухня', 'kitchen', 14.45], ['Лоджия', 'balcony', 4.47],
    ],
  },
  {
    id: 'aini-1v', code: '1В', name: '1-комн. 1В', rooms: 1, area: 45.91, block: 'v', art: 'v-1v',
    rows: [
      ['Холл', 'hall', 5.40], ['Гостиная', 'living', 21.12], ['Кухня', 'kitchen', 11.89],
      ['Лоджия', 'balcony', 4.00], ['С/У', 'bath', 3.50],
    ],
  },
  {
    id: 'aini-1g', code: '1Г', name: '1-комн. 1Г', rooms: 1, area: 50.50, block: 'v', art: 'v-1g',
    rows: [
      ['Холл', 'hall', 9.38], ['Кухня', 'kitchen', 14.45], ['Лоджия', 'balcony', 4.86],
      ['Гостиная', 'living', 18.24], ['С/У', 'bath', 3.57],
    ],
  },
  {
    id: 'aini-3d', code: '3Д', name: '3-комн. 3Д', rooms: 3, area: 98.57, block: 'v', art: 'v-3d',
    rows: [
      ['Холл', 'hall', 17.00], ['Спальня', 'living', 18.60], ['Санузел', 'bath', 3.87],
      ['Туалет', 'bath', 2.28], ['Спальня', 'living', 18.60], ['Гостиная', 'living', 21.44],
      ['Кухня', 'kitchen', 12.34], ['Лоджия', 'balcony', 4.44],
    ],
  },
]

export const AINI_TYPE_BY_ID = new Map(AINI_TYPES.map((t) => [t.id, t]))

/**
 * Состав этажа по подъездам. Порядок — это порядок нумерации квартир в
 * поэтажных планах: в первом подъезде квартиры 1–48, во втором 49–96,
 * в третьем 97–156.
 */
export const AINI_SECTIONS: { section: number; block: 'a' | 'b' | 'v'; typeIds: string[]; upper?: string[] }[] = [
  { section: 1, block: 'a', typeIds: ['aini-2a', 'aini-2b-a', 'aini-2v', 'aini-3g-studio'] },
  {
    section: 2, block: 'b',
    typeIds: ['aini-3a-studio', 'aini-2b-b', 'aini-3v', 'aini-3g'],
    upper: ['aini-3a-studio', 'aini-2b-mini', 'aini-4v', 'aini-3g'],
  },
  { section: 3, block: 'v', typeIds: ['aini-3a', 'aini-1b', 'aini-1v', 'aini-1g', 'aini-3d'] },
]

/** Сколько квартир на этаже — 13, как в поэтажном плане. */
export const AINI_PER_FLOOR = AINI_SECTIONS.reduce((n, s) => n + s.typeIds.length, 0)

/** Типы на конкретном этаже: с восьмого у блока Б другой набор. */
export function typesOnFloor(section: typeof AINI_SECTIONS[number], floor: number) {
  return floor >= 8 && section.upper ? section.upper : section.typeIds
}

/**
 * Номер квартиры. В каждом подъезде своя непрерывная нумерация снизу вверх,
 * начинающаяся там, где кончился предыдущий, — ровно как в буклете.
 */
export function unitNumber(sectionIndex: number, floor: number, indexOnFloor: number) {
  let base = 0
  for (let i = 0; i < sectionIndex; i++) {
    base += AINI_SECTIONS[i]!.typeIds.length * (AINI_FLOORS - AINI_FIRST_LIVING + 1)
  }
  const perFloor = AINI_SECTIONS[sectionIndex]!.typeIds.length
  return base + (floor - AINI_FIRST_LIVING) * perFloor + indexOnFloor + 1
}

/* ------------------------------ изображения ------------------------------ */

export const AINI_MEDIA = '/media/aini'

export function ainiLayoutImage(type: AiniType, tier?: AiniTier) {
  return `${AINI_MEDIA}/layouts/${tier ?? type.tier ?? 't4-7'}-${type.art}.jpg`
}
export function ainiFloorImage(floor: number) {
  return `${AINI_MEDIA}/floors/${tierOfFloor(floor)}.jpg`
}
export function ainiRender(n: number) {
  return `${AINI_MEDIA}/renders/${String(n).padStart(2, '0')}.jpg`
}

/* -------------------------------- пресеты -------------------------------- */

function explicationOf(type: AiniType): ExplicationRoom[] {
  return type.rows.map(([name, kind, area], i) => ({
    id: `${type.id}-r${i + 1}`,
    name, kind, area,
  }))
}

/**
 * Планировки помещений для карточки дома. Изображение — 3D-развёртка из
 * буклета: по ней видно и планировку, и отделку, а ориентироваться в ней
 * покупателю проще, чем в чертеже.
 */
export function ainiPresets(): UnitTypePreset[] {
  const ORIENTATION: Record<string, ('С' | 'Ю' | 'В' | 'З')[]> = {
    a: ['Ю', 'В'], b: ['С', 'З'], v: ['Ю', 'З'],
  }
  return AINI_TYPES.map((t) => ({
    id: t.id,
    name: t.name,
    rooms: t.rooms,
    area: t.area,
    imageUrl: ainiLayoutImage(t),
    orientation: ORIENTATION[t.block] ?? ['Ю'],
    visible: true,
    explication: explicationOf(t),
    // разметку комнат на 3D-развёртке застройщик не присылает: её рисует
    // менеджер поверх картинки в редакторе планировок
    roomZones: [],
  }))
}

/* --------------------------------- фонд ---------------------------------- */

/**
 * Цены буклет не содержит — это единственное, чего в документах застройщика
 * нет. Считаем по прозрачной формуле: базовая ставка за м², надбавка за этаж
 * (выше — дороже) и за компактность (маленькие квартиры дороже в пересчёте на
 * метр). Подставить настоящий прайс-лист можно, не трогая остальное.
 */
const AINI_BASE_M2 = 1150

function perM2(floor: number, area: number) {
  const floorFactor = 1 + ((floor - AINI_FIRST_LIVING) / (AINI_FLOORS - AINI_FIRST_LIVING)) * 0.14
  const sizeFactor = area < 60 ? 1.08 : area > 110 ? 0.95 : 1
  return Math.round(AINI_BASE_M2 * floorFactor * sizeFactor)
}

/**
 * Статус помещения. Без генератора случайных чисел: раскладка должна быть
 * одинаковой при каждой загрузке, иначе шахматка «дышит» между перезагрузками
 * и по ней нельзя ничего показать дважды. Картина продаж обычная для середины
 * стройки — нижние этажи разобраны, верхние ещё свободны.
 */
function statusOf(number: number, floor: number): UnitStatus {
  const h = (number * 2654435761) % 100
  const sold = Math.max(8, 58 - (floor - AINI_FIRST_LIVING) * 4)
  if (h < sold * 0.45) return 'sold'
  if (h < sold * 0.85) return 'installment'
  if (h < sold) return 'reserved'
  if (h > 96) return 'closed'
  return 'free'
}

export function ainiUnits(input: { buildingId: string; projectId: string }): Unit[] {
  const units: Unit[] = []
  const { buildingId, projectId } = input

  // коммерция на 1–2 этажах: планов этих этажей в буклете нет, помещения
  // заведены каркасом — нарезку и площади уточняют по обмерам
  for (let floor = 1; floor < AINI_FIRST_LIVING; floor++) {
    for (let i = 1; i <= 5; i++) {
      const area = 58 + (i - 1) * 26
      const number = `К-${floor}${String(i).padStart(2, '0')}`
      const price = Math.round((area * perM2(AINI_FIRST_LIVING, area) * 1.4) / 10) * 10
      units.push({
        id: `${buildingId}-${number}`, number, buildingId, projectId,
        section: Math.min(3, Math.ceil(i / 2)), floor, kind: 'commercial', rooms: 0, area,
        status: statusOf(floor * 100 + i, AINI_FIRST_LIVING), price, basePrice: price, finishing: 'none',
      })
    }
  }

  // жильё: этажи 3–14, три подъезда, 13 квартир на этаже
  for (let si = 0; si < AINI_SECTIONS.length; si++) {
    const section = AINI_SECTIONS[si]!
    for (let floor = AINI_FIRST_LIVING; floor <= AINI_FLOORS; floor++) {
      const ids = typesOnFloor(section, floor)
      ids.forEach((typeId, i) => {
        const type = AINI_TYPE_BY_ID.get(typeId)!
        const n = unitNumber(si, floor, i)
        const price = Math.round((type.area * perM2(floor, type.area)) / 10) * 10
        units.push({
          id: `${buildingId}-${n}`, number: String(n), buildingId, projectId,
          section: section.section, floor, kind: 'apartment', rooms: type.rooms, area: type.area,
          status: statusOf(n, floor), price, basePrice: price, finishing: 'rough',
          layoutPresetId: type.id, layoutName: type.code,
        })
      })
    }
  }

  // паркинг и кладовые в подземном уровне
  for (let i = 1; i <= 48; i++) {
    const number = `P-${String(i).padStart(2, '0')}`
    const price = 11500
    units.push({
      id: `${buildingId}-${number}`, number, buildingId, projectId,
      section: 0, floor: -1, kind: 'parking', rooms: 0, area: 13.5,
      status: statusOf(900 + i, AINI_FIRST_LIVING), price, basePrice: price, finishing: 'none',
    })
  }
  for (let i = 1; i <= 24; i++) {
    const number = `К-${String(i).padStart(2, '0')}`
    const price = 1900
    units.push({
      id: `${buildingId}-store-${i}`, number, buildingId, projectId,
      section: 0, floor: -1, kind: 'storage', rooms: 0, area: 4.6,
      status: statusOf(800 + i, AINI_FIRST_LIVING), price, basePrice: price, finishing: 'none',
    })
  }

  return units
}

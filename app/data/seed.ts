import type {
  AuditEntry, Building, Client, ClientOrigin, Contract, DealType, DiscountRequest, ExplicationRoom, ImageZone, Lead, LeadEvent, LeadStage, MaritalStatus, UnitHistoryEntry,
  ClientDocument, LeadComm, LeadTask, LeadTaskKind, NotificationItem,
  Payment, PriceDraft, Project, QueueEntry, Reservation, ScheduleItem, Unit, UnitKind, UnitStatus,
} from '~/types/models'
import { makeRng, rBool, rInt, rPick, rWeighted, type Rng } from '~/utils/rng'
import { defaultExplication, roomColor } from '~/utils/explication'
import { UNIT_BOARD_COLOR } from '~/utils/meta'
import { AVENUE88_PRESETS, AV88_FIRST_LIVING, AV88_TOP, avenue88Units } from './avenue88'
import { AGENT_NAMES, FIRST_NAMES_F, FIRST_NAMES_M, LAST_NAMES_F, LAST_NAMES_M, LEAD_SOURCES } from './names'
import { documentImage, facadeFloorBand, facadeImage, floorPlanImage, floorPlateApartments, masterPlanFootprint, masterPlanImage, unitLayoutImage, unitLayoutRects } from './placeholders'
import { AINI_FIRST_LIVING, AINI_FLOORS, ainiFloorImage, ainiPresets, ainiRender, ainiUnits } from './aini'

/**
 * «Сегодня» демо-данных. Внутри дня дата фиксирована — графики и просрочки не
 * пляшут между рендерами, — но сам день берётся текущий: иначе через неделю
 * после сборки лента дня пустеет, а все задачи оказываются просроченными.
 * Опорная дата держит порядок, если система запущена с часами в прошлом.
 */
const ANCHOR = new Date('2026-09-23T09:00:00+06:00')
const REAL = new Date()
export const TODAY = REAL > ANCHOR
  ? new Date(REAL.getFullYear(), REAL.getMonth(), REAL.getDate(), 9, 0, 0)
  : ANCHOR
const DAY = 86400000
export function addDays(d: Date | string, n: number) {
  const base = typeof d === 'string' ? new Date(d) : d
  return new Date(base.getTime() + n * DAY).toISOString()
}

function personName(rng: Rng): { name: string; male: boolean } {
  const male = rBool(rng)
  const first = rPick(rng, male ? FIRST_NAMES_M : FIRST_NAMES_F)
  const last = rPick(rng, male ? LAST_NAMES_M : LAST_NAMES_F)
  return { name: `${last} ${first}`, male }
}

function phone(rng: Rng) {
  return `996${rPick(rng, ['700', '550', '555', '770', '990'])}${String(rInt(rng, 100000, 999999))}`
}

export const PROJECTS: Project[] = [
  {
    id: 'aurora', name: 'ЖК «Аврора»', propertyKind: 'residential', address: 'ул. Ахунбаева, 2', developer: 'ОсОО «Кварталстрой»',
    banks: ['Доскредобанк', 'РСК Банк'], currency: 'USD', country: 'Кыргызстан', stage: 'Строительство', salesStart: '2025-11-01',
    infrastructure: 'Детский сад, паркинг, двор без машин, коммерция на 1 этаже',
    website: 'https://aurora.inhouse.kg', salesOfficeId: 'office-2',
    buildingIds: ['aurora-1', 'aurora-2'], accent: '#6E4453', archived: false, media: [], masterPlans: [], masterPlanZones: [],
  },
  {
    id: 'panorama', name: 'ЖК «Панорама»', propertyKind: 'residential', address: 'ул. Байтик Баатыра, 88', developer: 'ОсОО «Кварталстрой»',
    banks: ['Доскредобанк'], currency: 'USD', country: 'Кыргызстан', stage: 'Котлован', salesStart: '2026-04-15',
    infrastructure: 'Подземный паркинг, коммерция на 1 этаже',
    website: '', salesOfficeId: 'office-1',
    buildingIds: ['panorama-1'], accent: '#3A6EA5', archived: false, media: [], masterPlans: [], masterPlanZones: [],
  },
  // Настоящий объект целиком: рендеры, поэтажные планы, планировки квартир и
  // экспликации взяты из буклета застройщика. Площади комнат сходятся с
  // документом до сотых — на выдуманных планировках не проверить, работает ли
  // разметка комнат на том, что реально приходит с объекта.
  {
    id: 'aini', name: 'ЖК «Айни Ороз»', propertyKind: 'residential', address: 'ул. Айни, Бишкек',
    developer: '', banks: [], currency: 'USD', country: 'Кыргызстан', stage: 'Строительство', salesStart: '',
    infrastructure: 'Подземный паркинг, коммерция на 1–2 этажах, закрытый двор, детская площадка',
    website: '', salesOfficeId: 'office-1',
    buildingIds: ['aini-1'], accent: '#8C5566', archived: false,
    // вся подборка рендеров застройщика — из неё менеджер собирает презентацию
    media: Array.from({ length: 42 }, (_, i) => ({
      id: `aini-m${i + 1}`, url: ainiRender(i + 1), name: `Визуализация ${i + 1}`,
      kind: 'photo' as const, addedAt: '2026-01-15T09:00:00.000Z',
    })),
    masterPlans: [], masterPlanZones: [],
  },
  // Настоящий объект: фонд, планировки и площади перенесены из рабочих
  // чертежей. Пустые поля — те, которых в буклетах нет; их заполняет
  // застройщик, а не мы.
  {
    id: 'avenue88', name: 'ЖК Avenue 88', propertyKind: 'residential', address: '', developer: '',
    banks: [], currency: 'USD', country: 'Кыргызстан', stage: 'Строительство', salesStart: '',
    infrastructure: 'Двухуровневый подземный паркинг, коммерция на 1–2 этажах',
    website: '', salesOfficeId: 'office-1',
    buildingIds: ['avenue88-1'], accent: '#2F7D5C', archived: false, media: [], masterPlans: [], masterPlanZones: [],
  },
]

function seedExplication(prefix: string, rooms: number, area: number): ExplicationRoom[] {
  return defaultExplication(rooms, area).map((r, i) => ({ ...r, id: `${prefix}-r${i + 1}` }))
}


/**
 * Разметка комнат на демонстрационной планировке. Строки экспликации кладём на
 * нарисованные прямоугольники по типу комнаты в порядке следования — лишние
 * строки (второй санузел в трёшке) остаются неразмеченными, как и бывает,
 * когда разметку доделывают руками.
 */
function seedRoomZones(presetId: string, rooms: number, explication: ExplicationRoom[], hasImage: boolean): ImageZone[] {
  if (!hasImage) return []
  const queues = new Map<string, ReturnType<typeof unitLayoutRects>>()
  for (const rect of unitLayoutRects(rooms)) {
    const list = queues.get(rect.kind) ?? []
    list.push(rect)
    queues.set(rect.kind, list)
  }
  const zones: ImageZone[] = []
  for (const row of explication) {
    const rect = queues.get(row.kind)?.shift()
    if (!rect) continue
    zones.push({
      id: `${presetId}-rz-${row.id}`,
      shape: 'rect',
      points: [{ x: rect.x, y: rect.y }, { x: rect.x + rect.w, y: rect.y + rect.h }],
      refId: row.id,
      label: row.name,
      color: roomColor(row.kind),
    })
  }
  return zones
}

function preset(id: string, name: string, rooms: number, area: number, orientation: Building['unitTypePresets'][number]['orientation'], visible: boolean, withImage: boolean): Building['unitTypePresets'][number] {
  const explication = seedExplication(id, rooms, area)
  return {
    id, name, rooms, area,
    imageUrl: withImage ? unitLayoutImage(rooms, area) : null,
    orientation, visible, explication,
    roomZones: seedRoomZones(id, rooms, explication, withImage),
  }
}

const AURORA1_PRESETS: Building['unitTypePresets'] = [
  preset('preset-a1', '1-комн. А', 1, 42.6, ['С', 'В'], true, true),
  preset('preset-a2', '2-комн. А', 2, 63.5, ['Ю'], true, true),
  preset('preset-a3', '3-комн. А', 3, 84.9, ['Ю', 'З'], true, true),
  { id: 'preset-a4', name: '4-комн. А', rooms: 4, area: 118.8, imageUrl: null, orientation: ['З'], visible: false, explication: [], roomZones: [] },
]

/** Области-полосы по этажам на демонстрационном фасаде. */
function seedFacadeZones(buildingId: string, floors: number, upTo = floors): ImageZone[] {
  return Array.from({ length: upTo }, (_, i) => {
    const floor = i + 1
    const band = facadeFloorBand(floor, floors)
    const color = floor <= 3 ? '#34495A' : floor <= 6 ? '#8C5566' : '#C9821A'
    return {
      id: `${buildingId}-fz-${floor}`,
      shape: 'rect' as const,
      points: [{ x: band.x, y: band.y }, { x: band.x + band.w, y: band.y + band.h }],
      refId: `floor:${floor}`,
      label: `Этаж ${floor}`,
      color,
    }
  })
}

export const BUILDINGS: Building[] = [
  {
    id: 'aini-1', projectId: 'aini', name: 'Дом 1', defaultUnitKind: 'apartment', structureType: 'residential',
    constructionStage: 'facade', address: 'ул. Айни, Бишкек', contractAddress: '',
    finishing: 'Черновая', material: 'Монолит-кирпич', cadastralNumber: '',
    constructionStart: '', constructionEnd: '', deliveryDate: '',
    salesStart: '', salesEnd: '',
    elevatorsPassenger: 2, elevatorsFreight: 1, hasTrashChute: true, hasShowroom: true,
    slogan: 'Ловите свой момент жизни', salesOfficeId: 'office-1',
    sections: 3, floors: AINI_FLOORS, floorsBelow: 1, archived: false, badge: 'Идут продажи',
    pdfImageUrl: ainiRender(1),
    // Рендеры перспективные, поэтому полос по этажам на них нет: разметку
    // рисует менеджер в редакторе фасадов поверх нужного вида.
    facades: [
      { id: 'aini-fac-main', name: 'Главный фасад с площади', imageUrl: ainiRender(1), tag: 'street', published: true, zones: [] },
      { id: 'aini-fac-entry', name: 'Входная группа и коммерция', imageUrl: ainiRender(15), tag: 'street', published: true, zones: [] },
      { id: 'aini-fac-winter', name: 'Зимний вид', imageUrl: ainiRender(20), tag: 'street', published: true, zones: [] },
      { id: 'aini-fac-yard', name: 'Вид со двора', imageUrl: ainiRender(2), tag: 'yard', published: false, zones: [] },
    ],
    facadeMarks: [],
    unitTypePresets: ainiPresets(),
    // Планы этажей застройщик даёт тремя листами — по ярусам 3, 4–7 и 8–14.
    // Каждому жилому этажу отдаём лист его яруса, а не рисуем несуществующие.
    floorPlans: Array.from({ length: AINI_FLOORS - AINI_FIRST_LIVING + 1 }, (_, i) => {
      const floor = AINI_FIRST_LIVING + i
      return { floor, name: `Этаж ${floor}`, imageUrl: ainiFloorImage(floor), zones: [] }
    }),
    fill: { board: true, layouts: true, floorPlans: true, facades: true, masterPlan: false },
  },
  {
    id: 'aurora-1', projectId: 'aurora', name: 'Дом 1', defaultUnitKind: 'apartment', structureType: 'residential',
    constructionStage: 'facade', address: 'ул. Ахунбаева, 2', contractAddress: 'ул. Ахунбаева, 2, кадастровый квартал 01-05',
    finishing: 'Черновая', material: 'Монолит-кирпич', cadastralNumber: '01-05-0123-0004',
    constructionStart: '2025-11-01', constructionEnd: '2027-05-31', deliveryDate: '2027-06-30',
    salesStart: '2025-11-01', salesEnd: '',
    elevatorsPassenger: 2, elevatorsFreight: 1, hasTrashChute: true, hasShowroom: true,
    slogan: 'Аврора — рассвет в центре города', salesOfficeId: 'office-2',
    sections: 2, floors: 9, floorsBelow: 1, archived: false, badge: 'Старт продаж', pdfImageUrl: null,
    facades: [
      { id: 'fac-a1-park', name: 'Вид со стороны парка', imageUrl: facadeImage(9), tag: 'yard', published: true, zones: seedFacadeZones('aurora-1', 9) },
      { id: 'fac-a1-street', name: 'Вид с улицы Ахунбаева', imageUrl: facadeImage(9, { evening: true }), tag: 'street', published: true, zones: [] },
      { id: 'fac-a1-lobby', name: 'Парадная, 1-й подъезд', imageUrl: null, tag: 'lobby', published: false, zones: [] },
    ],
    facadeMarks: Array.from({ length: 9 }, (_, i) => ({ floor: i + 1, color: i < 3 ? '#34495A' : i < 6 ? '#A77886' : '#B8780E', label: i < 3 ? 'Продано' : i < 6 ? 'В рассрочке' : 'Свободно' })),
    unitTypePresets: AURORA1_PRESETS,
    floorPlans: Array.from({ length: 9 }, (_, i) => ({ floor: i + 1, name: `Этаж ${i + 1}`, imageUrl: floorPlanImage(i + 1), zones: [] })),
    fill: { board: true, layouts: true, floorPlans: true, facades: true, masterPlan: true },
  },
  {
    id: 'aurora-2', projectId: 'aurora', name: 'Дом 2', defaultUnitKind: 'apartment', structureType: 'residential',
    constructionStage: 'frame', address: 'ул. Ахунбаева, 4', contractAddress: 'ул. Ахунбаева, 4',
    finishing: 'Черновая', material: 'Монолит-кирпич', cadastralNumber: '',
    constructionStart: '2026-02-01', constructionEnd: '2027-11-30', deliveryDate: '2027-12-31',
    salesStart: '2026-02-01', salesEnd: '',
    elevatorsPassenger: 2, elevatorsFreight: 1, hasTrashChute: true, hasShowroom: false,
    slogan: '', salesOfficeId: 'office-2',
    sections: 2, floors: 6, floorsBelow: 1, archived: false, badge: null, pdfImageUrl: null,
    facades: [
      { id: 'fac-a2-yard', name: 'Вид со двора', imageUrl: facadeImage(6), tag: 'yard', published: false, zones: seedFacadeZones('aurora-2', 6, 3) },
    ],
    facadeMarks: [],
    unitTypePresets: AURORA1_PRESETS.map((p) => ({
      ...p, id: `${p.id}-b2`,
      explication: p.explication.map((r) => ({ ...r, id: `${r.id}-b2` })),
      // refId разметки обязан переехать вместе с id строк экспликации
      roomZones: p.roomZones.map((z) => ({ ...z, id: `${z.id}-b2`, refId: `${z.refId}-b2` })),
    })),
    floorPlans: Array.from({ length: 6 }, (_, i) => ({ floor: i + 1, name: `Этаж ${i + 1}`, imageUrl: i < 3 ? floorPlanImage(i + 1) : null, zones: [] })),
    fill: { board: true, layouts: true, floorPlans: false, facades: false, masterPlan: true },
  },
  {
    id: 'panorama-1', projectId: 'panorama', name: 'Дом 1', defaultUnitKind: 'apartment', structureType: 'residential',
    constructionStage: 'foundation', address: 'ул. Байтик Баатыра, 88', contractAddress: '',
    finishing: 'Не указана', material: '', cadastralNumber: '',
    constructionStart: '2026-04-15', constructionEnd: '2028-08-31', deliveryDate: '2028-09-30',
    salesStart: '2026-04-15', salesEnd: '',
    elevatorsPassenger: 1, elevatorsFreight: 1, hasTrashChute: false, hasShowroom: false,
    slogan: '', salesOfficeId: 'office-1',
    sections: 2, floors: 5, floorsBelow: 1, archived: false, badge: null, pdfImageUrl: null,
    facades: [], facadeMarks: [],
    unitTypePresets: [], floorPlans: [],
    fill: { board: true, layouts: false, floorPlans: false, facades: false, masterPlan: true },
  },
  {
    id: 'avenue88-1', projectId: 'avenue88', name: 'Дом 1', defaultUnitKind: 'apartment', structureType: 'residential',
    constructionStage: 'frame', address: '', contractAddress: '',
    finishing: 'Черновая', material: '', cadastralNumber: '',
    constructionStart: '', constructionEnd: '', deliveryDate: '',
    salesStart: '', salesEnd: '',
    elevatorsPassenger: 2, elevatorsFreight: 1, hasTrashChute: false, hasShowroom: false,
    slogan: '', salesOfficeId: 'office-1',
    // блоки А, Б, В из чертежей — это три подъезда; 1–2 этажи коммерция,
    // квартиры с третьего по одиннадцатый, паркинг на двух уровнях вниз
    sections: 3, floors: AV88_TOP, floorsBelow: 2, archived: false, badge: 'Идут продажи', pdfImageUrl: null,
    facades: [], facadeMarks: [],
    unitTypePresets: AVENUE88_PRESETS,
    floorPlans: Array.from({ length: AV88_TOP - AV88_FIRST_LIVING + 1 }, (_, i) => ({
      floor: AV88_FIRST_LIVING + i, name: `Этаж ${AV88_FIRST_LIVING + i}`, imageUrl: null, zones: [],
    })),
    fill: { board: true, layouts: false, floorPlans: false, facades: false, masterPlan: false },
  },
]

const LEAD_STAGE_LABEL: Record<LeadStage, string> = {
  new: 'Новая', contacted: 'Связались', visit: 'Показ', reserved: 'Бронь', deal: 'Сделка', lost: 'Отказ',
}

/**
 * Продано десять квартир — столько назвал застройщик. Разброс по этажам и
 * блокам обычный для старта: первыми уходят однушки блока В и средние этажи.
 */
const AV88_SOLD = ['310', '311', '312', '410', '411', '501', '502', '605', '710', '813']

const ROOM_AREA: Record<number, [number, number]> = { 1: [38, 48], 2: [56, 70], 3: [78, 96], 4: [102, 124] }
const BASE_PRICE_M2: Record<string, number> = { aurora: 620, panorama: 540 }

function genApartmentUnits(rng: Rng, b: Building, project: Project): Unit[] {
  const units: Unit[] = []
  const unitsPerFloor = 4
  for (let section = 1; section <= b.sections; section++) {
    for (let floor = 1; floor <= b.floors; floor++) {
      for (let pos = 1; pos <= unitsPerFloor; pos++) {
        const isGroundCommercial = floor === 1 && pos === 1 && section === 1
        const kind: UnitKind = isGroundCommercial ? 'commercial' : 'apartment'
        const rooms = kind === 'commercial' ? 0 : rWeighted(rng, [[1, 30], [2, 38], [3, 24], [4, 8]])
        const [aMin, aMax] = kind === 'commercial' ? [45, 90] : ROOM_AREA[rooms]!
        const area = Math.round((aMin + rng() * (aMax - aMin)) * 10) / 10
        const floorFactor = 1 + (floor / b.floors) * 0.12
        const perM2 = Math.round(BASE_PRICE_M2[project.id]! * floorFactor * (kind === 'commercial' ? 1.35 : 1) * (0.96 + rng() * 0.08))
        const basePrice = Math.round(area * perM2 / 10) * 10
        const status: UnitStatus = rWeighted(rng, [['free', 52], ['installment', 26], ['sold', 12], ['reserved', 8], ['closed', 2]])
        const number = `${section}${String((floor - 1) * unitsPerFloor + pos).padStart(2, '0')}`
        units.push({
          id: `${b.id}-${number}`, number, buildingId: b.id, projectId: b.projectId, section, floor,
          kind, rooms, area, status, price: basePrice, basePrice,
          finishing: rWeighted(rng, [['none', 30], ['rough', 45], ['fine', 20], ['furnished', 5]]),
          layoutName: kind === 'commercial' ? undefined : `${rooms}К.${String.fromCharCode(64 + rInt(rng, 1, 3))}`,
        })
      }
    }
  }
  // паркинг и кладовые в цоколе
  const parkingCount = b.id === 'aurora-1' ? 24 : b.id === 'aurora-2' ? 16 : 10
  for (let i = 1; i <= parkingCount; i++) {
    const status: UnitStatus = rWeighted(rng, [['free', 60], ['sold', 25], ['installment', 12], ['reserved', 3]])
    const price = Math.round((6200 + rng() * 1800) / 10) * 10
    units.push({
      id: `${b.id}-park-${i}`, number: `P-${String(i).padStart(2, '0')}`, buildingId: b.id, projectId: b.projectId,
      section: 0, floor: -1, kind: 'parking', rooms: 0, area: 13.5, status, price, basePrice: price, finishing: 'none',
    })
  }
  const storageCount = Math.round(parkingCount / 2)
  for (let i = 1; i <= storageCount; i++) {
    const status: UnitStatus = rWeighted(rng, [['free', 65], ['sold', 20], ['installment', 10], ['reserved', 5]])
    const price = Math.round((900 + rng() * 500) / 10) * 10
    units.push({
      id: `${b.id}-store-${i}`, number: `К-${String(i).padStart(2, '0')}`, buildingId: b.id, projectId: b.projectId,
      section: 0, floor: -1, kind: 'storage', rooms: 0, area: 4.2, status, price, basePrice: price, finishing: 'none',
    })
  }
  return units
}

// Контуры квартир на демонстрационных планах этажей привязываем к настоящим
// помещениям: 8 фигур плана (2 секции × 4 квартиры) ложатся на units этого
// этажа в том же порядке. Размечены только верхние этажи — остальные остаются
// незаполненными, чтобы прогресс раздела был честным, а не всегда 100%.
function seedFloorPlanZones(b: Building, buildingUnits: Unit[]) {
  if (b.id !== 'aurora-1') return
  const polys = floorPlateApartments(2)
  for (const plan of b.floorPlans) {
    if (!plan.imageUrl || plan.floor < 6) continue
    const zones: ImageZone[] = []
    polys.forEach((poly, i) => {
      const section = Math.floor(i / 4) + 1
      const pos = (i % 4) + 1
      const unit = buildingUnits.find((u) => u.floor === plan.floor && u.section === section
        && u.number === `${section}${String((plan.floor - 1) * 4 + pos).padStart(2, '0')}`)
      if (!unit) return
      zones.push({
        id: `${b.id}-fp${plan.floor}-z${i}`,
        shape: 'poly',
        points: poly,
        refId: unit.id,
        label: `№ ${unit.number}`,
        color: UNIT_BOARD_COLOR[unit.status],
      })
    })
    plan.zones = zones
  }
}

function build() {
  const rng = makeRng(88420)
  const units: Unit[] = []
  for (const b of BUILDINGS) {
    const project = PROJECTS.find((p) => p.id === b.projectId)!
    // Avenue 88 — настоящий объект: фонд собирается по плану этажа, а не
    // случайным генератором демо-домов
    // «Айни Ороз» — настоящий объект: фонд собирается по поэтажным планам
    // застройщика, а не случайным генератором демо-домов
    if (b.id === 'aini-1') {
      units.push(...ainiUnits({ buildingId: b.id, projectId: b.projectId }))
      continue
    }
    if (b.id === 'avenue88-1') {
      const real = avenue88Units({
        buildingId: b.id, projectId: b.projectId, sold: AV88_SOLD,
        parkingPerLevel: 60, commercialPerFloor: 6,
      })
      units.push(...real)
      continue
    }
    const buildingUnits = genApartmentUnits(rng, b, project)
    // связываем помещения с планировкой по числу комнат — как в Profitbase,
    // где картинка планировки привязана к конкретному списку помещений
    for (const u of buildingUnits) {
      if (u.kind !== 'apartment') continue
      const preset = b.unitTypePresets.find((p) => p.rooms === u.rooms)
      if (preset) u.layoutPresetId = preset.id
    }
    units.push(...buildingUnits)
    seedFloorPlanZones(b, buildingUnits)
  }

  // --- клиенты ---
  // Клиент — это досье покупателя, а не строка справочника: по нему печатают
  // договор, выставляют счёт и звонят. Поэтому здесь ИНН, адрес и дата
  // рождения, а не только имя с телефоном.
  const STREETS = ['ул. Ахунбаева', 'ул. Байтик Баатыра', 'пр. Чуй', 'ул. Токтогула', 'мкр. Джал', 'ул. Ибраимова']
  const MARITAL: MaritalStatus[] = ['single', 'married', 'divorced', 'widowed']
  const CLIENT_SOURCES = ['Instagram', 'Сайт', 'Рекомендация', 'Билборд', 'Выставка недвижимости', 'Повторная покупка']

  const clients: Client[] = []
  const clientCount = 46
  for (let i = 1; i <= clientCount; i++) {
    const { name } = personName(rng)
    const phoneNumber = phone(rng)
    clients.push({
      id: `c${i}`, kind: 'person', name, phone: phoneNumber,
      email: rBool(rng, 0.6) ? `${name.split(' ')[1]?.toLowerCase()}${i}@mail.kg` : undefined,
      origin: rWeighted(rng, [['own', 70], ['partner', 22], ['reassignment', 8]] as [ClientOrigin, number][]),
      passportMasked: `AN•••••${rInt(rng, 100, 999)}`,
      createdAt: addDays(TODAY, -rInt(rng, 5, 260)),
      inn: `1${rInt(rng, 100000, 999999)}${rInt(rng, 10000, 99999)}`,
      birthDate: addDays(TODAY, -rInt(rng, 22, 60) * 365 - rInt(rng, 0, 364)),
      address: `г. Бишкек, ${rPick(rng, STREETS)}, ${rInt(rng, 1, 180)}${rBool(rng, 0.6) ? `, кв. ${rInt(rng, 1, 120)}` : ''}`,
      maritalStatus: rPick(rng, MARITAL),
      source: rPick(rng, CLIENT_SOURCES),
      whatsapp: rBool(rng, 0.15) ? phone(rng) : phoneNumber,
    })
  }
  // немного корпоративных клиентов
  for (let i = 1; i <= 3; i++) {
    const phoneNumber = phone(rng)
    clients.push({
      id: `cc${i}`, kind: 'company', name: `ОсОО «${rPick(rng, ['Форт Групп', 'Артель Инвест', 'Стройсервис', 'Бизнес Альянс'])}»`,
      phone: phoneNumber, whatsapp: phoneNumber, origin: 'own', createdAt: addDays(TODAY, -rInt(rng, 20, 200)),
      inn: `2${rInt(rng, 100000, 999999)}${rInt(rng, 10000, 99999)}`,
      address: `г. Бишкек, ${rPick(rng, STREETS)}, ${rInt(rng, 1, 120)}`,
      source: 'Прямое обращение',
    })
  }

  // --- заявки (leads) ---
  // Заявка в CRM — это не строчка в таблице, а карточка с бюджетом, тегами,
  // задачами, заметками и лентой событий. Генерим всё это, иначе воронку
  // не на чем показать.
  const leads: Lead[] = []
  const managers = ['u-mgr-1', 'u-mgr-2', 'u-mgr-3']
  const managerNames: Record<string, string> = {
    'u-mgr-1': 'Айгуль Осмонова', 'u-mgr-2': 'Данияр Токтогулов', 'u-mgr-3': 'Дана Абдыкадырова',
  }
  const apartments = units.filter((u) => u.kind === 'apartment')
  const TAG_POOL = ['Ипотека', 'Рассрочка', 'Срочно', 'Инвестор', 'Повторное обращение', 'Нужен паркинг', 'Наличные']
  const TASK_TITLES: Record<LeadTaskKind, string[]> = {
    call: ['Перезвонить по подбору', 'Уточнить бюджет', 'Напомнить о брони', 'Узнать решение по ипотеке'],
    meeting: ['Встреча в офисе продаж', 'Повторная встреча с супругом'],
    visit: ['Показ квартиры', 'Показ шоурума', 'Выезд на объект'],
    document: ['Собрать документы на ипотеку', 'Отправить КП', 'Подготовить договор'],
    other: ['Согласовать скидку с РОПом', 'Проверить статус брони'],
  }
  const NOTE_POOL = [
    'Смотрит двушку с видом во двор, бюджет ограничен.',
    'Просит рассрочку на 24 месяца без первоначального.',
    'Готов выйти на сделку после продажи своей квартиры.',
    'Интересует этаж не ниже пятого, окна на юг.',
    'Подаёт заявку в банк, ждём одобрения.',
    'Приходил с супругой, решение принимают вместе.',
  ]

  // порядок этапов нужен, чтобы восстановить правдоподобную историю переходов
  const PIPE: LeadStage[] = ['new', 'contacted', 'visit', 'reserved', 'deal']

  for (let i = 1; i <= 34; i++) {
    const client = rPick(rng, clients)
    const stage = rWeighted(rng, [['new', 18], ['contacted', 24], ['visit', 20], ['reserved', 10], ['deal', 14], ['lost', 14]] as [LeadStage, number][])
    const assignedTo = rPick(rng, managers)
    const author = managerNames[assignedTo] ?? 'Система'
    const createdAt = addDays(TODAY, -rInt(rng, 0, 60))
    const interested = [rPick(rng, apartments), rPick(rng, apartments)]
    const budget = Math.round((interested[0]!.price * (0.9 + rng() * 0.25)) / 500) * 500

    // история: заявка прошла по этапам от создания до текущего
    const history: LeadEvent[] = []
    let seq = 0
    const push = (kind: LeadEvent['kind'], text: string, at: string) => {
      history.push({ id: `ev-${i}-${++seq}`, kind, text, author, at })
    }
    push('created', `Заявка создана из источника «${rPick(rng, LEAD_SOURCES)}»`, createdAt)

    const reachedIndex = stage === 'lost' ? rInt(rng, 0, 2) : PIPE.indexOf(stage)
    let cursor = new Date(createdAt)
    let stageSince = createdAt
    for (let k = 1; k <= reachedIndex; k++) {
      cursor = new Date(cursor.getTime() + rInt(rng, 1, 6) * DAY)
      if (cursor > TODAY) cursor = new Date(TODAY.getTime() - DAY)
      stageSince = cursor.toISOString()
      push('stage', `Этап изменён на «${LEAD_STAGE_LABEL[PIPE[k]!]}»`, stageSince)
    }
    if (stage === 'lost') {
      cursor = new Date(cursor.getTime() + rInt(rng, 1, 5) * DAY)
      if (cursor > TODAY) cursor = new Date(TODAY.getTime() - DAY)
      stageSince = cursor.toISOString()
    }

    // заметки
    const notes = Array.from({ length: rInt(rng, 0, 2) }, (_, n) => ({
      id: `note-${i}-${n + 1}`,
      text: rPick(rng, NOTE_POOL),
      author,
      at: addDays(createdAt, rInt(rng, 0, 4)),
    }))
    for (const n of notes) push('note', 'Добавлена заметка', n.at)

    // задачи: у активных заявок почти всегда есть открытая, часть просрочена
    const closed = stage === 'deal' || stage === 'lost'
    const tasks: LeadTask[] = []
    const doneCount = rInt(rng, 0, 2)
    for (let t = 0; t < doneCount; t++) {
      const kind = rPick(rng, ['call', 'meeting', 'visit', 'document'] as LeadTaskKind[])
      const at = addDays(createdAt, t + 1)
      tasks.push({ id: `task-${i}-d${t}`, kind, title: rPick(rng, TASK_TITLES[kind]), dueAt: at, assignedTo, done: true, doneAt: at })
      push('task_done', `Задача выполнена: ${tasks[tasks.length - 1]!.title}`, at)
    }
    if (!closed && rBool(rng, 0.85)) {
      const kind = rPick(rng, ['call', 'meeting', 'visit', 'document'] as LeadTaskKind[])
      // ~30% открытых задач просрочены — иначе доска «всё зелено» и бесполезна
      const offset = rWeighted(rng, [[-4, 14], [-1, 16], [0, 22], [1, 20], [3, 18], [7, 10]] as [number, number][])
      // время суток важно: «сегодня 10:00» и «сегодня 18:00» — разные задачи
      const due = new Date(new Date(addDays(TODAY, offset)).setHours(rInt(rng, 9, 18), rPick(rng, [0, 30]), 0, 0)).toISOString()
      tasks.push({ id: `task-${i}-open`, kind, title: rPick(rng, TASK_TITLES[kind]), dueAt: due, assignedTo, done: false })
      push('task', `Поставлена задача: ${tasks[tasks.length - 1]!.title}`, createdAt)
    }
    const openTask = tasks.find((t) => !t.done)

    if (stage === 'deal') push('won', 'Заявка переведена в сделку', stageSince)
    const lostReason = stage === 'lost' ? rPick(rng, ['Купил в другом ЖК', 'Не подошла цена', 'Взял паузу', 'Не отвечает', 'Не одобрили ипотеку']) : undefined
    if (lostReason) push('lost', `Отказ: ${lostReason}`, stageSince)

    history.sort((a, b) => a.at.localeCompare(b.at))

    const tagCount = rInt(rng, 0, 3)
    const tags = [...new Set(Array.from({ length: tagCount }, () => rPick(rng, TAG_POOL)))]

    // запрос клиента строим вокруг того, чем он уже интересовался — так подбор
    // на карточке сразу даёт осмысленный результат, а не весь фонд
    const anchor = interested[0]!
    const roomsMin = Math.max(1, anchor.rooms - (rBool(rng, 0.4) ? 1 : 0))
    const interest = {
      projectIds: [anchor.projectId],
      buildingIds: rBool(rng, 0.45) ? [anchor.buildingId] : [],
      roomsMin,
      roomsMax: roomsMin + rInt(rng, 0, 1),
      areaMin: Math.round(anchor.area * 0.85),
      areaMax: Math.round(anchor.area * 1.2),
      floorMin: rBool(rng, 0.5) ? rInt(rng, 2, 5) : undefined,
      floorMax: undefined,
      budgetMin: Math.round((budget * 0.85) / 500) * 500,
      budgetMax: budget,
      paymentMethod: rWeighted(rng, [['installment', 45], ['mortgage', 35], ['full', 20]] as ['full' | 'installment' | 'mortgage', number][]),
      comment: rBool(rng, 0.5) ? rPick(rng, ['Окна не на дорогу', 'Нужен паркинг рядом', 'Готов ждать сдачи', 'Важен вид из окна', 'Рядом школа']) : undefined,
    }

    // зафиксированные контакты: из них строится лента истории
    const comms: LeadComm[] = []
    const commCount = closed ? rInt(rng, 2, 4) : rInt(rng, 0, 3)
    for (let c = 0; c < commCount; c++) {
      const outcome = rWeighted(rng, [['answered', 62], ['no_answer', 24], ['callback', 14]] as ['answered' | 'no_answer' | 'callback', number][])
      comms.push({
        id: `comm-${i}-${c + 1}`,
        kind: rWeighted(rng, [['call_out', 52], ['whatsapp', 26], ['call_in', 14], ['meeting', 8]] as [LeadComm['kind'], number][]),
        at: addDays(createdAt, rInt(rng, 0, 10)),
        durationSec: outcome === 'answered' ? rInt(rng, 45, 600) : undefined,
        outcome,
        note: rBool(rng, 0.35) ? rPick(rng, ['Обсудили условия рассрочки', 'Отправил подборку', 'Договорились о показе', 'Уточнял по паркингу']) : undefined,
        author,
      })
    }
    comms.sort((a, b) => b.at.localeCompare(a.at))

    leads.push({
      id: `lead-${i}`,
      clientId: client.id,
      stage,
      channel: rPick(rng, ['Instagram', 'Сайт', 'Звонок', 'WhatsApp', 'Telegram']),
      source: rPick(rng, LEAD_SOURCES),
      createdAt,
      assignedTo,
      interestedUnitIds: [...new Set(interested.map((u) => u.id))],
      budget,
      priority: rWeighted(rng, [['normal', 62], ['high', 22], ['low', 16]] as [Lead['priority'], number][]),
      tags,
      stageSince,
      lastContactAt: tasks.filter((t) => t.done).pop()?.doneAt ?? createdAt,
      tasks,
      notes,
      history,
      lostReason,
      comms,
      interest,
      lostAt: lostReason ? stageSince : undefined,
      nextAction: openTask?.title,
      nextAt: openTask?.dueAt,
    })
  }

  // --- брони ---
  // Срок брони считаем от более поздней из дат: зафиксированного «сегодня»
  // и реального текущего дня. «Сегодня» в сиде закреплено ради стабильных
  // графиков и просрочек, но бронь на сутки, посчитанная от него, к моменту
  // открытия демо давно истекла бы — и половина этапа «Бронь» осталась бы
  // без самой брони.
  // брони живут от «сегодня», иначе короткая бронь умирает на первой загрузке
  const reserveBase = TODAY
  const reservations: Reservation[] = []
  const reservedUnits = units.filter((u) => u.status === 'reserved')
  reservedUnits.forEach((u, idx) => {
    const client = rPick(rng, clients)
    const kind = rWeighted(rng, [['no_deposit', 30], ['confirmed', 30], ['with_deposit', 40]] as const)
    const days = kind === 'no_deposit' ? 1 : kind === 'confirmed' ? 3 : 30
    const createdAt = addDays(reserveBase, -rInt(rng, 0, days - 1))
    const id = `res-${idx + 1}`
    reservations.push({
      id, unitId: u.id, clientId: client.id, kind,
      deposit: kind === 'with_deposit' ? rPick(rng, [100000, 150000, 200000]) : 0,
      createdAt, expiresAt: addDays(createdAt, days), status: 'active', createdBy: rPick(rng, managers),
    })
    u.reservationId = id
  })

  // --- очередь на популярные объекты ---
  const queue: QueueEntry[] = []
  const queueTargets = reservedUnits.slice(0, 3)
  queueTargets.forEach((u) => {
    const n = rInt(rng, 1, 2)
    for (let i = 0; i < n; i++) {
      const client = rPick(rng, clients)
      queue.push({ unitId: u.id, clientId: client.id, name: client.name, phone: client.phone, addedAt: addDays(reserveBase, -rInt(rng, 0, 3)) })
    }
  })

  // --- договоры, график, платежи ---
  const contracts: Contract[] = []
  const scheduleItems: ScheduleItem[] = []
  const payments: Payment[] = []
  let contractSeq = 1000
  let paymentSeq = 5000

  const dealUnits = units.filter((u) => u.status === 'installment' || u.status === 'sold')
  dealUnits.forEach((u) => {
    const client = rPick(rng, clients)
    contractSeq += 1
    const contractId = `ct-${contractSeq}`
    const signedAt = addDays(TODAY, -rInt(rng, 15, 420))
    const dealType: DealType = rWeighted(rng, [['regular', 82], ['barter', 8], ['pledge', 6], ['preferential', 4]] as [DealType, number][])
    const discount = rBool(rng, 0.25) ? rInt(rng, 2, 7) : 0
    const price = Math.round(u.price * (1 - discount / 100))
    const isFull = u.status === 'sold'
    if (isFull) u.keysIssued = rBool(rng, 0.45)
    contracts.push({
      id: contractId, number: `Д-${new Date(signedAt).getFullYear()}-${String(contractSeq).slice(-4)}`,
      projectId: u.projectId, clientId: client.id, unitIds: [u.id], dealType,
      status: isFull ? 'paid' : 'active', currency: 'USD', price, discount, signedAt, createdAt: signedAt,
      route: rPick(rng, ['company', 'notary', 'state_registry']), agentId: rBool(rng, 0.2) ? 'agent-1' : undefined,
      managerId: rPick(rng, managers),
      // способ оплаты и банк нужны и в досье клиента, и в фильтрах реестра
      paymentMethodId: isFull ? 'pm-1' : rWeighted(rng, [['pm-2', 70], ['pm-3', 30]] as [string, number][]),
      bank: isFull ? undefined : rBool(rng, 0.35) ? rPick(rng, ['Доскредобанк', 'РСК Банк', 'Оптима Банк']) : undefined,
    })
    u.contractId = contractId

    // график: 20% первый взнос + N месяцев
    const months = isFull ? 1 : rPick(rng, [12, 18, 24, 36])
    const down = Math.round(price * (isFull ? 1 : 0.2))
    const rest = price - down
    const monthly = Math.round(rest / Math.max(1, months - (isFull ? 0 : 1)))
    let cursor = new Date(signedAt)
    const items: { due: string; amount: number }[] = [{ due: signedAt, amount: down }]
    if (!isFull) {
      for (let m = 1; m < months; m++) {
        cursor = new Date(new Date(signedAt).setMonth(new Date(signedAt).getMonth() + m))
        items.push({ due: cursor.toISOString(), amount: m === months - 1 ? rest - monthly * (months - 2) : monthly })
      }
    }
    let paidSoFar = 0
    const totalDueNow = items.filter((it) => new Date(it.due) <= TODAY).reduce((s, it) => s + it.amount, 0)
    // большинство договоров платят по графику — просрочка у явного меньшинства,
    // иначе доска оплат и карта здоровья на шахматке выглядят как сплошной кризис
    const payingOnTime = rBool(rng, 0.72)
    const collected = isFull
      ? price
      : payingOnTime
        ? Math.min(price, Math.round(totalDueNow * (1 + rng() * 0.06)))
        : Math.round(totalDueNow * (0.45 + rng() * 0.4))
    items.forEach((it, i) => {
      const remaining = collected - paidSoFar
      const paid = Math.max(0, Math.min(it.amount, remaining))
      paidSoFar += paid
      scheduleItems.push({ id: `${contractId}-s${i + 1}`, contractId, dueDate: it.due, amount: it.amount, paid, version: 1 })
      if (paid > 0) {
        paymentSeq += 1
        payments.push({
          id: `pay-${paymentSeq}`, contractId, date: it.due, amount: paid, currency: 'USD',
          kind: rWeighted(rng, [['bank', 45], ['cash', 30], ['online', 20], ['barter', 5]] as const),
          status: 'confirmed', receiptNumber: `ПКО-${paymentSeq}`,
        })
      }
    })
    // немного платежей "ожидает подтверждения"
    if (rBool(rng, 0.12) && !isFull) {
      paymentSeq += 1
      payments.push({ id: `pay-${paymentSeq}`, contractId, date: addDays(TODAY, -rInt(rng, 0, 2)), amount: monthly, currency: 'USD', kind: 'bank', status: 'pending' })
    }
  })


  // --- сшивка воронки: заявка ↔ бронь ↔ договор ---
  // Без этих ссылок карточка заявки не может показать ни бронь, ни сделку,
  // а источник лида не доживает до денег и аналитика по каналам пустая.
  const documents: ClientDocument[] = []
  const usedRes = new Set<string>()
  const usedContracts = new Set<string>()
  let docSeq = 0

  for (const lead of leads) {
    if (lead.stage === 'reserved') {
      const res = reservations.find((r) => !usedRes.has(r.id) && lead.interestedUnitIds.includes(r.unitId))
        ?? reservations.find((r) => !usedRes.has(r.id))
      if (res) {
        usedRes.add(res.id)
        res.leadId = lead.id
        res.clientId = lead.clientId
        res.createdBy = lead.assignedTo
        if (!lead.interestedUnitIds.includes(res.unitId)) lead.interestedUnitIds.unshift(res.unitId)
      }
    }
    if (lead.stage === 'deal') {
      const ct = contracts.find((c) => !usedContracts.has(c.id) && c.clientId === lead.clientId)
        ?? contracts.find((c) => !usedContracts.has(c.id) && lead.interestedUnitIds.includes(c.unitIds[0] ?? ''))
        ?? contracts.find((c) => !usedContracts.has(c.id))
      if (ct) {
        usedContracts.add(ct.id)
        ct.leadId = lead.id
        ct.clientId = lead.clientId
        if (!lead.interestedUnitIds.includes(ct.unitIds[0] ?? '')) lead.interestedUnitIds.unshift(ct.unitIds[0]!)
      }
    }

    // досье: паспорт у всех, кто дошёл до брони; договор — у сделок
    if (lead.stage === 'reserved' || lead.stage === 'deal') {
      const client = clients.find((c) => c.id === lead.clientId)
      docSeq += 1
      documents.push({
        id: `cdoc-${docSeq}`, clientId: lead.clientId, leadId: lead.id, kind: 'passport',
        name: 'Паспорт (разворот)',
        url: documentImage('Паспорт гражданина КР', [
          `ФИО: ${client?.name ?? '—'}`,
          `Серия AN ${rInt(rng, 1000000, 9999999)}`,
          `Выдан: МКК ${rInt(rng, 10, 99)}-${rInt(rng, 10, 99)}`,
        ], '#34495A'),
        mime: 'image/svg+xml', sizeBytes: rInt(rng, 180000, 620000),
        uploadedBy: managerNames[lead.assignedTo] ?? 'Менеджер',
        uploadedAt: addDays(lead.createdAt, 1),
        signed: true, signedAt: addDays(lead.createdAt, 1),
      })
    }
    if (lead.stage === 'deal') {
      const ct = contracts.find((c) => c.leadId === lead.id)
      if (ct) {
        docSeq += 1
        documents.push({
          id: `cdoc-${docSeq}`, clientId: lead.clientId, leadId: lead.id, contractId: ct.id, kind: 'contract',
          name: `Договор ${ct.number}`,
          url: documentImage(`Договор ${ct.number}`, [
            `Покупатель: ${clients.find((c) => c.id === lead.clientId)?.name ?? '—'}`,
            `Объект: № ${units.find((u) => u.id === ct.unitIds[0])?.number ?? '—'}`,
            `Сумма: ${ct.price.toLocaleString('ru-RU')} USD`,
          ]),
          mime: 'image/svg+xml', sizeBytes: rInt(rng, 240000, 900000),
          uploadedBy: managerNames[lead.assignedTo] ?? 'Менеджер',
          uploadedAt: ct.createdAt,
          signed: rBool(rng, 0.7),
        })
      }
    }
  }

  // --- документы покупателей ---
  // У клиента с договором Data Room не должен быть пустым: паспорт, договор,
  // квитанции по подтверждённым платежам и ипотечные бумаги там, где банк.
  for (const contract of contracts) {
    const client = clients.find((c) => c.id === contract.clientId)
    if (!client) continue
    const ownerName = managerNames[leads.find((l) => l.id === contract.leadId)?.assignedTo ?? ''] ?? 'Отдел продаж'

    if (!documents.some((d) => d.clientId === client.id && d.kind === 'passport')) {
      docSeq += 1
      documents.push({
        id: `cdoc-${docSeq}`, clientId: client.id, kind: client.kind === 'company' ? 'other' : 'passport',
        name: client.kind === 'company' ? 'Свидетельство о регистрации' : 'Паспорт (разворот)',
        url: documentImage(client.kind === 'company' ? 'Свидетельство о регистрации' : 'Паспорт гражданина КР', [
          `${client.kind === 'company' ? 'Организация' : 'ФИО'}: ${client.name}`,
          `ИНН: ${client.inn ?? '—'}`,
          client.address ? `Адрес: ${client.address}` : 'Адрес: —',
        ], '#34495A'),
        mime: 'image/svg+xml', sizeBytes: rInt(rng, 180000, 620000),
        uploadedBy: ownerName, uploadedAt: addDays(contract.createdAt, -2),
        signed: true, signedAt: addDays(contract.createdAt, -2),
      })
    }

    if (!documents.some((d) => d.contractId === contract.id && d.kind === 'contract')) {
      docSeq += 1
      const unit = units.find((u) => u.id === contract.unitIds[0])
      documents.push({
        id: `cdoc-${docSeq}`, clientId: client.id, contractId: contract.id, kind: 'contract',
        name: `Договор ${contract.number}`,
        url: documentImage(`Договор ${contract.number}`, [
          `Покупатель: ${client.name}`,
          `Объект: № ${unit?.number ?? '—'}`,
          `Сумма: ${contract.price.toLocaleString('ru-RU')} USD`,
        ]),
        mime: 'image/svg+xml', sizeBytes: rInt(rng, 240000, 900000),
        uploadedBy: ownerName, uploadedAt: contract.createdAt, signed: rBool(rng, 0.8),
      })
    }

    // квитанции по первым подтверждённым платежам
    const confirmed = payments.filter((p) => p.contractId === contract.id && p.status === 'confirmed').slice(0, 2)
    for (const pay of confirmed) {
      docSeq += 1
      documents.push({
        id: `cdoc-${docSeq}`, clientId: client.id, contractId: contract.id, kind: 'receipt',
        name: `Квитанция ${pay.receiptNumber ?? pay.id}`,
        url: documentImage('Приходный кассовый ордер', [
          `Плательщик: ${client.name}`,
          `Договор: ${contract.number}`,
          `Сумма: ${pay.amount.toLocaleString('ru-RU')} USD`,
        ], '#2F7D5C'),
        mime: 'image/svg+xml', sizeBytes: rInt(rng, 90000, 240000),
        uploadedBy: 'Елена Волкова', uploadedAt: pay.date, signed: true, signedAt: pay.date,
      })
    }

    if (contract.bank) {
      docSeq += 1
      documents.push({
        id: `cdoc-${docSeq}`, clientId: client.id, contractId: contract.id, kind: 'mortgage',
        name: `Одобрение ипотеки · ${contract.bank}`,
        url: documentImage('Решение банка по ипотеке', [
          `Банк: ${contract.bank}`,
          `Заёмщик: ${client.name}`,
          `Одобрено: ${Math.round(contract.price * 0.8).toLocaleString('ru-RU')} USD`,
        ], '#3A6EA5'),
        mime: 'image/svg+xml', sizeBytes: rInt(rng, 120000, 380000),
        uploadedBy: ownerName, uploadedAt: addDays(contract.createdAt, -5), signed: true,
      })
    }
  }

  // --- VIP ---
  // Особое внимание заслуживают те, кто покупает не первый раз или на крупную
  // сумму: ставить галочку руками по 50 клиентам никто не будет.
  const spentByClient = new Map<string, { sum: number; count: number }>()
  for (const c of contracts) {
    const cur = spentByClient.get(c.clientId) ?? { sum: 0, count: 0 }
    cur.sum += c.price
    cur.count++
    spentByClient.set(c.clientId, cur)
  }
  for (const client of clients) {
    const stat = spentByClient.get(client.id)
    if (!stat) continue
    // VIP — это повторная покупка или действительно крупная сумма; если
    // пометить половину базы, метка перестаёт что-либо значить
    if (stat.count > 1 || stat.sum >= 150000) client.vip = true
    if (stat.count > 1) client.source = 'Повторная покупка'
  }

  // --- история помещений ---
  // Цена квартиры меняется не раз в жизни: индексация по готовности, акции,
  // корректировки под спрос. Без этой ленты менеджер не может ответить на
  // «а почему в марте было дешевле», а руководитель — увидеть, что рост
  // остановился. Собираем правдоподобную историю: шаги вверх к текущей цене.
  const unitHistory: UnitHistoryEntry[] = []
  const priceAuthors = ['Гульнара Молдалиева', 'Тимур Асанов', 'Система']
  for (const u of units) {
    if (u.kind === 'parking' || u.kind === 'storage') continue
    const steps = rInt(rng, 2, 4)
    // от стартовой цены (на 8–16% ниже) поднимаемся к текущей
    const startPrice = Math.round(u.price / (1 + (0.08 + rng() * 0.08)) / 10) * 10
    let prev = startPrice
    const firstDaysAgo = rInt(rng, 240, 400)
    for (let i = 1; i <= steps; i++) {
      const at = addDays(TODAY, -Math.round(firstDaysAgo * (1 - i / (steps + 1))))
      const next = i === steps ? u.price : Math.round((prev + (u.price - prev) * (0.35 + rng() * 0.3)) / 10) * 10
      if (next === prev) continue
      unitHistory.push({
        id: `uh-${u.id}-${i}`, unitId: u.id, at, author: rPick(rng, priceAuthors),
        kind: 'price', from: String(prev), to: String(next),
        note: i === steps ? 'Индексация по стадии строительства' : undefined,
      })
      prev = next
    }
    if (u.status === 'sold' || u.status === 'installment') {
      unitHistory.push({
        id: `uh-${u.id}-st`, unitId: u.id, at: addDays(TODAY, -rInt(rng, 5, 200)),
        author: rPick(rng, priceAuthors), kind: 'status', from: 'free', to: u.status,
      })
    } else if (u.status === 'reserved') {
      unitHistory.push({
        id: `uh-${u.id}-st`, unitId: u.id, at: addDays(TODAY, -rInt(rng, 0, 3)),
        author: rPick(rng, priceAuthors), kind: 'status', from: 'free', to: 'reserved',
      })
    }
  }
  unitHistory.sort((a, b) => b.at.localeCompare(a.at))

  // --- генплан ---
  // Верхний уровень навигации: ЖК → дом → фасад → этаж. Картинку и контуры
  // рисует одна функция, поэтому области ложатся ровно по корпусам.
  for (const project of PROJECTS) {
    const projectBuildings = BUILDINGS.filter((b) => b.projectId === project.id && !b.archived)
    if (!projectBuildings.length) continue
    project.masterPlans = [{
      id: `genplan-${project.id}`,
      url: masterPlanImage(projectBuildings.map((b) => ({ name: b.name, floors: b.floors }))),
      name: `Генплан ${project.name}`,
      kind: 'photo',
      addedAt: addDays(TODAY, -120),
    }]
    project.masterPlanZones = projectBuildings.map((b, i) => {
      const f = masterPlanFootprint(i, projectBuildings.length)
      return {
        id: `${project.id}-mp-${b.id}`,
        shape: 'rect' as const,
        points: [{ x: f.x, y: f.y }, { x: f.x + f.w, y: f.y + f.h }],
        refId: `building:${b.id}`,
        label: b.name,
        color: project.accent,
      }
    })
  }

  // --- связь броней с заявками ---
  // Заявка на этапе «Бронь» обязана иметь настоящую бронь: без этой связи
  // карточка не покажет ни таймер, ни клиента, а чек-лист и рекомендации
  // считают, что до брони дело не дошло.
  const reservedLeads = leads.filter((l) => l.stage === 'reserved')
  const freeReservations = reservations.filter((r) => r.status === 'active' && !r.leadId)
  reservedLeads.forEach((lead, i) => {
    const reservation = freeReservations[i]
    if (!reservation) return
    reservation.leadId = lead.id
    reservation.clientId = lead.clientId
    reservation.createdBy = lead.assignedTo
    if (!lead.interestedUnitIds.includes(reservation.unitId)) lead.interestedUnitIds.unshift(reservation.unitId)
  })

  // --- связь договоров с заявками ---
  // Без leadId договор не знает, из какой заявки он вырос: не посчитать ни
  // средний цикл сделки, ни продажи по менеджерам, ни источник продажи.
  // Поэтому заявки на этапе «Сделка» привязываем к реальным договорам, а дату
  // заявки сдвигаем перед подписанием — цикл считается от неё.
  const dealLeads = leads.filter((l) => l.stage === 'deal')
  const freeContracts = contracts.filter((c) => !c.leadId)
  dealLeads.forEach((lead, i) => {
    const own = freeContracts.findIndex((c) => c.clientId === lead.clientId)
    const idx = own >= 0 ? own : i
    const contract = freeContracts[idx]
    if (!contract) return
    freeContracts.splice(idx, 1)
    contract.leadId = lead.id
    contract.clientId = lead.clientId
    contract.managerId = lead.assignedTo

    const signed = contract.signedAt ?? contract.createdAt
    lead.createdAt = addDays(signed, -rInt(rng, 12, 75))
    lead.stageSince = signed
    const created = lead.history.find((e) => e.kind === 'created')
    if (created) created.at = lead.createdAt

    // бронь, которая стала договором: конверсия «бронь → договор» считается
    // именно по таким записям
    if (rBool(rng, 0.7)) {
      const unitId = contract.unitIds[0]
      if (unitId) {
        const createdAt = addDays(signed, -rInt(rng, 2, 20))
        reservations.push({
          id: `res-conv-${i + 1}`, unitId, clientId: lead.clientId, leadId: lead.id,
          kind: 'with_deposit', deposit: 150000, createdAt, expiresAt: addDays(createdAt, 30),
          status: 'converted', createdBy: lead.assignedTo,
        })
      }
    }
  })

  // --- прайс-листы ---
  const priceDrafts: PriceDraft[] = [
    {
      id: 'pd-1', projectId: 'aurora', status: 'published', title: 'Индексация цен — сентябрь',
      createdBy: 'u-comdir', createdAt: addDays(TODAY, -18), publishedAt: addDays(TODAY, -17),
      items: units.filter((u) => u.buildingId === 'aurora-1').slice(0, 6).map((u) => ({ unitId: u.id, oldPrice: Math.round(u.price * 0.97), newPrice: u.price })),
    },
    {
      id: 'pd-2', projectId: 'aurora', status: 'draft', title: 'Проект изменений №17603',
      createdBy: 'u-comdir', createdAt: addDays(TODAY, -1),
      items: units.filter((u) => u.buildingId === 'aurora-2' && u.status === 'free').slice(0, 9).map((u) => ({ unitId: u.id, oldPrice: u.price, newPrice: Math.round(u.price * 1.035 / 10) * 10 })),
    },
  ]

  // --- журнал действий ---
  const audit: AuditEntry[] = []
  const auditAuthors = ['Айгуль Осмонова', 'Данияр Токтогулов', 'Гульнара Молдалиева', 'Елена Волкова', 'Тимур Асанов']
  const auditTexts = [
    ['Продажи', 'Создана бронь на 2 дня'], ['Договоры', 'Договор переведён в статус «Активен»'],
    ['Платежи', 'Подтверждён платёж 1 200 $'], ['Ценообразование', 'Опубликован проект изменения цен'],
    ['Заявки', 'Заявка переведена на этап «Показ»'], ['Документы', 'Сформирован договор из шаблона'],
  ]
  for (let i = 0; i < 16; i++) {
    const [module, text] = rPick(rng, auditTexts)
    audit.push({ id: `a${i}`, module: module!, text: text!, author: rPick(rng, auditAuthors), at: addDays(TODAY, -rInt(rng, 0, 20)) })
  }
  audit.sort((a, b) => (a.at < b.at ? 1 : -1))

  // --- уведомления ---
  const notifications: NotificationItem[] = [
    { id: 'n1', text: 'Заявка «Осмонова А.» без ответа 15 минут', at: addDays(TODAY, -0.02), read: false, kind: 'lead' },
    { id: 'n2', text: 'Просрочка 10+ дней по договору Д-2026-1042', at: addDays(TODAY, -0.3), read: false, kind: 'payment' },
    { id: 'n3', text: 'Бронь по объекту 1-108 истекает через сутки', at: addDays(TODAY, -0.5), read: false, kind: 'reservation' },
    { id: 'n4', text: 'Требуется согласование скидки 6% по сделке', at: addDays(TODAY, -1), read: true, kind: 'approval' },
    { id: 'n5', text: 'Курс НБКР обновлён', at: addDays(TODAY, -1), read: true, kind: 'system' },
    { id: 'n6', text: 'Новая заявка с сайта: интерес к ЖК «Панорама»', at: addDays(TODAY, -1.4), read: true, kind: 'lead' },
  ]

  // --- согласование скидок ---
  // Маршрут Менеджер → Руководитель → Директор: в демо нужны все три состояния,
  // иначе экран согласований выглядит пустым и логика не читается.
  const discountRequests: DiscountRequest[] = []
  const discountLeads = leads.filter((l) => l.stage === 'reserved' || l.stage === 'deal').slice(0, 3)
  const discountSetups: { percent: number; reason: string; steps: DiscountRequest['steps']; status: DiscountRequest['status'] }[] = [
    {
      percent: 5, reason: 'Клиент готов внести 50% сразу', status: 'pending',
      steps: [
        { role: 'manager', decision: 'approved', decidedBy: 'Айгуль Осмонова', decidedAt: addDays(TODAY, -1), comment: 'Запрос менеджера' },
        { role: 'head', decision: 'pending' },
      ],
    },
    {
      percent: 9, reason: 'Второй объект в семье, покупали в 2024', status: 'pending',
      steps: [
        { role: 'manager', decision: 'approved', decidedBy: 'Данияр Токтогулов', decidedAt: addDays(TODAY, -3), comment: 'Запрос менеджера' },
        { role: 'head', decision: 'approved', decidedBy: 'Тимур Асанов', decidedAt: addDays(TODAY, -2), comment: 'Поддерживаю, клиент повторный' },
        { role: 'director', decision: 'pending' },
      ],
    },
    {
      percent: 4, reason: 'Угловая квартира, висит четвёртый месяц', status: 'approved',
      steps: [
        { role: 'manager', decision: 'approved', decidedBy: 'Дана Абдыкадырова', decidedAt: addDays(TODAY, -9), comment: 'Запрос менеджера' },
        { role: 'head', decision: 'approved', decidedBy: 'Тимур Асанов', decidedAt: addDays(TODAY, -8), comment: 'Согласовано' },
      ],
    },
  ]
  discountLeads.forEach((lead, i) => {
    const setup = discountSetups[i]
    if (!setup) return
    const unit = units.find((u) => u.id === lead.interestedUnitIds[0]) ?? units.find((u) => u.status === 'reserved')
    const basePrice = unit?.price ?? lead.budget
    discountRequests.push({
      id: `dr-${i + 1}`,
      leadId: lead.id,
      clientId: lead.clientId,
      unitId: unit?.id,
      basePrice,
      percent: setup.percent,
      amount: Math.round(basePrice * (setup.percent / 100)),
      reason: setup.reason,
      requestedBy: managerNames[lead.assignedTo] ?? 'Менеджер',
      requestedById: lead.assignedTo,
      requestedAt: setup.steps[0]?.decidedAt ?? addDays(TODAY, -1),
      status: setup.status,
      steps: setup.steps,
    })
  })

  void AGENT_NAMES
  return { units, clients, leads, reservations, queue, contracts, scheduleItems, payments, priceDrafts, audit, notifications, documents, discountRequests, unitHistory }
}

const seed = build()

export const UNITS = seed.units
export const CLIENTS = seed.clients
export const LEADS = seed.leads
export const RESERVATIONS = seed.reservations
export const QUEUE = seed.queue
export const CLIENT_DOCUMENTS = seed.documents
export const CONTRACTS = seed.contracts
export const SCHEDULE_ITEMS = seed.scheduleItems
export const PAYMENTS = seed.payments
export const PRICE_DRAFTS = seed.priceDrafts
export const AUDIT = seed.audit
export const NOTIFICATIONS = seed.notifications
export const DISCOUNT_REQUESTS = seed.discountRequests
export const UNIT_HISTORY = seed.unitHistory

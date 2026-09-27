// Доменные типы платформы. Соответствуют схеме avenue88_schema_v4.sql,
// упрощены для фронтенд-прототипа с мок-данными.

export type Currency = 'USD' | 'KGS'

export type UnitKind = 'apartment' | 'commercial' | 'parking' | 'storage' | 'cottage' | 'townhouse' | 'land'

export type UnitStatus = 'free' | 'reserved' | 'installment' | 'sold' | 'closed'

export type ReservationKind = 'no_deposit' | 'confirmed' | 'with_deposit'
export type ReservationStatus = 'active' | 'converted' | 'expired' | 'cancelled'

export type LeadStage = 'new' | 'contacted' | 'visit' | 'reserved' | 'deal' | 'lost'

export type DealType = 'regular' | 'barter' | 'barter_land' | 'pledge' | 'preferential'
export type ContractStatus = 'draft' | 'pending_approval' | 'active' | 'paid' | 'terminated'
export type ClientOrigin = 'own' | 'partner' | 'reassignment'
export type ClientKind = 'person' | 'company'

export type PaymentStatus = 'pending' | 'confirmed' | 'rejected'
export type PaymentKind = 'cash' | 'bank' | 'online' | 'barter' | 'exchange' | 'offset' | 'preferential' | 'discount' | 'refund'

export type UserRole =
  | 'admin' | 'director' | 'commercial_director' | 'finance_director'
  | 'manager' | 'care_manager' | 'accountant' | 'cashier' | 'head_cashier'
  | 'controller' | 'lawyer' | 'partner' | 'auditor' | 'agent'

export type PropertyKind = 'residential' | 'commercial' | 'mixed'

export interface MediaAsset {
  id: string
  url: string
  name: string
  kind: 'photo' | 'video'
  addedAt: string
}

export interface Project {
  id: string
  name: string
  propertyKind: PropertyKind
  address: string
  developer: string
  banks: string[]
  currency: Currency
  country: string
  stage: string
  salesStart: string
  infrastructure: string
  website: string
  salesOfficeId: string
  buildingIds: string[]
  accent: string
  archived: boolean
  media: MediaAsset[]
  masterPlans: MediaAsset[]
  /** контуры домов на генплане; refId — `building:<id>` */
  masterPlanZones: ImageZone[]
}

export const COMPASS_SIDES = ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ'] as const
export type CompassSide = typeof COMPASS_SIDES[number]

// экспликация помещения — построчная ведомость комнат с площадями.
// Балконы/лоджии в общую площадь входят с понижающим коэффициентом,
// поэтому тип комнаты важен, а не только её площадь.
export type RoomKind = 'living' | 'kitchen' | 'bath' | 'hall' | 'balcony' | 'storage' | 'terrace' | 'other'

export interface ExplicationRoom {
  id: string
  name: string
  kind: RoomKind
  area: number
}

export interface UnitTypePreset {
  id: string
  name: string
  rooms: number
  area: number
  imageUrl: string | null
  orientation: CompassSide[]
  visible: boolean
  explication: ExplicationRoom[]
  /** разметка комнат на изображении планировки; refId — id строки экспликации */
  roomZones: ImageZone[]
}

export interface FloorPlan {
  floor: number
  name: string
  imageUrl: string | null
  zones: ImageZone[]
}

export interface FacadeMark {
  floor: number
  color: string
  label: string
}

export type FacadeTag = 'none' | 'yard' | 'street' | 'lobby' | 'masterplan' | 'playground' | 'sport'

// один вид фасада (ракурс) со своей разметкой — как в Profitbase, где у дома
// список изображений: «Вид со стороны парка», «Вид с улицы Лермонтова» и т.д.,
// каждое со своим тегом, признаком публикации и собственной картой областей
export interface FacadeView {
  id: string
  name: string
  imageUrl: string | null
  tag: FacadeTag
  published: boolean
  zones: ImageZone[]
}

export interface ZonePoint {
  x: number
  y: number
}

// область на изображении (фасад, план этажа). Координаты точек нормализованы
// 0..1 от размеров картинки, чтобы разметка не зависела от масштаба показа.
// shape: 'rect' — две точки (противоположные углы), 'poly' — контур по точкам.
export interface ImageZone {
  id: string
  shape: 'rect' | 'poly'
  points: ZonePoint[]
  refId: string
  label: string
  color: string
}

export interface Building {
  id: string
  projectId: string
  name: string
  defaultUnitKind: UnitKind
  structureType: 'residential' | 'non_residential'
  constructionStage: 'planning' | 'foundation' | 'frame' | 'facade' | 'finishing' | 'commissioned'
  address: string
  contractAddress: string
  finishing: string
  material: string
  cadastralNumber: string
  constructionStart: string
  constructionEnd: string
  deliveryDate: string
  salesStart: string
  salesEnd: string
  elevatorsPassenger: number
  elevatorsFreight: number
  hasTrashChute: boolean
  hasShowroom: boolean
  slogan: string
  salesOfficeId: string
  sections: number
  floors: number
  floorsBelow: number
  archived: boolean
  badge: string | null
  pdfImageUrl: string | null
  facades: FacadeView[]
  facadeMarks: FacadeMark[]
  unitTypePresets: UnitTypePreset[]
  floorPlans: FloorPlan[]
  fill: {
    board: boolean
    layouts: boolean
    floorPlans: boolean
    facades: boolean
    masterPlan: boolean
  }
}

export interface Unit {
  id: string
  number: string
  buildingId: string
  projectId: string
  section: number
  floor: number
  kind: UnitKind
  rooms: number
  area: number
  status: UnitStatus
  price: number
  basePrice: number
  finishing: 'none' | 'rough' | 'fine' | 'furnished'
  reservationId?: string
  contractId?: string
  layoutName?: string
  keysIssued?: boolean
  layoutPresetId?: string
  imageUrl?: string
  // своя экспликация помещения; если не задана — берётся из планировки
  explication?: ExplicationRoom[]
  // разметка комнат на своём файле планировки (imageUrl); если файла нет,
  // показывается разметка планировки-типа
  roomZones?: ImageZone[]
}

export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed'

export interface Client {
  id: string
  kind: ClientKind
  name: string
  phone: string
  email?: string
  origin: ClientOrigin
  passportMasked?: string
  createdAt: string
  note?: string
  /** ИНН — без него не печатается договор и не выставляется счёт */
  inn?: string
  birthDate?: string
  address?: string
  maritalStatus?: MaritalStatus
  /** откуда пришёл первый раз; у заявки свой источник, здесь — сводный */
  source?: string
  /** особое внимание: повторные покупки, крупные суммы, партнёры */
  vip?: boolean
  /** WhatsApp отличается от основного телефона нечасто, но отличается */
  whatsapp?: string
}

export type LeadPriority = 'low' | 'normal' | 'high'

export type LeadTaskKind = 'call' | 'meeting' | 'visit' | 'document' | 'other'

export interface LeadTask {
  id: string
  kind: LeadTaskKind
  title: string
  /** ISO с временем: менеджер планирует день по часам, а не по датам */
  dueAt: string
  assignedTo: string
  done: boolean
  doneAt?: string
  /** итог выполнения — «дозвонился», «не ответил», «перенёс» */
  result?: string
  /** предыдущий срок, если задачу переносили */
  rescheduledFrom?: string
}

export type CommKind = 'call_out' | 'call_in' | 'whatsapp' | 'email' | 'meeting'
export type CommOutcome = 'answered' | 'no_answer' | 'callback'

/** Факт коммуникации с клиентом. Телефонии нет — фиксируем вручную. */
export interface LeadComm {
  id: string
  kind: CommKind
  at: string
  durationSec?: number
  outcome?: CommOutcome
  note?: string
  author: string
}

export type PaymentPlanKind = 'full' | 'installment' | 'mortgage'

/**
 * Структурированный интерес клиента. Из него собирается подбор квартир —
 * поэтому это не свободный текст, а поля, по которым реально фильтруется фонд.
 */
export interface LeadInterest {
  projectIds: string[]
  buildingIds: string[]
  roomsMin?: number
  roomsMax?: number
  areaMin?: number
  areaMax?: number
  floorMin?: number
  floorMax?: number
  budgetMin?: number
  budgetMax?: number
  paymentMethod?: PaymentPlanKind
  comment?: string
}

export type DocKind = 'passport' | 'id_card' | 'contract' | 'annex' | 'receipt' | 'power_of_attorney' | 'mortgage' | 'other'

/** Файл клиента. В прототипе url — object URL, живёт в памяти вкладки. */
export interface ClientDocument {
  id: string
  clientId: string
  leadId?: string
  contractId?: string
  kind: DocKind
  name: string
  url: string
  mime: string
  sizeBytes: number
  uploadedBy: string
  uploadedAt: string
  signed: boolean
  signedAt?: string
}

/** Запись истории помещения — цена, статус, бронь, договор. */
export interface UnitHistoryEntry {
  id: string
  unitId: string
  at: string
  author: string
  kind: 'price' | 'status' | 'reservation' | 'contract'
  from?: string
  to?: string
  note?: string
}

export interface LeadNote {
  id: string
  text: string
  author: string
  at: string
}

export type LeadEventKind = 'created' | 'stage' | 'note' | 'task' | 'task_done' | 'assign' | 'field' | 'lost' | 'won' | 'call'

/** Запись ленты событий заявки — то, что в CRM показывают вкладкой «История». */
export interface LeadEvent {
  id: string
  kind: LeadEventKind
  text: string
  author: string
  at: string
}

export interface Lead {
  id: string
  clientId: string
  stage: LeadStage
  channel: string
  source: string
  createdAt: string
  assignedTo: string
  interestedUnitIds: string[]
  /** бюджет клиента — по нему считается сумма в шапке колонки воронки */
  budget: number
  priority: LeadPriority
  tags: string[]
  /** когда заявка попала на текущий этап — из этого считается «висит N дней» */
  stageSince: string
  lastContactAt?: string
  tasks: LeadTask[]
  notes: LeadNote[]
  history: LeadEvent[]
  /** зафиксированные звонки и переписка — попадают в общую ленту */
  comms: LeadComm[]
  /** параметры подбора; budget выше остаётся как рабочая сумма для воронки */
  interest: LeadInterest
  lostReason?: string
  lostAt?: string
  // устаревшие поля-однострочники, оставлены для совместимости с виджетами
  nextAction?: string
  nextAt?: string
}

/* ------------------------- согласование скидок --------------------------- */

export type ApprovalRole = 'manager' | 'head' | 'director'
export type ApprovalDecision = 'pending' | 'approved' | 'rejected'

/** Одно решение в маршруте согласования. История решений — это список таких шагов. */
export interface ApprovalStep {
  role: ApprovalRole
  decision: ApprovalDecision
  decidedBy?: string
  decidedAt?: string
  comment?: string
}

/**
 * Запрос на скидку. Скидка выше лимита менеджера не применяется молча:
 * она идёт по маршруту Менеджер → Руководитель → Директор, и каждый шаг
 * остаётся в истории — иначе на вопрос «кто разрешил −12%» ответа нет.
 */
export interface DiscountRequest {
  id: string
  leadId?: string
  clientId: string
  unitId?: string
  contractId?: string
  basePrice: number
  percent: number
  amount: number
  reason: string
  requestedBy: string
  requestedById: string
  requestedAt: string
  status: ApprovalDecision
  steps: ApprovalStep[]
}

export interface Reservation {
  id: string
  unitId: string
  clientId: string
  leadId?: string
  kind: ReservationKind
  deposit: number
  createdAt: string
  expiresAt: string
  status: ReservationStatus
  createdBy: string
}

export interface QueueEntry {
  unitId: string
  clientId: string
  name: string
  phone: string
  addedAt: string
}

export interface ScheduleItem {
  id: string
  contractId: string
  dueDate: string
  amount: number
  paid: number
  version: number
}

export interface Payment {
  id: string
  contractId: string
  date: string
  amount: number
  currency: Currency
  kind: PaymentKind
  status: PaymentStatus
  receiptNumber?: string
  note?: string
}

export interface Contract {
  id: string
  number: string
  projectId: string
  clientId: string
  unitIds: string[]
  dealType: DealType
  status: ContractStatus
  currency: Currency
  price: number
  discount: number
  signedAt?: string
  createdAt: string
  route: 'company' | 'notary' | 'state_registry'
  agentId?: string
  /** заявка, из которой выросла сделка — без неё не посчитать источник продажи */
  leadId?: string
  /** кто закрыл сделку; заявка может не сохраниться, а менеджер у договора есть всегда */
  managerId?: string
  /** способ оплаты из справочника настроек */
  paymentMethodId?: string
  /** банк-партнёр для ипотеки; у рассрочки застройщика его нет */
  bank?: string
}

export interface PriceChangeItem {
  unitId: string
  oldPrice: number
  newPrice: number
}

export interface PriceDraft {
  id: string
  projectId: string
  status: 'draft' | 'published'
  title: string
  createdBy: string
  createdAt: string
  publishedAt?: string
  items: PriceChangeItem[]
}

export interface Promotion {
  id: string
  name: string
  scope: 'unit_type' | 'unit_kind' | 'floor_level' | 'block' | 'units'
  value: number
  isPercent: boolean
  active: boolean
  public: boolean
  projectIds: string[]
}

export interface PaymentMethod {
  id: string
  name: string
  kind: 'full' | 'installment' | 'mortgage'
  active: boolean
  public: boolean
  affectsPrice: boolean
  projectIds: string[]
}

export interface UnitOption {
  id: string
  name: string
  price: number
  active: boolean
  projectIds: string[]
}

export interface DocumentTemplate {
  id: string
  name: string
  process: string
  source: 'Google Документы' | 'LibreOffice'
  numberFormat: string
  active: boolean
  updatedAt: string
}

export interface TemplateVariable {
  group: string
  name: string
  code: string
  hint: string
}

export interface SalesOffice {
  id: string
  name: string
  address: string
  phone: string
  projectIds: string[]
}

export interface AppUser {
  id: string
  name: string
  role: UserRole
  email: string
  phone: string
  projectIds: string[]
  active: boolean
  avatarColor: string
}

export interface AuditEntry {
  id: string
  module: string
  text: string
  author: string
  at: string
}

export interface NotificationItem {
  id: string
  text: string
  at: string
  read: boolean
  kind: 'lead' | 'payment' | 'reservation' | 'system' | 'approval'
}

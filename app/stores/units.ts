import * as repo from '~/repositories/units'
import { uid } from '~/repositories/api'
import type { Building, ExplicationRoom, FacadeMark, FacadeTag, FacadeView, ImageZone, MediaAsset, Project, QueueEntry, Unit, UnitHistoryEntry, UnitStatus, UnitTypePreset } from '~/types/models'
import { defaultExplication } from '~/utils/explication'

export const useUnitsStore = defineStore('units', {
  state: () => ({
    projects: [] as Project[],
    buildings: [] as Building[],
    units: [] as Unit[],
    queue: [] as QueueEntry[],
    unitHistory: [] as UnitHistoryEntry[],
    loaded: false,
    loading: false,
  }),
  getters: {
    project: (s) => (id: string) => s.projects.find((p) => p.id === id),
    building: (s) => (id: string) => s.buildings.find((b) => b.id === id),
    unit: (s) => (id: string) => s.units.find((u) => u.id === id),
    buildingsByProject: (s) => (projectId: string) => s.buildings.filter((b) => b.projectId === projectId),
    unitsByBuilding: (s) => (buildingId: string) => s.units.filter((u) => u.buildingId === buildingId),
    unitsByProject: (s) => (projectId: string) => s.units.filter((u) => u.projectId === projectId),
    queueFor: (s) => (unitId: string) => s.queue.filter((q) => q.unitId === unitId),
    historyFor: (s) => (unitId: string) =>
      s.unitHistory.filter((h) => h.unitId === unitId).sort((a, b) => b.at.localeCompare(a.at)),
    fillPercent: () => (b: Building) => {
      const vals = Object.values(b.fill)
      return Math.round((vals.filter(Boolean).length / vals.length) * 100)
    },

    // Заполнение разделов дома — считается по фактическим данным, а не по
    // галочкам: та же логика, что у Profitbase в плашках над карточкой дома.
    sectionFill: (s) => (b: Building) => {
      const units = s.units.filter((u) => u.buildingId === b.id)
      const apartments = units.filter((u) => u.kind !== 'parking' && u.kind !== 'storage')

      // шахматка: у помещения должны быть номер, площадь и цена
      const boardOk = units.filter((u) => u.number && u.area > 0 && u.price > 0).length
      const board = units.length ? Math.round((boardOk / units.length) * 100) : 0

      // планировки помещений: доля квартир, привязанных к планировке с картинкой
      const withImage = new Set(b.unitTypePresets.filter((p) => p.imageUrl).map((p) => p.id))
      const linked = apartments.filter((u) => u.layoutPresetId && withImage.has(u.layoutPresetId)).length
      const layouts = apartments.length ? Math.round((linked / apartments.length) * 100) : 0

      // планы этажей: загружена картинка + размечены помещения
      const withPlan = b.floorPlans.filter((f) => f.imageUrl).length
      const withZones = b.floorPlans.filter((f) => f.imageUrl && f.zones.length).length
      const floorPlans = b.floors ? Math.round(((withPlan + withZones) / (b.floors * 2)) * 100) : 0

      // фасады: опубликованный ракурс с картинкой + покрытие этажей разметкой
      const withPhoto = b.facades.filter((f) => f.imageUrl).length
      const publishedOk = b.facades.filter((f) => f.imageUrl && f.published).length
      const markedFloors = new Set(b.facades.flatMap((f) => f.zones.map((z) => z.refId))).size
      const facadeParts = [
        withPhoto ? 1 : 0,
        publishedOk ? 1 : 0,
        b.floors ? Math.min(markedFloors / b.floors, 1) : 0,
      ]
      const facades = Math.round((facadeParts.reduce((a, c) => a + c, 0) / 3) * 100)

      return { board, layouts, floorPlans, facades }
    },
    projectStats: (s) => (projectId: string) => {
      const units = s.units.filter((u) => u.projectId === projectId)
      const total = units.length
      const sold = units.filter((u) => u.status === 'sold').length
      const installment = units.filter((u) => u.status === 'installment').length
      const reserved = units.filter((u) => u.status === 'reserved').length
      const free = units.filter((u) => u.status === 'free').length
      const revenue = units.filter((u) => u.status === 'sold' || u.status === 'installment').reduce((sum, u) => sum + u.price, 0)
      return { total, sold, installment, reserved, free, revenue, soldPct: total ? Math.round(((sold + installment) / total) * 100) : 0 }
    },
  },
  actions: {
    async load() {
      if (this.loaded || this.loading) return
      this.loading = true
      const [projects, buildings, units, queue] = await Promise.all([
        repo.fetchProjects(), repo.fetchBuildings(), repo.fetchUnits(), repo.fetchQueue(),
      ])
      this.projects = projects
      this.buildings = buildings
      this.units = units
      this.queue = queue
      this.loaded = true
      this.loading = false
    },
    setStatus(unitId: string, status: UnitStatus, author = 'Система') {
      const u = this.units.find((x) => x.id === unitId)
      if (u && u.status !== status) {
        this.logUnitChange(unitId, 'status', u.status, status, author)
        u.status = status
      }
      repo.updateUnitStatus(unitId, status)
    },

    /** Журнал изменений помещения — нужен в карточке и при спорах с клиентом. */
    logUnitChange(unitId: string, kind: UnitHistoryEntry['kind'], from: string | undefined, to: string | undefined, author: string, note?: string) {
      this.unitHistory.unshift({ id: uid('uh'), unitId, at: new Date().toISOString(), author, kind, from, to, note })
    },
    async addToQueue(unitId: string, name: string, phone: string, clientId = '') {
      const entry = await repo.addToQueue({ unitId, clientId, name, phone })
      this.queue.push(entry)
    },
    async removeFromQueue(unitId: string, index: number) {
      const item = this.queueFor(unitId)[index]
      if (!item) return
      this.queue = this.queue.filter((q) => q !== item)
      await repo.removeFromQueue(unitId, item.clientId)
    },
    offerToNextInQueue(unitId: string) {
      const list = this.queueFor(unitId)
      if (!list.length) return null
      const next = list[0]!
      this.queue = this.queue.filter((q) => q !== next)
      const u = this.units.find((x) => x.id === unitId)
      if (u) u.status = 'reserved'
      return next
    },
    applyPriceItems(items: { unitId: string; newPrice: number }[]) {
      for (const item of items) {
        const u = this.units.find((x) => x.id === item.unitId)
        if (u) u.price = item.newPrice
      }
    },

    // --- проекты (ЖК) ---
    createProject(data: Omit<Project, 'id' | 'buildingIds' | 'archived' | 'media' | 'masterPlans'>) {
      const project: Project = { ...data, id: uid('proj'), buildingIds: [], archived: false, media: [], masterPlans: [] }
      this.projects.unshift(project)
      repo.saveProject(project)
      return project
    },
    updateProject(id: string, patch: Partial<Project>) {
      const p = this.project(id)
      if (!p) return
      Object.assign(p, patch)
      repo.saveProject(p)
    },
    toggleProjectArchive(id: string) {
      const p = this.project(id)
      if (p) { p.archived = !p.archived; repo.saveProject(p) }
    },
    addMedia(projectId: string, file: { url: string; name: string; kind: 'photo' | 'video' }) {
      const p = this.project(projectId)
      if (!p) return
      const asset: MediaAsset = { ...file, id: uid('media'), addedAt: new Date().toISOString() }
      p.media.unshift(asset)
    },
    removeMedia(projectId: string, assetId: string) {
      const p = this.project(projectId)
      if (p) p.media = p.media.filter((m) => m.id !== assetId)
    },
    addMasterPlan(projectId: string, file: { url: string; name: string }) {
      const p = this.project(projectId)
      if (!p) return
      p.masterPlans.unshift({ ...file, id: uid('genplan'), kind: 'photo', addedAt: new Date().toISOString() })
    },
    removeMasterPlan(projectId: string, assetId: string) {
      const p = this.project(projectId)
      if (p) p.masterPlans = p.masterPlans.filter((m) => m.id !== assetId)
    },

    // --- дома ---
    createBuilding(projectId: string, data: Partial<Building> & { name: string }) {
      const building: Building = {
        id: uid('bld'), projectId, defaultUnitKind: 'apartment', structureType: 'residential',
        constructionStage: 'planning', address: '', contractAddress: '', finishing: '', material: '',
        cadastralNumber: '', constructionStart: '', constructionEnd: '', deliveryDate: '',
        salesStart: '', salesEnd: '', elevatorsPassenger: 1, elevatorsFreight: 1, hasTrashChute: false,
        hasShowroom: false, slogan: '', salesOfficeId: '', sections: 1, floors: 1, floorsBelow: 0,
        archived: false, badge: null, pdfImageUrl: null, facades: [], facadeMarks: [],
        unitTypePresets: [], floorPlans: [], fill: { board: false, layouts: false, floorPlans: false, facades: false, masterPlan: false },
        ...data,
      }
      this.buildings.push(building)
      const p = this.project(projectId)
      if (p) p.buildingIds.push(building.id)
      repo.saveBuilding(building)
      return building
    },
    updateBuilding(id: string, patch: Partial<Building>) {
      const b = this.building(id)
      if (!b) return
      Object.assign(b, patch)
      repo.saveBuilding(b)
    },
    toggleBuildingArchive(id: string) {
      const b = this.building(id)
      if (b) { b.archived = !b.archived; repo.saveBuilding(b) }
    },
    setFacadeMarks(buildingId: string, marks: FacadeMark[]) {
      const b = this.building(buildingId)
      if (!b) return
      b.facadeMarks = marks
      repo.saveBuilding(b)
    },

    // --- фасады: список ракурсов, у каждого своя картинка и своя разметка ---
    facade(buildingId: string, facadeId: string) {
      return this.building(buildingId)?.facades.find((f) => f.id === facadeId)
    },
    addFacade(buildingId: string, data: Partial<FacadeView> = {}) {
      const b = this.building(buildingId)
      if (!b) return
      const view: FacadeView = {
        id: uid('facade'), name: data.name ?? `Ракурс ${b.facades.length + 1}`,
        imageUrl: data.imageUrl ?? null, tag: data.tag ?? 'none', published: data.published ?? false,
        zones: data.zones ?? [],
      }
      b.facades.push(view)
      this.syncFacadeFill(b)
      repo.saveBuilding(b)
      return view
    },
    updateFacade(buildingId: string, facadeId: string, patch: Partial<Omit<FacadeView, 'id'>>) {
      const b = this.building(buildingId)
      const view = b?.facades.find((f) => f.id === facadeId)
      if (!b || !view) return
      Object.assign(view, patch)
      this.syncFacadeFill(b)
      repo.saveBuilding(b)
    },
    setFacadeTag(buildingId: string, facadeId: string, tag: FacadeTag) {
      this.updateFacade(buildingId, facadeId, { tag })
    },
    toggleFacadePublished(buildingId: string, facadeId: string) {
      const view = this.facade(buildingId, facadeId)
      if (view) this.updateFacade(buildingId, facadeId, { published: !view.published })
    },
    removeFacade(buildingId: string, facadeId: string) {
      const b = this.building(buildingId)
      if (!b) return
      b.facades = b.facades.filter((f) => f.id !== facadeId)
      this.syncFacadeFill(b)
      repo.saveBuilding(b)
    },
    moveFacade(buildingId: string, facadeId: string, dir: -1 | 1) {
      const b = this.building(buildingId)
      if (!b) return
      const i = b.facades.findIndex((f) => f.id === facadeId)
      const j = i + dir
      if (i < 0 || j < 0 || j >= b.facades.length) return
      const [item] = b.facades.splice(i, 1)
      if (item) b.facades.splice(j, 0, item)
      repo.saveBuilding(b)
    },
    setFacadeZones(buildingId: string, facadeId: string, zones: ImageZone[]) {
      const b = this.building(buildingId)
      const view = b?.facades.find((f) => f.id === facadeId)
      if (!b || !view) return
      view.zones = zones
      this.syncFacadeFill(b)
      repo.saveBuilding(b)
    },
    syncFacadeFill(b: Building) {
      b.fill.facades = b.facades.some((f) => f.imageUrl && f.published)
    },
    setFloorPlanImage(buildingId: string, floor: number, url: string | null, name?: string) {
      const b = this.building(buildingId)
      if (!b) return
      const existing = b.floorPlans.find((f) => f.floor === floor)
      if (existing) { existing.imageUrl = url; if (name) existing.name = name }
      else b.floorPlans.push({ floor, name: name ?? `Этаж ${floor}`, imageUrl: url, zones: [] })
      b.fill.floorPlans = b.floorPlans.some((f) => f.imageUrl)
      repo.saveBuilding(b)
    },
    setFloorPlanZones(buildingId: string, floor: number, zones: ImageZone[]) {
      const b = this.building(buildingId)
      const plan = b?.floorPlans.find((f) => f.floor === floor)
      if (!plan) return
      plan.zones = zones
      if (b) repo.saveBuilding(b)
    },
    addUnitTypePreset(buildingId: string, data: Omit<UnitTypePreset, 'id' | 'explication' | 'roomZones'> & { explication?: ExplicationRoom[] }) {
      const b = this.building(buildingId)
      if (!b) return
      const id = uid('preset')
      // новая планировка сразу получает типовую экспликацию под свою площадь —
      // править готовые строки быстрее, чем набивать ведомость с нуля
      const explication = data.explication
        ?? defaultExplication(data.rooms, data.area).map((r, i) => ({ ...r, id: `${id}-r${i + 1}` }))
      const preset: UnitTypePreset = { ...data, id, explication, roomZones: [] }
      b.unitTypePresets.push(preset)
      b.fill.layouts = true
      repo.saveBuilding(b)
      return preset
    },
    updateUnitTypePreset(buildingId: string, presetId: string, patch: Partial<UnitTypePreset>) {
      const b = this.building(buildingId)
      const preset = b?.unitTypePresets.find((p) => p.id === presetId)
      if (!preset) return
      Object.assign(preset, patch)
      if (b) repo.saveBuilding(b)
    },
    removeUnitTypePreset(buildingId: string, presetId: string) {
      const b = this.building(buildingId)
      if (!b) return
      b.unitTypePresets = b.unitTypePresets.filter((p) => p.id !== presetId)
      for (const u of this.units) if (u.layoutPresetId === presetId) delete u.layoutPresetId
    },
    unitsForPreset(presetId: string) {
      return this.units.filter((u) => u.layoutPresetId === presetId)
    },
    setPresetUnits(buildingId: string, presetId: string, unitIds: string[]) {
      const b = this.building(buildingId)
      if (!b) return
      const selected = new Set(unitIds)
      for (const u of this.units) {
        if (u.buildingId !== buildingId) continue
        if (selected.has(u.id)) u.layoutPresetId = presetId
        else if (u.layoutPresetId === presetId) delete u.layoutPresetId
      }
      repo.saveBuilding(b)
    },
    togglePresetVisibility(buildingId: string, presetId: string) {
      const preset = this.building(buildingId)?.unitTypePresets.find((p) => p.id === presetId)
      if (preset) preset.visible = !preset.visible
    },

    // --- экспликация: своя у помещения, иначе унаследована от планировки ---
    explicationFor(unitId: string): { rooms: ExplicationRoom[]; own: boolean; presetName?: string } {
      const u = this.unit(unitId)
      if (!u) return { rooms: [], own: false }
      if (u.explication?.length) return { rooms: u.explication, own: true }
      const preset = u.layoutPresetId
        ? this.building(u.buildingId)?.unitTypePresets.find((p) => p.id === u.layoutPresetId)
        : undefined
      return { rooms: preset?.explication ?? [], own: false, presetName: preset?.name }
    },
    /**
     * Записать помещению собственную экспликацию. Строки копируем и
     * переименовываем под помещение: ведомость могла прийти из планировки, и
     * присвоить её объекты как есть — значит связать две записи одними id.
     */
    setUnitExplication(unitId: string, rooms: ExplicationRoom[]) {
      const u = this.unit(unitId)
      if (!u) return
      const remap = new Map<string, string>()
      u.explication = rooms.map((r, i) => {
        const id = r.id.startsWith(unitId) ? r.id : `${unitId}-r${i + 1}`
        if (id !== r.id) remap.set(r.id, id)
        return { ...r, id }
      })
      // refId разметки комнат ссылается на id строк — переносим вместе с ними,
      // иначе после первой правки ведомости все области осиротеют
      if (remap.size && u.roomZones?.length) {
        u.roomZones = u.roomZones.map((z) => (remap.has(z.refId) ? { ...z, refId: remap.get(z.refId)! } : z))
      }
    },
    /** Вернуть помещение к экспликации его планировки. */
    resetUnitExplication(unitId: string) {
      const u = this.unit(unitId)
      if (u) delete u.explication
    },
    /** Заполнить экспликацию типовым набором комнат под площадь помещения. */
    fillUnitExplicationFromTemplate(unitId: string) {
      const u = this.unit(unitId)
      if (!u) return
      this.setUnitExplication(unitId, defaultExplication(u.rooms, u.area).map((r, i) => ({ ...r, id: `${unitId}-r${i + 1}` })))
    },
    /** Разметка комнат на изображении планировки — общая для всех её помещений. */
    setPresetRoomZones(buildingId: string, presetId: string, zones: ImageZone[]) {
      const b = this.building(buildingId)
      const preset = b?.unitTypePresets.find((p) => p.id === presetId)
      if (!b || !preset) return
      preset.roomZones = zones
      repo.saveBuilding(b)
    },
    /** Разметка комнат на собственном файле планировки помещения. */
    setUnitRoomZones(unitId: string, zones: ImageZone[]) {
      const u = this.unit(unitId)
      if (u) u.roomZones = zones
    },
    /**
     * Что показывать как разметку комнат помещения: свою (если загружен свой
     * файл планировки) или разметку планировки-типа. Изображение и разметка
     * всегда идут парой — иначе области легли бы на чужой чертёж.
     */
    roomPlanFor(unitId: string) {
      const u = this.unit(unitId)
      if (!u) return null
      const preset = u.layoutPresetId
        ? this.building(u.buildingId)?.unitTypePresets.find((p) => p.id === u.layoutPresetId)
        : undefined
      if (u.imageUrl) {
        return { imageUrl: u.imageUrl, zones: u.roomZones ?? [], own: true, presetName: preset?.name, presetId: preset?.id }
      }
      if (preset?.imageUrl) {
        return { imageUrl: preset.imageUrl, zones: preset.roomZones, own: false, presetName: preset.name, presetId: preset.id }
      }
      return null
    },
    setPresetExplication(buildingId: string, presetId: string, rooms: ExplicationRoom[]) {
      const preset = this.building(buildingId)?.unitTypePresets.find((p) => p.id === presetId)
      if (preset) preset.explication = rooms
    },
    fillPresetExplicationFromTemplate(buildingId: string, presetId: string) {
      const preset = this.building(buildingId)?.unitTypePresets.find((p) => p.id === presetId)
      if (!preset) return
      preset.explication = defaultExplication(preset.rooms, preset.area).map((r, i) => ({ ...r, id: `${presetId}-r${i + 1}` }))
    },

    // --- ручное редактирование шахматки по этажам ---
    addManualUnit(buildingId: string, section: number, floor: number) {
      const b = this.building(buildingId)
      if (!b) return
      const unit: Unit = {
        id: repo.newUnitId(buildingId), buildingId, projectId: b.projectId, number: '', section, floor,
        kind: b.defaultUnitKind, rooms: 1, area: 40, status: 'free', price: 0, basePrice: 0, finishing: 'none',
      }
      this.units.push(unit)
      b.fill.board = true
      return unit
    },
    patchUnit(unitId: string, patch: Partial<Unit>, author = 'Система') {
      const u = this.unit(unitId)
      if (!u) return
      if (patch.price !== undefined && patch.price !== u.price) {
        this.logUnitChange(unitId, 'price', String(u.price), String(patch.price), author)
      }
      if (patch.status !== undefined && patch.status !== u.status) {
        this.logUnitChange(unitId, 'status', u.status, patch.status, author)
      }
      Object.assign(u, patch)
    },
    removeUnit(unitId: string) {
      this.units = this.units.filter((u) => u.id !== unitId)
    },
    setBuildingPdfImage(buildingId: string, url: string | null) {
      const b = this.building(buildingId)
      if (!b) return
      b.pdfImageUrl = url
      repo.saveBuilding(b)
    },
    async importUnits(buildingId: string, rows: Omit<Unit, 'id' | 'buildingId' | 'projectId'>[]) {
      const b = this.building(buildingId)
      if (!b) return []
      const created = rows.map((r) => ({ ...r, id: repo.newUnitId(buildingId), buildingId, projectId: b.projectId }) as Unit)
      await repo.importUnits(created)
      this.units.push(...created)
      b.fill.board = true
      repo.saveBuilding(b)
      return created
    },
  },
})

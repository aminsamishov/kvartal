import { emptyUnitFilters, filtersFromInterest, type UnitFilterState } from '~/utils/unitFilters'
import type { LeadInterest } from '~/types/models'

export type PickerView = 'board' | 'facade' | 'floor' | 'list'

/**
 * Состояние одного рабочего места подбора. Фильтр, выделение и сравнение живут
 * здесь, а не внутри представления: шахматка, фасад, план этажа и список —
 * четыре взгляда на один и тот же набор, поэтому квартира, выбранная на фасаде,
 * обязана оказаться выделенной и в шахматке, и в карточке заявки.
 */
export interface PickerScope {
  view: PickerView
  filters: UnitFilterState
  buildingId: string
  facadeId: string
  floor: number | null
  /** выделенные помещения — порядок сохраняем, по нему строится сравнение */
  selected: string[]
  colorMode: 'status' | 'payment'
  cellSize: 'compact' | 'large'
  /** заявка, под интерес которой считается процент совпадения */
  scoreLeadId: string | null
}

function newScope(): PickerScope {
  return {
    view: 'board',
    filters: emptyUnitFilters(),
    buildingId: '',
    facadeId: '',
    floor: null,
    selected: [],
    colorMode: 'status',
    cellSize: 'compact',
    scoreLeadId: null,
  }
}

export const MAX_COMPARE = 4

export const useBoardStore = defineStore('board', {
  state: () => ({
    /** ключ скоупа: 'board' для страницы шахматки, `lead:<id>` для заявки, 'deal' для мастера */
    scopes: {} as Record<string, PickerScope>,
  }),
  getters: {
    /** Скоуп создаётся по первому обращению — компонентам не нужно его готовить. */
    scope: (s) => (key: string): PickerScope => {
      if (!s.scopes[key]) s.scopes[key] = newScope()
      return s.scopes[key]!
    },
  },
  actions: {
    ensure(key: string) {
      if (!this.scopes[key]) this.scopes[key] = newScope()
      return this.scopes[key]!
    },
    setView(key: string, view: PickerView) {
      this.ensure(key).view = view
    },
    setFilters(key: string, filters: UnitFilterState) {
      this.ensure(key).filters = filters
    },
    resetFilters(key: string) {
      this.ensure(key).filters = emptyUnitFilters()
    },
    setBuilding(key: string, buildingId: string) {
      const scope = this.ensure(key)
      if (scope.buildingId === buildingId) return
      scope.buildingId = buildingId
      // ракурс и этаж принадлежат дому — при смене дома они недействительны
      scope.facadeId = ''
      scope.floor = null
    },
    setFacade(key: string, facadeId: string) {
      this.ensure(key).facadeId = facadeId
    },
    setFloor(key: string, floor: number | null) {
      this.ensure(key).floor = floor
    },
    setColorMode(key: string, mode: 'status' | 'payment') {
      this.ensure(key).colorMode = mode
    },
    setCellSize(key: string, size: 'compact' | 'large') {
      this.ensure(key).cellSize = size
    },

    /* ------------------------------- выделение ------------------------------ */

    toggleSelect(key: string, unitId: string) {
      const scope = this.ensure(key)
      scope.selected = scope.selected.includes(unitId)
        ? scope.selected.filter((id) => id !== unitId)
        : [...scope.selected, unitId]
    },
    select(key: string, unitId: string) {
      const scope = this.ensure(key)
      if (!scope.selected.includes(unitId)) scope.selected = [...scope.selected, unitId]
    },
    selectOnly(key: string, unitId: string) {
      this.ensure(key).selected = [unitId]
    },
    selectMany(key: string, unitIds: string[]) {
      const scope = this.ensure(key)
      scope.selected = [...new Set([...scope.selected, ...unitIds])]
    },
    deselect(key: string, unitId: string) {
      const scope = this.ensure(key)
      scope.selected = scope.selected.filter((id) => id !== unitId)
    },
    clearSelection(key: string) {
      this.ensure(key).selected = []
    },
    /** Выделение после массовой операции: удалённые/проданные из него выпадают. */
    pruneSelection(key: string, validIds: Set<string>) {
      const scope = this.ensure(key)
      scope.selected = scope.selected.filter((id) => validIds.has(id))
    },

    /* -------------------------- привязка к заявке --------------------------- */

    /** Подбор под клиента: фильтр собирается из запроса, включается скоринг. */
    applyInterest(key: string, leadId: string, interest: LeadInterest) {
      const scope = this.ensure(key)
      scope.filters = filtersFromInterest(interest)
      scope.scoreLeadId = leadId
    },
    setScoreLead(key: string, leadId: string | null) {
      this.ensure(key).scoreLeadId = leadId
    },
  },
})

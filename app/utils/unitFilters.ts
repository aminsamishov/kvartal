import type { UnitKind, UnitStatus } from '~/types/models'

export interface UnitFilterState {
  kinds: UnitKind[]
  statuses: UnitStatus[]
  roomsMin: string
  roomsMax: string
  priceMin: string
  priceMax: string
  areaMin: string
  areaMax: string
}

export function emptyUnitFilters(): UnitFilterState {
  return { kinds: [], statuses: [], roomsMin: '', roomsMax: '', priceMin: '', priceMax: '', areaMin: '', areaMax: '' }
}

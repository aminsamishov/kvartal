import { BUILDINGS, PROJECTS, QUEUE, UNIT_HISTORY, UNITS } from '~/data/seed'
import type { Building, Project, QueueEntry, Unit, UnitHistoryEntry, UnitStatus } from '~/types/models'
import { clone, delay, uid } from './api'

export function fetchProjects(): Promise<Project[]> {
  return delay(clone(PROJECTS))
}

export function fetchBuildings(): Promise<Building[]> {
  return delay(clone(BUILDINGS))
}

export function fetchUnits(): Promise<Unit[]> {
  return delay(clone(UNITS), 320)
}

export function fetchQueue(): Promise<QueueEntry[]> {
  return delay(clone(QUEUE), 150)
}

export function fetchUnitHistory(): Promise<UnitHistoryEntry[]> {
  return delay(clone(UNIT_HISTORY), 200)
}

export function updateUnitStatus(unitId: string, status: UnitStatus): Promise<void> {
  return delay(undefined, 120)
}

export function addToQueue(entry: Omit<QueueEntry, 'addedAt'>): Promise<QueueEntry> {
  const full: QueueEntry = { ...entry, addedAt: new Date().toISOString() }
  return delay(full, 150)
}

export function removeFromQueue(unitId: string, clientId: string): Promise<void> {
  return delay(undefined, 100)
}

export function newUnitId(buildingId: string) {
  return uid(`${buildingId}-u`)
}

export function saveProject(project: Project): Promise<Project> {
  return delay(project, 220)
}

export function saveBuilding(building: Building): Promise<Building> {
  return delay(building, 220)
}

export function importUnits(units: Unit[]): Promise<Unit[]> {
  return delay(units, 500)
}

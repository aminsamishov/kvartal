import type { PickerScope } from '~/stores/board'
import { emptyUnitFilters } from '~/utils/unitFilters'

const KEY_PREFIX = 'kvartal:picker:'
/** Версия формата: при изменении полей старые настройки просто игнорируются. */
const VERSION = 1

interface StoredScope {
  view: PickerScope['view']
  filters: PickerScope['filters']
  buildingId: string
  colorMode: PickerScope['colorMode']
  cellSize: PickerScope['cellSize']
  facadeMode?: PickerScope['facadeMode']
}

interface Stored {
  v: number
  scopes: Record<string, StoredScope>
}

/**
 * Скоупы клиента (`lead:<id>`) не сохраняем: их фильтр собирается из запроса
 * конкретного человека, и подставлять туда вчерашние настройки — значит
 * показать менеджеру чужой подбор.
 */
function persistable(key: string) {
  return !key.startsWith('lead:') && !key.startsWith('contract:')
}

function storageKey(userId: string) {
  return `${KEY_PREFIX}${userId || 'anon'}`
}

function read(userId: string): Stored | null {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Stored
    return parsed?.v === VERSION && parsed.scopes ? parsed : null
  } catch {
    return null
  }
}

let watching = false

/**
 * Последние фильтры менеджера. У каждого свой набор домов и свой привычный
 * режим — заново выставлять их при каждом входе значит тратить первые минуты
 * рабочего дня на настройку экрана.
 */
export function restorePickerFilters() {
  if (!import.meta.client) return
  const auth = useAuthStore()
  const board = useBoardStore()
  const userId = auth.user?.id ?? ''

  const stored = read(userId)
  if (stored) {
    for (const [key, value] of Object.entries(stored.scopes)) {
      if (!persistable(key)) continue
      const scope = board.ensure(key)
      scope.view = value.view ?? scope.view
      // поля фильтра дополняем значениями по умолчанию: формат мог пополниться
      scope.filters = { ...emptyUnitFilters(), ...value.filters }
      scope.buildingId = value.buildingId ?? ''
      scope.colorMode = value.colorMode ?? 'status'
      scope.cellSize = value.cellSize ?? 'compact'
      scope.facadeMode = value.facadeMode ?? 'sale'
    }
  }

  if (watching) return
  watching = true

  watch(
    () => board.scopes,
    (scopes) => {
      const out: Record<string, StoredScope> = {}
      for (const [key, scope] of Object.entries(scopes)) {
        if (!persistable(key)) continue
        out[key] = {
          view: scope.view,
          filters: scope.filters,
          buildingId: scope.buildingId,
          colorMode: scope.colorMode,
          cellSize: scope.cellSize,
          facadeMode: scope.facadeMode,
        }
      }
      try {
        localStorage.setItem(storageKey(auth.user?.id ?? ''), JSON.stringify({ v: VERSION, scopes: out } satisfies Stored))
      } catch {
        // приватный режим или переполненное хранилище — подбор работает и без памяти
      }
    },
    { deep: true, flush: 'post' },
  )
}

/** Сбросить сохранённые настройки — пригодится в «сбросить всё». */
export function forgetPickerFilters() {
  if (!import.meta.client) return
  const auth = useAuthStore()
  try {
    localStorage.removeItem(storageKey(auth.user?.id ?? ''))
  } catch {
    // ignore
  }
}

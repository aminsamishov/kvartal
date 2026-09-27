import * as XLSX from 'xlsx'
import type { Building, Project, Unit } from '~/types/models'
import { FINISHING_META } from '~/utils/unitFilters'
import { UNIT_KIND_META, UNIT_STATUS_META } from '~/utils/meta'

export interface ExportContext {
  project?: (id: string) => Project | undefined
  building?: (id: string) => Building | undefined
  /** процент совпадения с запросом клиента — если подбор шёл под заявку */
  score?: (id: string) => number | undefined
}

/**
 * Выгрузка выбранных помещений. Менеджер отправляет клиенту подборку в Excel —
 * это до сих пор самый частый канал, и подборка должна быть готовой таблицей,
 * а не скриншотом шахматки.
 */
export function exportUnitsToXlsx(units: Unit[], ctx: ExportContext = {}, fileName = 'подборка-квартир.xlsx') {
  const rows = units.map((u) => {
    const row: Record<string, string | number> = {
      'Проект': ctx.project?.(u.projectId)?.name ?? '',
      'Дом': ctx.building?.(u.buildingId)?.name ?? '',
      'Номер': u.number,
      'Тип': UNIT_KIND_META[u.kind].label,
      'Секция': u.section || '',
      'Этаж': u.floor,
      'Комнат': u.rooms || '',
      'Площадь, м²': u.area,
      'Отделка': FINISHING_META[u.finishing],
      'Цена, $': u.price,
      'Цена за м², $': u.area ? Math.round(u.price / u.area) : '',
      'Статус': UNIT_STATUS_META[u.status].label,
    }
    const score = ctx.score?.(u.id)
    if (score !== undefined) row['Совпадение, %'] = score
    return row
  })

  const sheet = XLSX.utils.json_to_sheet(rows)
  // ширины по смыслу колонок: без них «Цена за м², $» схлопывается в «####»
  sheet['!cols'] = [
    { wch: 18 }, { wch: 12 }, { wch: 9 }, { wch: 13 }, { wch: 8 }, { wch: 7 },
    { wch: 8 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 13 }, { wch: 14 },
  ]
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'Подборка')
  XLSX.writeFile(book, fileName)
}

/** Сводка по выделению: сумма, площадь, средняя цена метра. */
export function selectionSummary(units: Unit[]) {
  const sum = units.reduce((s, u) => s + u.price, 0)
  const area = units.reduce((s, u) => s + u.area, 0)
  return {
    count: units.length,
    sum,
    area: Math.round(area * 10) / 10,
    perM2: area ? Math.round(sum / area) : 0,
  }
}

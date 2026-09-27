<script setup lang="ts">
import * as XLSX from 'xlsx'
import type { Building, Unit, UnitKind } from '~/types/models'
import { UNIT_KIND_META } from '~/utils/meta'

const props = defineProps<{ building: Building }>()
const unitsStore = useUnitsStore()
const ui = useUiStore()

const step = ref(0)
const steps = ['Файл', 'Сопоставление полей', 'Проверка и импорт']

type FieldKey = 'number' | 'section' | 'floor' | 'kind' | 'rooms' | 'area' | 'price' | 'finishing' | 'ignore'
const FIELD_LABELS: Record<FieldKey, string> = {
  number: 'Номер помещения', section: 'Секция', floor: 'Этаж', kind: 'Тип помещения',
  rooms: 'Комнат', area: 'Площадь, м²', price: 'Цена', finishing: 'Отделка', ignore: 'Не использовать',
}
const GUESS: [RegExp, FieldKey][] = [
  [/номер|№|number/i, 'number'], [/секц|подъезд|section/i, 'section'], [/этаж|floor/i, 'floor'],
  [/тип|kind/i, 'kind'], [/комнат|room/i, 'rooms'], [/площад|area|м2|м²/i, 'area'],
  [/цена|стоимост|price/i, 'price'], [/отделк|finish/i, 'finishing'],
]

const fileName = ref('')
const headers = ref<string[]>([])
const rawRows = ref<string[][]>([])
const mapping = ref<Record<number, FieldKey>>({})

function guessField(header: string): FieldKey {
  const found = GUESS.find(([re]) => re.test(header))
  return found ? found[1] : 'ignore'
}

async function onFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  fileName.value = file.name
  // .csv читаем как текст (UTF-8 по умолчанию у File.text(), со снятием BOM) —
  // иначе XLSX.read по сырым байтам иногда угадывает не ту кодировку и кириллица бьётся.
  // .xlsx/.xls — бинарные форматы с собственной кодировкой, их читаем как есть.
  const isCsv = /\.csv$/i.test(file.name) || file.type === 'text/csv'
  const wb = isCsv ? XLSX.read(await file.text(), { type: 'string' }) : XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]!]!
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '' })
  if (!rows.length) { ui.toast('Файл пустой или не удалось прочитать', 'bad'); return }
  headers.value = (rows[0] as string[]).map((h) => String(h ?? '').trim())
  rawRows.value = rows.slice(1).filter((r) => r.some((c) => String(c ?? '').trim())) as string[][]
  mapping.value = Object.fromEntries(headers.value.map((h, i) => [i, guessField(h)]))
  step.value = 1
}

function downloadTemplate() {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([
    ['Номер', 'Секция', 'Этаж', 'Тип', 'Комнат', 'Площадь', 'Цена', 'Отделка'],
    ['101', '1', '1', 'apartment', '2', '63.5', '40000', 'Черновая'],
  ])
  XLSX.utils.book_append_sheet(wb, ws, 'Помещения')
  XLSX.writeFile(wb, 'шаблон-импорта-помещений.xlsx')
}

const mappedRequired = computed(() => new Set(Object.values(mapping.value)))
const canProceedMapping = computed(() => mappedRequired.value.has('number') && mappedRequired.value.has('floor') && mappedRequired.value.has('area') && mappedRequired.value.has('price'))

interface ParsedRow { ok: boolean; error?: string; number: string; section: number; floor: number; kind: UnitKind; rooms: number; area: number; price: number; finishing: string }

const parsedRows = computed<ParsedRow[]>(() => {
  const colFor = (field: FieldKey) => Number(Object.entries(mapping.value).find(([, v]) => v === field)?.[0])
  const numberCol = colFor('number'); const sectionCol = colFor('section'); const floorCol = colFor('floor')
  const kindCol = colFor('kind'); const roomsCol = colFor('rooms'); const areaCol = colFor('area')
  const priceCol = colFor('price'); const finishCol = colFor('finishing')
  return rawRows.value.map((r) => {
    const number = String(r[numberCol] ?? '').trim()
    const floor = Number(r[floorCol])
    const area = Number(String(r[areaCol] ?? '').replace(',', '.'))
    const price = Number(String(r[priceCol] ?? '').replace(/\s/g, '').replace(',', '.'))
    const kindRaw = String(r[kindCol] ?? '').trim().toLowerCase()
    const kind: UnitKind = (Object.keys(UNIT_KIND_META) as UnitKind[]).includes(kindRaw as UnitKind) ? (kindRaw as UnitKind) : props.building.defaultUnitKind
    const rooms = Number.isFinite(Number(r[roomsCol])) ? Number(r[roomsCol]) : 0
    const section = Number.isFinite(Number(r[sectionCol])) ? Number(r[sectionCol]) : 1
    const finishing = String(r[finishCol] ?? '').trim()
    const ok = !!number && Number.isFinite(floor) && Number.isFinite(area) && area > 0 && Number.isFinite(price) && price > 0
    return { ok, error: ok ? undefined : 'Проверьте номер, этаж, площадь и цену', number, section, floor, kind, rooms, area, price, finishing }
  })
})
const validCount = computed(() => parsedRows.value.filter((r) => r.ok).length)

const importing = ref(false)
const done = ref(false)
async function confirmImport() {
  importing.value = true
  const good = parsedRows.value.filter((r) => r.ok)
  await unitsStore.importUnits(props.building.id, good.map((r) => ({
    number: r.number, section: r.section, floor: r.floor, kind: r.kind, rooms: r.rooms, area: r.area,
    status: 'free', price: r.price, basePrice: r.price,
    finishing: (['none', 'rough', 'fine', 'furnished'].includes(r.finishing.toLowerCase()) ? r.finishing.toLowerCase() : 'none') as Unit['finishing'],
  })))
  importing.value = false
  done.value = true
  ui.toast(`Импортировано объектов: ${good.length}`, 'ok')
}

function reset() {
  step.value = 0; fileName.value = ''; headers.value = []; rawRows.value = []; mapping.value = {}; done.value = false
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <StepsHeader :steps="steps" :current="step" />

    <AppCard v-if="step === 0" title="Загрузите файл" subtitle="Экспликация помещений — Excel (.xlsx) или CSV, первая строка — заголовки столбцов">
      <label class="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-line py-12 text-center hover:border-plum">
        <Icon name="ph:file-xls" size="34" class="text-plum" />
        <span class="text-[13.5px] font-semibold">Выберите файл или перетащите сюда</span>
        <span class="text-[12px] text-muted">.xlsx, .xls, .csv</span>
        <input type="file" accept=".xlsx,.xls,.csv" class="hidden" @change="onFile">
      </label>
      <button type="button" class="mt-4 flex items-center gap-1.5 text-[12.5px] font-semibold text-plum hover:underline" @click="downloadTemplate">
        <Icon name="ph:download-simple" size="14" /> Скачать шаблон Excel
      </button>
    </AppCard>

    <AppCard v-else-if="step === 1" title="Сопоставление полей" :subtitle="`Файл «${fileName}» — ${rawRows.length} строк. Укажите, какому полю соответствует каждый столбец`">
      <div class="overflow-x-auto rounded-xl2 border border-line">
        <table class="data-table">
          <thead><tr><th>Столбец файла</th><th>Пример</th><th>Поле</th></tr></thead>
          <tbody>
            <tr v-for="(h, i) in headers" :key="i">
              <td class="font-medium">{{ h || `Столбец ${i + 1}` }}</td>
              <td class="text-muted">{{ rawRows[0]?.[i] ?? '—' }}</td>
              <td>
                <select v-model="mapping[i]" class="focus-ring rounded-lg border border-line bg-panel px-2 py-1.5 text-[12.5px]">
                  <option v-for="(label, key) in FIELD_LABELS" :key="key" :value="key">{{ label }}</option>
                </select>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="!canProceedMapping" class="mt-3 flex items-center gap-1.5 text-[12.5px] text-warn">
        <Icon name="ph:warning" size="14" /> Обязательно сопоставьте: номер, этаж, площадь, цену
      </p>
      <div class="mt-4 flex justify-between">
        <AppButton icon="ph:arrow-left" @click="reset">Назад</AppButton>
        <AppButton variant="primary" icon-right="ph:arrow-right" :disabled="!canProceedMapping" @click="step = 2">Далее</AppButton>
      </div>
    </AppCard>

    <AppCard v-else-if="step === 2 && !done" title="Проверка перед импортом" :subtitle="`Корректных строк: ${validCount} из ${parsedRows.length}`">
      <div class="max-h-[360px] overflow-auto rounded-xl2 border border-line">
        <table class="data-table">
          <thead><tr><th>№</th><th>Секция</th><th>Этаж</th><th>Тип</th><th>Комнат</th><th>Площадь</th><th>Цена</th><th>Статус</th></tr></thead>
          <tbody>
            <tr v-for="(r, i) in parsedRows.slice(0, 60)" :key="i" :class="r.ok ? '' : 'bg-bad-bg'">
              <td class="tabular font-semibold">{{ r.number || '—' }}</td>
              <td class="tabular">{{ r.section }}</td>
              <td class="tabular">{{ r.floor }}</td>
              <td>{{ UNIT_KIND_META[r.kind]?.label }}</td>
              <td class="tabular">{{ r.rooms || '—' }}</td>
              <td class="tabular">{{ r.area || '—' }}</td>
              <td class="tabular">{{ r.price || '—' }}</td>
              <td><StatusTag :tone="r.ok ? 'ok' : 'bad'" size="sm">{{ r.ok ? 'Готово' : 'Ошибка' }}</StatusTag></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="parsedRows.length > 60" class="mt-2 text-[12px] text-muted">Показаны первые 60 строк из {{ parsedRows.length }}.</p>
      <div class="mt-4 flex justify-between">
        <AppButton icon="ph:arrow-left" @click="step = 1">Назад</AppButton>
        <AppButton variant="primary" icon="ph:upload-simple" :loading="importing" :disabled="!validCount" @click="confirmImport">Импортировать {{ validCount }} объектов</AppButton>
      </div>
    </AppCard>

    <AppCard v-else>
      <div class="flex flex-col items-center py-8 text-center">
        <div class="grid h-16 w-16 place-items-center rounded-full bg-ok-bg text-ok"><Icon name="ph:check-bold" size="30" /></div>
        <h2 class="mt-4 text-[17px] font-semibold tracking-[-0.02em]">Импорт завершён</h2>
        <p class="mt-1 text-[13.5px] text-muted">Объекты добавлены в шахматку дома «{{ building.name }}»</p>
        <div class="mt-5 flex gap-2">
          <AppButton @click="reset">Импортировать ещё файл</AppButton>
          <AppButton variant="primary" @click="navigateTo(`/board?building=${building.id}`)">Открыть шахматку</AppButton>
        </div>
      </div>
    </AppCard>
  </div>
</template>

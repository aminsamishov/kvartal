<script setup lang="ts">
import type { ExplicationRoom, RoomKind } from '~/types/models'
import { uid } from '~/repositories/api'
import { ROOM_KINDS, ROOM_KIND_META, explicationTotals } from '~/utils/explication'

const props = withDefaults(defineProps<{
  rooms: ExplicationRoom[]
  /** площадь помещения/планировки — для сверки с суммой по экспликации */
  declaredArea?: number
  readonly?: boolean
  compact?: boolean
}>(), { readonly: false, compact: false })

const emit = defineEmits<{
  'update:rooms': [ExplicationRoom[]]
  template: []
  'apply-area': [number]
}>()

const totals = computed(() => explicationTotals(props.rooms))

// расхождение суммы строк с заявленной площадью — типовая ошибка при наборе
// экспликации руками, поэтому показываем её прямо в шапке, а не в валидации
const delta = computed(() => {
  // пустую ведомость не сверяем — там нечему расходиться
  if (!props.declaredArea || !props.rooms.length) return null
  const d = Math.round((totals.value.total - props.declaredArea) * 10) / 10
  return Math.abs(d) < 0.05 ? null : d
})

function patch(id: string, field: 'name' | 'kind' | 'area', raw: string) {
  const next = props.rooms.map((r) => {
    if (r.id !== id) return r
    if (field === 'name') return { ...r, name: raw }
    if (field === 'kind') return { ...r, kind: raw as RoomKind }
    const n = Number(raw.replace(',', '.'))
    return { ...r, area: Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : r.area }
  })
  emit('update:rooms', next)
}

function addRow() {
  emit('update:rooms', [...props.rooms, { id: uid('room'), name: '', kind: 'living', area: 0 }])
}

function removeRow(id: string) {
  emit('update:rooms', props.rooms.filter((r) => r.id !== id))
}

function move(id: string, dir: -1 | 1) {
  const list = [...props.rooms]
  const i = list.findIndex((r) => r.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= list.length) return
  const [item] = list.splice(i, 1)
  if (item) list.splice(j, 0, item)
  emit('update:rooms', list)
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div v-if="rooms.length" class="overflow-hidden rounded-xl2 border border-line">
      <table class="w-full border-collapse text-[13px]">
        <thead>
          <tr class="bg-soft">
            <th class="w-8 px-2 py-2 text-left text-[10.5px] font-semibold uppercase tracking-[0.03em] text-muted">№</th>
            <th class="px-2 py-2 text-left text-[10.5px] font-semibold uppercase tracking-[0.03em] text-muted">Помещение</th>
            <th class="w-[168px] px-2 py-2 text-left text-[10.5px] font-semibold uppercase tracking-[0.03em] text-muted">Тип</th>
            <th class="w-[88px] px-2 py-2 text-right text-[10.5px] font-semibold uppercase tracking-[0.03em] text-muted">м²</th>
            <th v-if="!readonly" class="w-[64px] px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in rooms" :key="r.id" class="border-t border-line align-middle hover:bg-soft/60">
            <td class="tabular px-2 py-1.5 text-[12px] font-semibold text-muted">{{ i + 1 }}</td>
            <td class="px-2 py-1.5">
              <input
                v-if="!readonly" :value="r.name" placeholder="Название комнаты"
                class="focus-ring w-full rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-[13px] font-medium text-ink hover:border-line focus:border-line"
                @change="patch(r.id, 'name', ($event.target as HTMLInputElement).value)"
              >
              <span v-else class="flex items-center gap-1.5 font-medium">
                <Icon :name="ROOM_KIND_META[r.kind].icon" size="14" class="text-muted" />{{ r.name || ROOM_KIND_META[r.kind].label }}
              </span>
            </td>
            <td class="px-2 py-1.5">
              <select
                v-if="!readonly" :value="r.kind"
                class="focus-ring w-full rounded-lg border border-line bg-panel px-1.5 py-1 text-[12.5px]"
                @change="patch(r.id, 'kind', ($event.target as HTMLSelectElement).value)"
              >
                <option v-for="k in ROOM_KINDS" :key="k" :value="k">{{ ROOM_KIND_META[k].label }}</option>
              </select>
              <span v-else class="text-[12.5px] text-muted">{{ ROOM_KIND_META[r.kind].label }}</span>
            </td>
            <td class="px-2 py-1.5 text-right">
              <input
                v-if="!readonly" :value="r.area" type="number" step="0.1" min="0"
                class="focus-ring tabular w-full rounded-lg border border-line bg-panel px-1.5 py-1 text-right text-[13px] font-semibold"
                @change="patch(r.id, 'area', ($event.target as HTMLInputElement).value)"
              >
              <span v-else class="tabular font-semibold">{{ r.area }}</span>
            </td>
            <td v-if="!readonly" class="px-2 py-1.5">
              <div class="flex items-center justify-end gap-0.5">
                <button class="grid h-6 w-5 place-items-center rounded text-muted hover:text-ink disabled:opacity-30" :disabled="i === 0" title="Выше" @click="move(r.id, -1)"><Icon name="ph:caret-up" size="12" /></button>
                <button class="grid h-6 w-5 place-items-center rounded text-muted hover:text-ink disabled:opacity-30" :disabled="i === rooms.length - 1" title="Ниже" @click="move(r.id, 1)"><Icon name="ph:caret-down" size="12" /></button>
                <button class="grid h-6 w-5 place-items-center rounded text-muted hover:text-bad" title="Удалить строку" @click="removeRow(r.id)"><Icon name="ph:x" size="12" /></button>
              </div>
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="border-t-2 border-line bg-soft">
            <td />
            <td class="px-2 py-2 text-[12.5px] font-semibold">Итого по документам</td>
            <td class="px-2 py-2 text-[11.5px] text-muted">балкон ×0,5 · терраса ×0,3</td>
            <td class="tabular px-2 py-2 text-right text-[14px] font-bold text-ink">{{ totals.total }}</td>
            <td v-if="!readonly" />
          </tr>
        </tfoot>
      </table>
    </div>

    <EmptyState
      v-else compact icon="ph:list-numbers" title="Экспликация не заполнена"
      :text="readonly ? undefined : 'Ведомость комнат с площадями — её печатают в договоре и показывают покупателю'"
    >
      <template v-if="!readonly" #action>
        <div class="flex gap-2">
          <AppButton size="sm" variant="primary" icon="ph:magic-wand" @click="emit('template')">Заполнить типовой</AppButton>
          <AppButton size="sm" icon="ph:plus" @click="addRow">Добавить строку</AppButton>
        </div>
      </template>
    </EmptyState>

    <!-- сводка -->
    <div v-if="rooms.length" class="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div v-for="s in [
        { l: 'Жилая', v: totals.living },
        { l: 'Без лоджий', v: totals.withoutLoggia },
        { l: 'Лоджии / террасы', v: totals.loggia },
        { l: 'Сумма строк', v: totals.raw },
      ]" :key="s.l" class="rounded-xl2 border border-line bg-panel px-2.5 py-2"
      >
        <p class="text-[10.5px] font-medium uppercase tracking-[0.03em] text-muted">{{ s.l }}</p>
        <p class="tabular mt-0.5 text-[14px] font-semibold text-ink">{{ s.v }} <span class="text-[11px] font-normal text-muted">м²</span></p>
      </div>
    </div>

    <div v-if="delta !== null" class="flex flex-wrap items-center gap-2 rounded-xl2 border border-warn bg-warn-bg px-3 py-2 text-[12.5px] text-warn">
      <Icon name="ph:warning" size="15" class="shrink-0" />
      <span>Сумма по экспликации {{ delta > 0 ? 'больше' : 'меньше' }} площади помещения на <b class="tabular">{{ Math.abs(delta) }} м²</b></span>
      <button v-if="!readonly" class="font-semibold underline hover:no-underline" @click="emit('apply-area', totals.total)">
        Записать {{ totals.total }} м² в помещение
      </button>
    </div>

    <div v-if="!readonly && rooms.length" class="flex flex-wrap gap-2">
      <AppButton size="sm" icon="ph:plus" @click="addRow">Строка</AppButton>
      <AppButton size="sm" icon="ph:magic-wand" @click="emit('template')">Пересобрать типовую</AppButton>
    </div>
  </div>
</template>

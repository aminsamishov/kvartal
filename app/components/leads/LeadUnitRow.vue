<script setup lang="ts">
import type { Unit } from '~/types/models'
import type { MatchFactor } from '~/composables/useLeadMatching'
import { scoreTone } from '~/composables/useLeadMatching'
import { UNIT_STATUS_META } from '~/utils/meta'
import { area as fmtArea, money } from '~/utils/format'
import { explicationTotals } from '~/utils/explication'

// Строка подобранной квартиры. «Открыть» раскрывает детали прямо здесь —
// вложенная панель поверх панели ломала бы навигацию.
const props = defineProps<{
  unit: Unit
  score?: number
  misses?: string[]
  /** разбивка совпадения по критериям — раскрывается по клику на процент */
  factors?: MatchFactor[]
  busy?: boolean
  /**
   * Привязана ли квартира к подборке клиента. undefined — строка вне контекста
   * заявки: тогда действие кнопки «открыть карточку», а не «в подборку».
   */
  linked?: boolean
}>()
const emit = defineEmits<{ reserve: [string]; open: [string] }>()

const showFactors = ref(false)

const unitsStore = useUnitsStore()
const expanded = ref(false)

const building = computed(() => unitsStore.building(props.unit.buildingId))
const preset = computed(() => (props.unit.layoutPresetId
  ? building.value?.unitTypePresets.find((p) => p.id === props.unit.layoutPresetId)
  : undefined))
const thumb = computed(() => props.unit.imageUrl || preset.value?.imageUrl || null)
const perM2 = computed(() => Math.round(props.unit.price / (props.unit.area || 1)))
const rooms = computed(() => (props.unit.explication?.length ? props.unit.explication : preset.value?.explication ?? []))
const totals = computed(() => explicationTotals(rooms.value))
const canReserve = computed(() => props.unit.status === 'free')
</script>

<template>
  <div class="overflow-hidden rounded-xl2 border border-line bg-panel transition-colors hover:border-plum/40">
    <div class="flex gap-3 p-2.5">
      <!-- миниатюра планировки -->
      <button
        type="button"
        class="focus-ring h-[62px] w-[62px] shrink-0 overflow-hidden rounded-lg border border-line bg-soft"
        :title="expanded ? 'Свернуть' : 'Показать планировку'"
        @click="expanded = !expanded"
      >
        <img v-if="thumb" :src="thumb" class="h-full w-full object-contain" :alt="`Планировка № ${unit.number}`">
        <span v-else class="grid h-full w-full place-items-center text-muted"><Icon name="ph:floor-plan" size="18" /></span>
      </button>

      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <p class="tabular truncate text-[13.5px] font-semibold text-ink">№ {{ unit.number }}</p>
          <StatusTag :tone="UNIT_STATUS_META[unit.status].tone" size="sm" dot>{{ UNIT_STATUS_META[unit.status].label }}</StatusTag>
          <button
            v-if="score !== undefined" type="button"
            class="focus-ring ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10.5px] font-bold"
            :class="{ ok: 'bg-ok-bg text-ok', warn: 'bg-warn-bg text-warn', neutral: 'bg-soft text-muted' }[scoreTone(score)]"
            :title="factors?.length ? 'Показать разбор совпадения' : undefined"
            @click="showFactors = !showFactors"
          >{{ score }}%</button>
        </div>
        <p class="mt-0.5 truncate text-[12px] text-muted">
          {{ building?.name }} · эт. {{ unit.floor }} · {{ unit.rooms || '—' }} комн. · {{ fmtArea(unit.area) }}
        </p>
        <p class="mt-1 flex items-baseline gap-2">
          <span class="tabular text-[14px] font-semibold text-ink">{{ money(unit.price) }}</span>
          <span class="tabular text-[11.5px] text-muted">{{ money(perM2) }}/м²</span>
        </p>
        <div v-if="misses?.length && !showFactors" class="mt-1 flex flex-wrap gap-1">
          <span v-for="m in misses" :key="m" class="rounded bg-warn-bg px-1.5 py-0.5 text-[10.5px] font-medium text-warn">{{ m }}</span>
        </div>

        <!-- разбор совпадения: видно, какой критерий и на сколько снял балл -->
        <div v-if="showFactors && factors?.length" class="mt-1.5 flex flex-col gap-0.5 rounded-lg bg-soft px-2 py-1.5">
          <p v-for="f in factors" :key="f.key" class="flex items-center gap-1.5 text-[11px]">
            <Icon :name="f.ok ? 'ph:check-circle-fill' : 'ph:minus-circle-fill'" size="11" :class="f.ok ? 'text-ok' : 'text-warn'" />
            <span class="min-w-0 flex-1 truncate text-muted">{{ f.detail }}</span>
            <span v-if="f.penalty" class="tabular shrink-0 font-semibold text-warn">−{{ f.penalty }}</span>
          </p>
        </div>
      </div>

      <div class="flex shrink-0 flex-col items-end gap-1.5">
        <AppButton size="sm" :icon="expanded ? 'ph:caret-up' : 'ph:eye'" @click="expanded = !expanded">
          {{ expanded ? 'Свернуть' : 'Открыть' }}
        </AppButton>
        <div class="flex gap-1.5">
          <button
            type="button"
            class="focus-ring grid h-8 w-8 place-items-center rounded-xl2 border transition-colors"
            :class="linked ? 'border-plum bg-plum-soft text-plum' : 'border-line text-muted hover:text-ink'"
            :title="linked === undefined
              ? 'Открыть карточку помещения'
              : linked ? 'Убрать из подборки клиента' : 'Добавить в подборку клиента'"
            @click="emit('open', unit.id)"
          >
            <Icon :name="linked === undefined ? 'ph:arrow-square-out' : linked ? 'ph:minus-bold' : 'ph:plus-bold'" size="14" />
          </button>
          <AppButton
            size="sm" variant="primary" icon="ph:bookmark-simple" :disabled="!canReserve || busy"
            :title="canReserve ? 'Забронировать' : 'Объект недоступен'" @click="emit('reserve', unit.id)"
          >Бронь</AppButton>
        </div>
      </div>
    </div>

    <!-- раскрытие: планировка и экспликация без ухода со страницы -->
    <div v-if="expanded" class="border-t border-line bg-soft/50 p-3">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
        <div class="aspect-square overflow-hidden rounded-xl2 border border-line bg-panel">
          <img v-if="thumb" :src="thumb" class="h-full w-full object-contain" :alt="`Планировка № ${unit.number}`">
          <span v-else class="grid h-full w-full place-items-center text-muted"><Icon name="ph:floor-plan" size="24" /></span>
        </div>
        <div class="min-w-0">
          <p v-if="preset" class="mb-1.5 text-[12px] text-muted">Планировка «{{ preset.name }}»</p>
          <div v-if="rooms.length" class="overflow-hidden rounded-lg border border-line bg-panel">
            <table class="w-full border-collapse text-[12px]">
              <tbody>
                <tr v-for="r in rooms" :key="r.id" class="border-b border-line last:border-0">
                  <td class="px-2 py-1 text-muted">{{ r.name }}</td>
                  <td class="tabular px-2 py-1 text-right font-semibold">{{ r.area }} м²</td>
                </tr>
                <tr class="bg-soft">
                  <td class="px-2 py-1 font-semibold">Итого</td>
                  <td class="tabular px-2 py-1 text-right font-bold">{{ totals.total }} м²</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="text-[12px] text-muted">Экспликация не заполнена</p>
        </div>
      </div>
    </div>
  </div>
</template>

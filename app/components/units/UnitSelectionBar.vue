<script setup lang="ts">
import type { Unit, UnitStatus } from '~/types/models'
import { UNIT_STATUS_META } from '~/utils/meta'
import { area as fmtArea, money } from '~/utils/format'
import { exportUnitsToXlsx, selectionSummary } from '~/utils/unitExport'
import { MAX_COMPARE } from '~/stores/board'

/**
 * Панель массовых действий. Появляется только когда что-то выделено — иначе
 * это просто полоса, отъедающая высоту у шахматки.
 */
const props = defineProps<{
  scopeKey: string
  units: Unit[]
  /** карточка заявки не должна давать менять цены и статусы фонда */
  canEdit?: boolean
  scores?: Map<string, { score: number }>
}>()
const emit = defineEmits<{ compare: [] }>()

const board = useBoardStore()
const unitsStore = useUnitsStore()
const misc = useMiscStore()
const auth = useAuthStore()
const ui = useUiStore()

const scope = computed(() => board.scope(props.scopeKey))
const selectedUnits = computed(() => scope.value.selected
  .map((id) => props.units.find((u) => u.id === id))
  .filter((u): u is Unit => !!u))
const summary = computed(() => selectionSummary(selectedUnits.value))
const author = computed(() => auth.user?.name ?? 'Система')

/** Под договором цена и статус не меняются — показываем это до нажатия. */
const locked = computed(() => selectedUnits.value.filter((u) => u.contractId && (u.status === 'sold' || u.status === 'installment')).length)

const statusOpen = ref(false)
const priceOpen = ref(false)
const statusRoot = ref<HTMLElement | null>(null)
const priceRoot = ref<HTMLElement | null>(null)
onClickOutside(statusRoot, () => (statusOpen.value = false))
onClickOutside(priceRoot, () => (priceOpen.value = false))

const STATUSES: UnitStatus[] = ['free', 'reserved', 'sold', 'closed']

function applyStatus(status: UnitStatus) {
  const changed = unitsStore.bulkSetStatus(scope.value.selected, status, author.value)
  statusOpen.value = false
  if (!changed.length) { ui.toast('Статус не изменился', 'info'); return }
  misc.log('Шахматка', `Статус «${UNIT_STATUS_META[status].label}» — помещений: ${changed.length}`, author.value)
  ui.toast(`Статус изменён у ${changed.length} помещ.`, 'ok')
}

const priceMode = ref<'percent' | 'amount' | 'absolute'>('percent')
const priceValue = ref<number>(0)

const pricePreview = computed(() => {
  if (!selectedUnits.value.length || !priceValue.value) return null
  const next = selectedUnits.value.map((u) => (priceMode.value === 'percent'
    ? Math.round(u.price * (1 + priceValue.value / 100))
    : priceMode.value === 'amount' ? Math.round(u.price + priceValue.value) : Math.round(priceValue.value)))
  return { from: summary.value.sum, to: next.reduce((s, v) => s + v, 0) }
})

function applyPrice() {
  if (!priceValue.value) { ui.toast('Укажите величину изменения', 'warn'); return }
  const changed = unitsStore.bulkSetPrice(scope.value.selected, { mode: priceMode.value, value: priceValue.value }, author.value)
  priceOpen.value = false
  priceValue.value = 0
  if (!changed.length) { ui.toast('Цены не изменились', 'info'); return }
  misc.log('Шахматка', `Массовое изменение цены — помещений: ${changed.length}`, author.value)
  ui.toast(`Цена изменена у ${changed.length} помещ.`, 'ok')
}

function exportSelection() {
  exportUnitsToXlsx(selectedUnits.value, {
    project: (id) => unitsStore.project(id),
    building: (id) => unitsStore.building(id),
    score: (id) => props.scores?.get(id)?.score,
  })
  ui.toast('Подборка выгружена в Excel', 'ok')
}
</script>

<template>
  <Transition enter-active-class="animate-pop-in">
    <div
      v-if="selectedUnits.length"
      class="sticky bottom-3 z-30 flex flex-wrap items-center gap-2 rounded-card border border-ink bg-panel px-3 py-2.5 shadow-pop"
    >
      <div class="flex items-center gap-2">
        <span class="tabular grid h-7 min-w-7 place-items-center rounded-lg bg-ink px-1.5 text-[13px] font-bold text-panel">{{ summary.count }}</span>
        <div class="text-[12px] leading-tight">
          <p class="tabular font-semibold text-ink">{{ money(summary.sum) }}</p>
          <p class="tabular text-muted">{{ fmtArea(summary.area) }} · {{ money(summary.perM2) }}/м²</p>
        </div>
      </div>

      <span class="h-6 w-px bg-line" />

      <AppButton size="sm" icon="ph:arrows-left-right" :disabled="summary.count < 2" @click="emit('compare')">
        Сравнить{{ summary.count > MAX_COMPARE ? ` · первые ${MAX_COMPARE}` : '' }}
      </AppButton>

      <template v-if="canEdit">
        <div ref="statusRoot" class="relative">
          <AppButton size="sm" icon="ph:flag" @click="statusOpen = !statusOpen">Статус</AppButton>
          <Transition enter-active-class="animate-pop-in">
            <div v-if="statusOpen" class="absolute bottom-10 left-0 z-40 w-[210px] rounded-card border border-line bg-panel p-2 shadow-panel">
              <button
                v-for="s in STATUSES" :key="s" type="button"
                class="focus-ring flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] hover:bg-soft"
                @click="applyStatus(s)"
              >
                <span class="h-2.5 w-2.5 rounded-full border" :class="[UNIT_STATUS_META[s].boardBg, UNIT_STATUS_META[s].boardBorder]" />
                {{ UNIT_STATUS_META[s].label }}
              </button>
              <p v-if="locked" class="mt-1 border-t border-line px-2 pt-1.5 text-[11px] text-muted">
                {{ locked }} под договором — не изменится
              </p>
            </div>
          </Transition>
        </div>

        <div ref="priceRoot" class="relative">
          <AppButton size="sm" icon="ph:tag" @click="priceOpen = !priceOpen">Цена</AppButton>
          <Transition enter-active-class="animate-pop-in">
            <div v-if="priceOpen" class="absolute bottom-10 left-0 z-40 w-[268px] rounded-card border border-line bg-panel p-3 shadow-panel">
              <SegmentedControl
                :model-value="priceMode"
                :options="[{ value: 'percent', label: '%' }, { value: 'amount', label: '± $' }, { value: 'absolute', label: '= $' }]"
                class="mb-2.5"
                @update:model-value="priceMode = $event as typeof priceMode"
              />
              <AppInput
                v-model.number="priceValue" type="number"
                :label="priceMode === 'percent' ? 'Изменить на, %' : priceMode === 'amount' ? 'Изменить на, $' : 'Новая цена, $'"
              />
              <p v-if="pricePreview" class="tabular mt-2 text-[11.5px] text-muted">
                Сумма: {{ money(pricePreview.from) }} → <b class="text-ink">{{ money(pricePreview.to) }}</b>
              </p>
              <p v-if="locked" class="mt-1 text-[11px] text-muted">{{ locked }} под договором — не изменится</p>
              <div class="mt-2.5 flex gap-2">
                <AppButton size="sm" block @click="priceOpen = false">Отмена</AppButton>
                <AppButton size="sm" block variant="primary" icon="ph:check-bold" @click="applyPrice">Применить</AppButton>
              </div>
            </div>
          </Transition>
        </div>
      </template>

      <AppButton size="sm" icon="ph:file-xls" @click="exportSelection">Excel</AppButton>

      <button class="ml-auto text-[12px] font-semibold text-muted hover:text-bad" @click="board.clearSelection(scopeKey)">
        Снять выделение
      </button>
    </div>
  </Transition>
</template>

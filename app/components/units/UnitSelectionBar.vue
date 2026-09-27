<script setup lang="ts">
import type { Unit, UnitStatus } from '~/types/models'
import { UNIT_STATUS_META } from '~/utils/meta'
import { area as fmtArea, money, moneyCompact } from '~/utils/format'
import { exportUnitsToXlsx, selectionSummary } from '~/utils/unitExport'
import { MAX_COMPARE } from '~/stores/board'

/**
 * Плавающая панель выделения. Пока ничего не выбрано — её нет: полоса,
 * занимающая высоту ради собственного присутствия, отнимает экран у шахматки.
 *
 * Плитки выбранных квартир держим прямо в панели: сравнение начинается с
 * вопроса «что я вообще набрал», и ответ не должен требовать открытия модалки.
 */
const props = defineProps<{
  scopeKey: string
  units: Unit[]
  /** карточка заявки не должна давать менять цены и статусы фонда */
  canEdit?: boolean
  scores?: Map<string, { score: number }>
}>()
const emit = defineEmits<{ compare: []; reserve: [string]; contract: [string]; open: [string] }>()

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

/** Последняя выбранная — на неё нацелены бронь и договор по горячей клавише. */
const target = computed(() => selectedUnits.value[selectedUnits.value.length - 1])
const canReserve = computed(() => target.value?.status === 'free')

/** Под договором цена и статус не меняются — показываем это до нажатия. */
const locked = computed(() => selectedUnits.value.filter((u) => u.contractId && (u.status === 'sold' || u.status === 'installment')).length)

const expanded = ref(true)
const statusOpen = ref(false)
const priceOpen = ref(false)
const statusRoot = ref<HTMLElement | null>(null)
const priceRoot = ref<HTMLElement | null>(null)
onClickOutside(statusRoot, () => (statusOpen.value = false))
onClickOutside(priceRoot, () => (priceOpen.value = false))

const STATUSES: UnitStatus[] = ['free', 'reserved', 'sold', 'closed']

function thumbOf(unit: Unit) {
  const preset = unit.layoutPresetId
    ? unitsStore.building(unit.buildingId)?.unitTypePresets.find((p) => p.id === unit.layoutPresetId)
    : undefined
  return unit.imageUrl || preset?.imageUrl || null
}

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
  <Transition
    enter-active-class="transition-all duration-200 ease-out" leave-active-class="transition-all duration-150 ease-in"
    enter-from-class="translate-y-4 opacity-0" leave-to-class="translate-y-4 opacity-0"
  >
    <div v-if="selectedUnits.length" class="sticky bottom-3 z-30 rounded-card border border-ink/80 bg-panel/95 shadow-pop backdrop-blur">
      <!-- плитки выбранного -->
      <Transition
        enter-active-class="transition-all duration-150" leave-active-class="transition-all duration-100"
        enter-from-class="opacity-0" leave-to-class="opacity-0"
      >
        <div v-if="expanded" class="scrollbar-none flex gap-2 overflow-x-auto border-b border-line px-3 pb-2.5 pt-3">
          <article
            v-for="(u, i) in selectedUnits" :key="u.id"
            class="group relative flex w-[132px] shrink-0 gap-2 rounded-xl2 border border-line bg-panel p-1.5 transition-colors hover:border-plum/50"
            :class="i < MAX_COMPARE ? '' : 'opacity-60'"
          >
            <button
              type="button" class="focus-ring h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-line bg-soft"
              title="Открыть карточку" @click="emit('open', u.id)"
            >
              <img v-if="thumbOf(u)" :src="thumbOf(u)!" class="h-full w-full object-contain" :alt="`№ ${u.number}`">
              <span v-else class="grid h-full w-full place-items-center text-muted"><Icon name="ph:floor-plan" size="15" /></span>
            </button>
            <div class="min-w-0 flex-1">
              <p class="tabular truncate text-[12px] font-semibold leading-tight text-ink">№ {{ u.number }}</p>
              <p class="tabular truncate text-[11px] leading-tight text-muted">{{ moneyCompact(u.price) }}</p>
              <p class="truncate text-[10px] leading-tight text-muted">{{ u.rooms || '—' }}к · {{ u.area }} м²</p>
            </div>
            <button
              class="absolute -right-1.5 -top-1.5 grid h-[18px] w-[18px] place-items-center rounded-full border border-line bg-panel text-muted opacity-0 transition-opacity hover:text-bad group-hover:opacity-100"
              title="Убрать из выделения" @click="board.deselect(scopeKey, u.id)"
            ><Icon name="ph:x" size="10" /></button>
          </article>
          <p v-if="selectedUnits.length > MAX_COMPARE" class="self-center px-1 text-[11px] text-muted">
            Сравнение покажет<br>первые {{ MAX_COMPARE }}
          </p>
        </div>
      </Transition>

      <!-- действия -->
      <div class="flex flex-wrap items-center gap-2 px-3 py-2.5">
        <button
          type="button" class="focus-ring flex items-center gap-2" :title="expanded ? 'Свернуть плитки' : 'Показать плитки'"
          @click="expanded = !expanded"
        >
          <span class="tabular grid h-7 min-w-7 place-items-center rounded-lg bg-ink px-1.5 text-[13px] font-bold text-panel">{{ summary.count }}</span>
          <span class="text-left text-[12px] leading-tight">
            <span class="tabular block font-semibold text-ink">{{ money(summary.sum) }}</span>
            <span class="tabular block text-muted">{{ fmtArea(summary.area) }} · {{ money(summary.perM2) }}/м²</span>
          </span>
          <Icon :name="expanded ? 'ph:caret-down' : 'ph:caret-up'" size="12" class="text-muted" />
        </button>

        <span class="h-6 w-px bg-line" />

        <AppButton size="sm" icon="ph:arrows-left-right" :disabled="summary.count < 2" @click="emit('compare')">
          Сравнить <kbd class="hot">C</kbd>
        </AppButton>
        <AppButton
          size="sm" icon="ph:bookmark-simple" :disabled="!canReserve"
          :title="canReserve ? `Забронировать № ${target?.number}` : 'Последняя выбранная квартира недоступна для брони'"
          @click="target && emit('reserve', target.id)"
        >
          Бронь <kbd class="hot">B</kbd>
        </AppButton>
        <AppButton size="sm" icon="ph:file-text" :disabled="!target" @click="target && emit('contract', target.id)">
          Договор <kbd class="hot">D</kbd>
        </AppButton>

        <template v-if="canEdit">
          <span class="h-6 w-px bg-line" />
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
    </div>
  </Transition>
</template>

<style scoped>
.hot {
  font-family: var(--f-ui);
  font-size: 9.5px;
  font-weight: 700;
  line-height: 1;
  padding: 2px 4px;
  margin-left: 2px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: var(--soft);
  color: var(--muted);
}
</style>

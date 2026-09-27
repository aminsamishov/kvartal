<script setup lang="ts">
import type { UnitKind } from '~/types/models'
import type { ClientProfile, ClientStatus } from '~/utils/clientProfile'
import { CLIENT_STATUS_META } from '~/utils/clientProfile'
import {
  activeClientFilterCount, emptyClientFilters, NEXT_DUE_OPTIONS, type ClientFilterState,
} from '~/utils/clientFilters'
import { UNIT_KIND_META } from '~/utils/meta'

/**
 * Фильтры реестра. Частое — чипами на виду, редкое — в раскрывающейся панели:
 * четырнадцать полей в одну строку превращают экран в форму, а не в рабочий
 * инструмент. Всё считается на клиенте и применяется мгновенно.
 */
const props = defineProps<{ profiles: ClientProfile[]; matched: number }>()
const filters = defineModel<ClientFilterState>({ required: true })

const unitsStore = useUnitsStore()
const settingsStore = useSettingsStore()

const open = ref(false)

const projects = computed(() => unitsStore.projects.filter((p) => !p.archived))
const buildings = computed(() => unitsStore.buildings.filter((b) => !b.archived
  && (!filters.value.projectIds.length || filters.value.projectIds.includes(b.projectId))))
const managers = computed(() => {
  const ids = new Set(props.profiles.map((p) => p.manager?.id).filter(Boolean) as string[])
  return settingsStore.users.filter((u) => ids.has(u.id))
})
const paymentMethods = computed(() => settingsStore.paymentMethods)
const banks = computed(() => [...new Set(props.profiles.flatMap((p) => p.contracts.map((c) => c.bank).filter(Boolean) as string[]))].sort())
const unitKinds = computed(() => {
  const present = new Set(props.profiles.flatMap((p) => p.units.map((u) => u.kind)))
  return (Object.keys(UNIT_KIND_META) as UnitKind[]).filter((k) => present.has(k))
})

const STATUSES: ClientStatus[] = ['active', 'installment', 'paid', 'prospect']

const overdueCount = computed(() => props.profiles.filter((p) => p.totals.overdueAmount).length)
const vipCount = computed(() => props.profiles.filter((p) => p.client.vip).length)
const weekCount = computed(() => props.profiles.filter((p) => {
  const next = p.totals.nextDue
  if (!next) return false
  return Math.ceil((new Date(next.dueDate).getTime() - Date.now()) / 86400000) <= 7
}).length)

function toggle<K extends keyof ClientFilterState>(key: K, value: string) {
  const list = filters.value[key] as unknown as string[]
  const next = list.includes(value) ? list.filter((x) => x !== value) : [...list, value]
  filters.value = { ...filters.value, [key]: next }
}

const extraCount = computed(() => activeClientFilterCount(filters.value))

function reset() {
  filters.value = { ...emptyClientFilters(), search: filters.value.search }
}
</script>

<template>
  <div class="flex flex-col gap-2.5">
    <!-- быстрые условия -->
    <div class="flex flex-wrap items-center gap-2">
      <AppInput
        :model-value="filters.search" placeholder="Имя, телефон, ИНН, договор, № квартиры"
        icon="ph:magnifying-glass" class="w-[300px]"
        @update:model-value="filters = { ...filters, search: $event }"
      />

      <Chip
        :pressed="filters.overdueOnly" icon="ph:warning-circle"
        @click="filters = { ...filters, overdueOnly: !filters.overdueOnly }"
      >
        Просрочка<span v-if="overdueCount" class="tabular opacity-70">· {{ overdueCount }}</span>
      </Chip>
      <Chip
        :pressed="filters.nextDue === 'week'" icon="ph:calendar-dot"
        @click="filters = { ...filters, nextDue: filters.nextDue === 'week' ? '' : 'week' }"
      >
        Платёж на неделе<span v-if="weekCount" class="tabular opacity-70">· {{ weekCount }}</span>
      </Chip>
      <Chip
        :pressed="filters.vipOnly" icon="ph:star"
        @click="filters = { ...filters, vipOnly: !filters.vipOnly }"
      >
        VIP<span v-if="vipCount" class="tabular opacity-70">· {{ vipCount }}</span>
      </Chip>
      <Chip
        :pressed="!filters.buyersOnly" icon="ph:users"
        title="Показать и тех, у кого ещё нет договора"
        @click="filters = { ...filters, buyersOnly: !filters.buyersOnly }"
      >
        С заявками
      </Chip>

      <AppButton class="ml-auto" icon="ph:sliders-horizontal" @click="open = !open">
        Фильтры
        <span v-if="extraCount" class="grid h-4 min-w-4 place-items-center rounded-full bg-fill-plum px-1 text-[10px] font-bold text-white">{{ extraCount }}</span>
        <Icon :name="open ? 'ph:caret-up' : 'ph:caret-down'" size="13" />
      </AppButton>
    </div>

    <!-- панель условий -->
    <Transition
      enter-active-class="transition-all duration-150" leave-active-class="transition-all duration-100"
      enter-from-class="opacity-0" leave-to-class="opacity-0"
    >
      <div v-if="open" class="grid grid-cols-1 gap-4 rounded-card border border-line bg-panel p-4 shadow-card lg:grid-cols-3">
        <div>
          <p class="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">ЖК</p>
          <div class="flex flex-wrap gap-1.5">
            <Chip v-for="p in projects" :key="p.id" :pressed="filters.projectIds.includes(p.id)" @click="toggle('projectIds', p.id)">
              {{ p.name }}
            </Chip>
          </div>

          <p class="mb-1.5 mt-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">Дом</p>
          <div class="flex flex-wrap gap-1.5">
            <Chip v-for="b in buildings" :key="b.id" :pressed="filters.buildingIds.includes(b.id)" @click="toggle('buildingIds', b.id)">
              {{ b.name }}
            </Chip>
          </div>

          <p class="mb-1.5 mt-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">Тип помещения</p>
          <div class="flex flex-wrap gap-1.5">
            <Chip v-for="k in unitKinds" :key="k" :pressed="filters.unitKinds.includes(k)" :icon="UNIT_KIND_META[k].icon" @click="toggle('unitKinds', k)">
              {{ UNIT_KIND_META[k].label }}
            </Chip>
          </div>
        </div>

        <div>
          <p class="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">Менеджер</p>
          <div class="flex flex-wrap gap-1.5">
            <Chip v-for="u in managers" :key="u.id" :pressed="filters.managerIds.includes(u.id)" @click="toggle('managerIds', u.id)">
              {{ u.name }}
            </Chip>
          </div>

          <p class="mb-1.5 mt-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">Статус договора</p>
          <div class="flex flex-wrap gap-1.5">
            <Chip v-for="s in STATUSES" :key="s" :pressed="filters.statuses.includes(s)" @click="toggle('statuses', s)">
              {{ CLIENT_STATUS_META[s].label }}
            </Chip>
          </div>

          <p class="mb-1.5 mt-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">Способ оплаты</p>
          <div class="flex flex-wrap gap-1.5">
            <Chip v-for="m in paymentMethods" :key="m.id" :pressed="filters.paymentMethodIds.includes(m.id)" @click="toggle('paymentMethodIds', m.id)">
              {{ m.name }}
            </Chip>
          </div>

          <template v-if="banks.length">
            <p class="mb-1.5 mt-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">Банк</p>
            <div class="flex flex-wrap gap-1.5">
              <Chip v-for="b in banks" :key="b" :pressed="filters.banks.includes(b)" @click="toggle('banks', b)">{{ b }}</Chip>
            </div>
          </template>
        </div>

        <div class="flex flex-col gap-3">
          <AppSelect
            :model-value="filters.nextDue" label="Следующий платёж"
            :options="NEXT_DUE_OPTIONS"
            @update:model-value="filters = { ...filters, nextDue: $event as ClientFilterState['nextDue'] }"
          />
          <div class="grid grid-cols-2 gap-2">
            <AppInput
              :model-value="filters.purchaseFrom" type="date" label="Покупка с"
              @update:model-value="filters = { ...filters, purchaseFrom: $event }"
            />
            <AppInput
              :model-value="filters.purchaseTo" type="date" label="по"
              @update:model-value="filters = { ...filters, purchaseTo: $event }"
            />
          </div>
          <div class="grid grid-cols-2 gap-2">
            <AppInput
              :model-value="filters.amountMin" type="number" label="Сумма от, $"
              @update:model-value="filters = { ...filters, amountMin: $event }"
            />
            <AppInput
              :model-value="filters.amountMax" type="number" label="до, $"
              @update:model-value="filters = { ...filters, amountMax: $event }"
            />
          </div>
          <AppSelect
            :model-value="filters.currency" label="Валюта договора"
            :options="[{ value: '', label: 'Любая' }, { value: 'USD', label: 'USD' }, { value: 'KGS', label: 'KGS' }]"
            @update:model-value="filters = { ...filters, currency: $event as ClientFilterState['currency'] }"
          />

          <button
            v-if="extraCount" type="button"
            class="focus-ring mt-auto flex items-center justify-center gap-1.5 rounded-xl2 border border-line py-2 text-[12.5px] font-semibold text-muted hover:bg-soft hover:text-ink"
            @click="reset"
          >
            <Icon name="ph:arrow-counter-clockwise" size="13" /> Сбросить условия
          </button>
        </div>
      </div>
    </Transition>

    <p class="text-[11.5px] text-muted">
      Найдено <b class="tabular text-ink">{{ matched }}</b> из {{ profiles.length }}
      <template v-if="filters.buyersOnly"> · показаны только покупатели с договором</template>
    </p>
  </div>
</template>

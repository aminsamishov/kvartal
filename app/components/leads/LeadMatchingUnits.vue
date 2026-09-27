<script setup lang="ts">
import type { Lead } from '~/types/models'
import { matchUnits, interestFromLead } from '~/composables/useLeadMatching'
import { money } from '~/utils/format'

/**
 * Компактный подбор на «Обзоре»: что клиент уже смотрит и три лучших
 * совпадения. Полный подбор с шахматкой, фасадом и планом этажа живёт на
 * вкладке «Подбор» — здесь он должен помещаться в один экран.
 */
const props = defineProps<{ lead: Lead; limit?: number }>()
const emit = defineEmits<{ picker: []; open: [string] }>()

const unitsStore = useUnitsStore()
const salesStore = useSalesStore()

const reserveFor = ref<string | null>(null)

const interest = computed(() => interestFromLead(props.lead))
const matches = computed(() => matchUnits(unitsStore.units, interest.value, { includeReserved: false }))
const shown = computed(() => matches.value.slice(0, props.limit ?? 3))

// уже привязанные к заявке объекты показываем отдельно наверху
const linked = computed(() => props.lead.interestedUnitIds
  .map((id) => unitsStore.unit(id))
  .filter((u): u is NonNullable<typeof u> => !!u))

const priceRange = computed(() => {
  if (!matches.value.length) return null
  const prices = matches.value.map((m) => m.unit.price)
  return { min: Math.min(...prices), max: Math.max(...prices) }
})

function unlink(unitId: string) {
  salesStore.toggleLeadUnit(props.lead.id, unitId)
}
</script>

<template>
  <AppCard id="sec-match" :padded="false">
    <div class="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
      <h3 class="text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">
        Подбор
        <span class="tabular ml-1 rounded-full bg-soft px-1.5 py-0.5 text-[11px] text-ink">{{ matches.length }}</span>
      </h3>
      <AppButton size="sm" icon="ph:grid-nine" @click="emit('picker')">Открыть подбор</AppButton>
    </div>

    <div class="p-4">
      <!-- уже в работе -->
      <div v-if="linked.length" class="mb-3">
        <p class="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">Клиент смотрит</p>
        <div class="flex flex-wrap gap-1.5">
          <span
            v-for="u in linked" :key="u.id"
            class="flex items-center gap-1.5 rounded-full border border-plum bg-plum-soft px-2.5 py-1 text-[11.5px] font-medium text-plum"
          >
            № {{ u.number }} · {{ money(u.price) }}
            <button class="hover:text-bad" title="Убрать из подборки" @click="unlink(u.id)"><Icon name="ph:x" size="11" /></button>
          </span>
        </div>
      </div>

      <p v-if="priceRange" class="mb-2.5 text-[12px] text-muted">
        Диапазон подбора: <b class="text-ink">{{ money(priceRange.min) }} – {{ money(priceRange.max) }}</b>
      </p>

      <div v-if="shown.length" class="flex flex-col gap-2">
        <template v-for="m in shown" :key="m.unit.id">
          <LeadUnitRow
            :unit="m.unit" :score="m.score" :misses="m.misses" :factors="m.factors"
            :linked="lead.interestedUnitIds.includes(m.unit.id)"
            @reserve="reserveFor = $event" @open="emit('open', $event)"
          />
          <ReserveComposer
            v-if="reserveFor === m.unit.id"
            :lead-id="lead.id" :unit-id="m.unit.id"
            @done="reserveFor = null" @cancel="reserveFor = null"
          />
        </template>

        <button
          v-if="matches.length > shown.length" type="button"
          class="focus-ring rounded-xl2 border border-dashed border-line py-2 text-[12px] font-medium text-muted hover:border-plum hover:text-plum"
          @click="emit('picker')"
        >
          Ещё {{ matches.length - shown.length }} подходящих — открыть подбор
        </button>
      </div>

      <EmptyState
        v-else compact icon="ph:magnifying-glass" title="Под запрос ничего не нашлось"
        text="Расширьте бюджет или комнатность в блоке «Интерес клиента»"
      />
    </div>
  </AppCard>
</template>

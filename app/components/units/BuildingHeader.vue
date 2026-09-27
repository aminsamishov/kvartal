<script setup lang="ts">
import type { Building, Project } from '~/types/models'
import { fmtDate, money, moneyCompact } from '~/utils/format'

/**
 * Шапка дома — та же витрина, что и у проекта: слева лицо дома, справа
 * действия, снизу одна строка показателей. Раньше здесь была тонкая полоса
 * с адресом, и открыв дом, руководитель не видел ни остатка, ни цены.
 */
const props = defineProps<{ building: Building; project?: Project; fillPercent: number }>()
const emit = defineEmits<{ edit: []; archive: [] }>()

const { can } = useAccess()
/** «Фасад» и «Шахматка» — инструменты показа, они остаются у всех. */
const canEdit = computed(() => can('objects.edit'))

const unitsStore = useUnitsStore()

const stats = computed(() => unitsStore.buildingStats(props.building.id))

const stageLabel: Record<string, string> = {
  planning: 'Проектирование', foundation: 'Котлован', frame: 'Каркас', facade: 'Фасад', finishing: 'Отделка', commissioned: 'Сдан',
}

const cover = computed(() => {
  const facades = props.building.facades.filter((f) => f.imageUrl)
  return (facades.find((f) => f.published) ?? facades[0])?.imageUrl ?? props.building.pdfImageUrl ?? null
})

const hasFacade = computed(() => props.building.facades.some((f) => f.imageUrl))

const kpis = computed(() => {
  const s = stats.value
  return [
    { label: 'Свободно', value: String(s.free), hint: `${s.freePct}% фонда`, tone: 'ok' },
    { label: 'Реализовано', value: `${s.soldPct}%`, hint: `${s.sold} из ${s.total}` },
    { label: 'В брони', value: String(s.reserved), hint: s.reserved ? 'ждут решения' : 'нет', tone: s.reserved ? 'warn' : undefined },
    { label: 'Цена от', value: s.minPrice ? moneyCompact(s.minPrice) : '—', hint: 'свободные квартиры' },
    { label: 'Цена м²', value: s.avgPricePerM2 ? money(s.avgPricePerM2) : '—', hint: 'в среднем' },
    { label: 'Данные для показа', value: `${props.fillPercent}%`, hint: props.fillPercent >= 80 ? 'можно показывать' : 'нужно дозаполнить' },
  ] as { label: string; value: string; hint?: string; tone?: 'ok' | 'warn' }[]
})
</script>

<template>
  <section class="overflow-hidden rounded-card border border-line bg-panel shadow-card">
    <div class="flex flex-col gap-4 p-5 lg:flex-row lg:items-start">
      <div class="h-[104px] w-full shrink-0 overflow-hidden rounded-xl2 border border-line bg-soft lg:w-[176px]">
        <img v-if="cover" :src="cover" class="h-full w-full object-cover" :alt="building.name">
        <div
          v-else class="grid h-full w-full place-items-center text-white"
          :style="{ background: `linear-gradient(135deg, ${project?.accent ?? '#6E4453'}, ${project?.accent ?? '#6E4453'}99)` }"
        >
          <Icon name="ph:building-apartment" size="28" />
        </div>
      </div>

      <div class="min-w-0 flex-1">
        <NuxtLink
          v-if="project" :to="`/objects/${project.id}`"
          class="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted hover:text-plum"
        >{{ project.name }}</NuxtLink>
        <h1 class="mt-1 flex flex-wrap items-center gap-2 text-[24px] font-semibold leading-tight tracking-[-0.025em] text-ink">
          {{ building.name }}
          <StatusTag v-if="building.badge" tone="plum" size="sm">{{ building.badge }}</StatusTag>
          <StatusTag v-if="building.archived" tone="neutral" size="sm">В архиве</StatusTag>
        </h1>
        <p class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px] text-muted">
          <span class="flex items-center gap-1"><Icon name="ph:map-pin" size="13" /> {{ building.address || 'адрес не указан' }}</span>
          <span class="flex items-center gap-1"><Icon name="ph:hard-hat" size="13" /> {{ stageLabel[building.constructionStage] ?? '—' }}</span>
          <span class="flex items-center gap-1"><Icon name="ph:rows" size="13" /> {{ building.sections }} секц. · {{ building.floors }} эт.</span>
          <span class="flex items-center gap-1"><Icon name="ph:calendar-check" size="13" /> сдача {{ building.deliveryDate ? fmtDate(building.deliveryDate) : 'не указана' }}</span>
        </p>
      </div>

      <div class="flex shrink-0 flex-wrap gap-2">
        <AppButton
          icon="ph:building-apartment" :disabled="!hasFacade"
          :title="hasFacade ? 'Открыть фасад дома' : 'Загрузите ракурс фасада'"
          @click="navigateTo(`/board?building=${building.id}&view=facade`)"
        >Фасад</AppButton>
        <AppButton variant="primary" icon="ph:grid-nine" @click="navigateTo(`/board?building=${building.id}`)">Шахматка</AppButton>
        <template v-if="canEdit">
          <AppButton icon="ph:pencil-simple" variant="ghost" title="Редактировать дом" @click="emit('edit')" />
          <AppButton
            :icon="building.archived ? 'ph:archive-tray' : 'ph:archive'" variant="ghost"
            :title="building.archived ? 'Вернуть из архива' : 'В архив'" @click="emit('archive')"
          />
        </template>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
      <div v-for="k in kpis" :key="k.label" class="bg-panel px-4 py-2.5">
        <p class="text-[10.5px] uppercase tracking-[0.04em] text-muted">{{ k.label }}</p>
        <p
          class="tabular mt-0.5 truncate text-[17px] font-semibold tracking-[-0.02em]"
          :class="k.tone === 'ok' ? 'text-ok' : k.tone === 'warn' ? 'text-warn' : 'text-ink'"
        >{{ k.value }}</p>
        <p v-if="k.hint" class="truncate text-[11px] text-muted">{{ k.hint }}</p>
      </div>
    </div>
  </section>
</template>

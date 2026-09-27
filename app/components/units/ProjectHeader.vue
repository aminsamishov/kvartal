<script setup lang="ts">
import type { Project } from '~/types/models'
import { money, moneyCompact } from '~/utils/format'
import { avgPricePerM2 } from '~/utils/analytics'

/**
 * Шапка проекта как витрина, а не как набор плиток.
 *
 * Пять одинаковых KPI-карточек занимали верхний экран целиком и не отвечали
 * на первый вопрос — «что это за объект и куда идти». Теперь слева личность
 * проекта, справа три действия, а показатели собраны в одну строку: она
 * читается за секунду и не отнимает место у домов.
 */
const props = defineProps<{
  project: Project
  /** динамика продаж за 12 месяцев — линией под выручкой, без отдельной плитки */
  spark?: number[]
}>()
const emit = defineEmits<{ edit: []; 'add-building': [] }>()

const unitsStore = useUnitsStore()

const stats = computed(() => unitsStore.projectStats(props.project.id))
const units = computed(() => unitsStore.unitsByProject(props.project.id))
const buildings = computed(() => unitsStore.buildingsByProject(props.project.id).filter((b) => !b.archived))

/** Обложка: генплан, иначе первый фасад дома — у проекта должно быть лицо. */
const cover = computed(() => props.project.masterPlans[0]?.url
  ?? buildings.value.flatMap((b) => b.facades).find((f) => f.imageUrl)?.imageUrl
  ?? props.project.media.find((m) => m.kind === 'photo')?.url
  ?? null)

const PROPERTY_KIND: Record<string, string> = {
  residential: 'Жилой комплекс', commercial: 'Коммерческая недвижимость', mixed: 'Смешанный',
}

const kpis = computed(() => {
  const s = stats.value
  const total = s.total || 1
  return [
    { label: 'Выручка в работе', value: moneyCompact(s.revenue, props.project.currency), tone: 'ink', spark: true },
    { label: 'Реализовано', value: `${s.soldPct}%`, hint: `${s.sold + s.installment} из ${s.total}` },
    { label: 'Свободно', value: String(s.free), hint: `${Math.round((s.free / total) * 100)}% фонда`, tone: 'ok' },
    { label: 'В брони', value: String(s.reserved), hint: 'ждут решения', tone: 'warn' },
    { label: 'Домов', value: String(buildings.value.length), hint: `${s.total} помещений` },
    { label: 'Цена м²', value: money(avgPricePerM2(units.value), props.project.currency), hint: 'в среднем' },
  ] as { label: string; value: string; hint?: string; tone?: 'ok' | 'warn' | 'ink'; spark?: boolean }[]
})
</script>

<template>
  <section class="overflow-hidden rounded-card border border-line bg-panel shadow-card">
    <div class="flex flex-col gap-4 p-5 lg:flex-row lg:items-start">
      <!-- обложка -->
      <div class="h-[104px] w-full shrink-0 overflow-hidden rounded-xl2 border border-line bg-soft lg:h-[104px] lg:w-[176px]">
        <img v-if="cover" :src="cover" class="h-full w-full object-cover" :alt="project.name">
        <div
          v-else class="grid h-full w-full place-items-center text-white"
          :style="{ background: `linear-gradient(135deg, ${project.accent}, ${project.accent}aa)` }"
        >
          <Icon name="ph:buildings" size="30" />
        </div>
      </div>

      <!-- личность проекта -->
      <div class="min-w-0 flex-1">
        <p class="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
          {{ PROPERTY_KIND[project.propertyKind] ?? 'Проект' }}
        </p>
        <h1 class="mt-1 truncate text-[24px] font-semibold leading-tight tracking-[-0.025em] text-ink">{{ project.name }}</h1>
        <p class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px] text-muted">
          <span class="flex items-center gap-1"><Icon name="ph:map-pin" size="13" /> {{ project.address || 'адрес не указан' }}</span>
          <span class="flex items-center gap-1"><Icon name="ph:hard-hat" size="13" /> {{ project.stage || 'стадия не указана' }}</span>
          <span class="flex items-center gap-1"><Icon name="ph:buildings" size="13" /> {{ project.developer }}</span>
        </p>
        <div class="mt-2 flex flex-wrap gap-1.5">
          <StatusTag v-if="project.archived" tone="neutral" size="sm">В архиве</StatusTag>
          <StatusTag tone="neutral" size="sm">{{ project.currency }}</StatusTag>
          <StatusTag v-for="bank in project.banks" :key="bank" tone="neutral" size="sm" icon="ph:bank">{{ bank }}</StatusTag>
        </div>
      </div>

      <!-- три действия: показать, показать иначе, добавить -->
      <div class="flex shrink-0 flex-wrap gap-2">
        <AppButton icon="ph:map-trifold" @click="navigateTo(`/board?project=${project.id}&view=master`)">Генплан</AppButton>
        <AppButton variant="primary" icon="ph:grid-nine" @click="navigateTo(`/board?project=${project.id}`)">Шахматка</AppButton>
        <AppButton icon="ph:plus-bold" @click="emit('add-building')">Новый дом</AppButton>
        <AppButton icon="ph:tag" variant="ghost" title="Прайс-лист проекта" @click="navigateTo('/pricing')" />
        <AppButton icon="ph:pencil-simple" variant="ghost" title="Редактировать проект" @click="emit('edit')" />
      </div>
    </div>

    <!-- показатели одной строкой -->
    <div class="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
      <div v-for="k in kpis" :key="k.label" class="relative flex flex-col justify-between overflow-hidden bg-panel px-4 py-2.5">
        <p class="text-[10.5px] uppercase tracking-[0.04em] text-muted">{{ k.label }}</p>
        <p
          class="tabular mt-0.5 truncate text-[17px] font-semibold tracking-[-0.02em]"
          :class="k.tone === 'ok' ? 'text-ok' : k.tone === 'warn' ? 'text-warn' : 'text-ink'"
        >{{ k.value }}</p>
        <p v-if="k.hint" class="truncate text-[11px] text-muted">{{ k.hint }}</p>
        <!-- линия динамики только под выручкой: она отвечает на «растём ли» -->
        <div v-if="k.spark && spark?.length" class="pointer-events-none -mx-1 -mb-1 mt-1 opacity-70">
          <Sparkline :values="spark" :height="20" />
        </div>
      </div>
    </div>
  </section>
</template>

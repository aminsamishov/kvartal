<script setup lang="ts">
import { uid } from '~/repositories/api'
import { fmtDate, fmtDateTime, money } from '~/utils/format'

definePageMeta({ breadcrumb: [{ label: 'Ценообразование' }, { label: 'Прайс-листы' }] })

const unitsStore = useUnitsStore()
const pricingStore = usePricingStore()
const ui = useUiStore()
const auth = useAuthStore()

const tab = ref<'draft' | 'published'>('draft')
const drafts = computed(() => pricingStore.draftsByProject(ui.currentProjectId).filter((d) => d.status === tab.value))

const showCreate = ref(false)
const title = ref('')
function createDraft() {
  const draft = pricingStore.createDraft(ui.currentProjectId, title.value || `Проект изменений №${Math.floor(10000 + Math.random() * 9000)}`, auth.user?.id ?? '')
  showCreate.value = false
  title.value = ''
  navigateTo(`/pricing/${draft.id}`)
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-[22px] font-semibold tracking-[-0.025em]">Прайс-листы</h1>
        <p class="mt-1 text-[13px] text-muted">Изменения цен — сначала черновик, публикация отдельным действием: сайт и КП не «уезжают» по ошибке</p>
      </div>
      <AppButton variant="primary" icon="ph:plus-bold" @click="showCreate = true">Проект изменения цен</AppButton>
    </div>

    <Tabs v-model="tab" :tabs="[{ value: 'draft', label: 'В работе', icon: 'ph:pencil-simple', count: pricingStore.draftsByProject(ui.currentProjectId).filter(d => d.status === 'draft').length }, { value: 'published', label: 'Опубликовано', icon: 'ph:check-circle', count: pricingStore.draftsByProject(ui.currentProjectId).filter(d => d.status === 'published').length }]" />

    <EmptyState v-if="!drafts.length" icon="ph:tag" :title="tab === 'draft' ? 'Нет активных черновиков' : 'Пока ничего не публиковали'" text="Создайте проект изменения цен, чтобы поднять или снизить стоимость пачкой объектов">
      <template #action><AppButton variant="primary" size="sm" @click="showCreate = true">Создать проект изменений</AppButton></template>
    </EmptyState>

    <div v-else class="grid grid-cols-1 gap-3.5 md:grid-cols-2">
      <NuxtLink v-for="d in drafts" :key="d.id" :to="`/pricing/${d.id}`" class="rounded-card border border-line bg-panel p-[18px] shadow-card transition-all hover:-translate-y-px hover:shadow-rise">
        <div class="flex items-start justify-between gap-2">
          <h3 class="text-[14.5px] font-semibold tracking-[-0.015em]">{{ d.title }}</h3>
          <StatusTag :tone="d.status === 'draft' ? 'warn' : 'ok'" size="sm">{{ d.status === 'draft' ? 'Черновик' : 'Опубликовано' }}</StatusTag>
        </div>
        <p class="mt-1 text-[12px] text-muted">{{ d.items.length }} объектов · создан {{ fmtDate(d.createdAt) }}</p>
        <p v-if="d.publishedAt" class="mt-0.5 text-[12px] text-muted">Опубликован {{ fmtDateTime(d.publishedAt) }}</p>
        <div class="mt-3 flex flex-wrap gap-1.5">
          <span v-for="item in d.items.slice(0, 4)" :key="item.unitId" class="rounded-full bg-soft px-2 py-1 text-[11px] tabular">
            {{ unitsStore.unit(item.unitId)?.number }}: {{ money(item.oldPrice) }} → <b :class="item.newPrice > item.oldPrice ? 'text-ok' : 'text-bad'">{{ money(item.newPrice) }}</b>
          </span>
          <span v-if="d.items.length > 4" class="px-2 py-1 text-[11px] text-muted">+{{ d.items.length - 4 }}</span>
        </div>
      </NuxtLink>
    </div>

    <AppModal v-model="showCreate" title="Новый проект изменения цен">
      <div class="flex flex-col gap-3.5">
        <AppInput v-model="title" label="Название" placeholder="Например, Индексация цен — октябрь" />
        <AppButton variant="primary" block @click="createDraft">Создать и открыть</AppButton>
      </div>
    </AppModal>
  </div>
</template>

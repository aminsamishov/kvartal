<script setup lang="ts">
import { fmtDateTime } from '~/utils/format'

definePageMeta({ breadcrumb: [{ label: 'Документы' }, { label: 'Сформированные документы' }] })

const misc = useMiscStore()
const search = ref('')
const processFilter = ref('')

const processes = computed(() => [...new Set(misc.generatedDocs.map((d) => d.process))])
const rows = computed(() => misc.generatedDocs
  .filter((d) => !processFilter.value || d.process === processFilter.value)
  .filter((d) => !search.value || d.templateName.toLowerCase().includes(search.value.toLowerCase()) || d.clientName?.toLowerCase().includes(search.value.toLowerCase()))
  .sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
</script>

<template>
  <div class="flex flex-col gap-5">
    <div>
      <h1 class="text-[22px] font-semibold tracking-[-0.025em]">Сформированные документы</h1>
      <p class="mt-1 text-[13px] text-muted">Все документы, созданные из шаблонов по договорам и заявкам</p>
    </div>

    <div class="flex flex-wrap gap-2">
      <AppInput v-model="search" placeholder="Название или клиент" icon="ph:magnifying-glass" class="w-[220px]" />
      <AppSelect v-model="processFilter" class="w-[180px]" :options="[{ value: '', label: 'Все процессы' }, ...processes.map((p) => ({ value: p, label: p }))]" />
      <NuxtLink to="/settings/templates" class="ml-auto"><AppButton icon="ph:gear-six">Шаблоны документов</AppButton></NuxtLink>
    </div>

    <div class="overflow-x-auto rounded-card border border-line">
      <table class="data-table">
        <thead><tr><th>Документ</th><th>Процесс</th><th>Договор</th><th>Клиент</th><th>Создан</th><th>Кем</th></tr></thead>
        <tbody>
          <tr v-for="d in rows" :key="d.id">
            <td class="flex items-center gap-2 font-medium"><Icon name="ph:file-text" size="16" class="text-muted" /> {{ d.templateName }}</td>
            <td><StatusTag tone="neutral" size="sm">{{ d.process }}</StatusTag></td>
            <td>
              <NuxtLink v-if="d.contractNumber" :to="`/contracts`" class="text-plum hover:underline">{{ d.contractNumber }}</NuxtLink>
              <span v-else class="text-muted">—</span>
            </td>
            <td>{{ d.clientName ?? '—' }}</td>
            <td class="text-muted">{{ fmtDateTime(d.createdAt) }}</td>
            <td class="text-muted">{{ d.createdBy }}</td>
          </tr>
        </tbody>
      </table>
      <EmptyState v-if="!rows.length" compact icon="ph:files" title="Документов пока нет" text="Сформируйте первый документ из карточки договора" />
    </div>
  </div>
</template>

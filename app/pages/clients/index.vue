<script setup lang="ts">
import { fmtDate, fmtPhone } from '~/utils/format'

definePageMeta({ breadcrumb: [{ label: 'Продажи' }, { label: 'Контакты' }] })

const salesStore = useSalesStore()
const dealsStore = useDealsStore()
const ui = useUiStore()

const search = ref('')
const originFilter = ref('')

const originLabel = { own: 'Свой', partner: 'От партнёра', reassignment: 'Переоформление' } as const

const filtered = computed(() => salesStore.clients.filter((c) => {
  if (originFilter.value && c.origin !== originFilter.value) return false
  if (search.value) {
    const q = search.value.toLowerCase()
    return c.name.toLowerCase().includes(q) || c.phone.includes(q)
  }
  return true
}))

const activeId = ref<string | null>(null)
const active = computed(() => salesStore.clients.find((c) => c.id === activeId.value))
const activeContracts = computed(() => (active.value ? dealsStore.contracts.filter((c) => c.clientId === active.value!.id) : []))
const activeLeads = computed(() => (active.value ? salesStore.leads.filter((l) => l.clientId === active.value!.id) : []))

const showCreate = ref(false)
const form = reactive({ name: '', phone: '', kind: 'person' as 'person' | 'company' })
async function createClient() {
  if (!form.name.trim() || !form.phone.trim()) return
  await salesStore.addClient({ kind: form.kind, name: form.name, phone: form.phone.replace(/\D/g, ''), origin: 'own' })
  ui.toast('Клиент добавлен', 'ok')
  showCreate.value = false
  form.name = ''; form.phone = ''
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-[22px] font-semibold tracking-[-0.025em]">Контакты</h1>
        <p class="mt-1 text-[13px] text-muted">Справочник покупателей — на случай, если CRM не используется</p>
      </div>
      <AppButton variant="primary" icon="ph:plus-bold" @click="showCreate = true">Новый клиент</AppButton>
    </div>

    <div class="flex flex-wrap gap-2">
      <AppInput v-model="search" placeholder="Имя или телефон" icon="ph:magnifying-glass" class="w-[220px]" />
      <AppSelect v-model="originFilter" :options="[{ value: '', label: 'Все источники' }, { value: 'own', label: 'Свой' }, { value: 'partner', label: 'От партнёра' }, { value: 'reassignment', label: 'Переоформление' }]" class="w-[180px]" />
    </div>

    <div class="overflow-x-auto rounded-card border border-line">
      <table class="data-table">
        <thead><tr><th>Клиент</th><th>Телефон</th><th>Тип</th><th>Источник</th><th>Добавлен</th></tr></thead>
        <tbody>
          <tr v-for="c in filtered" :key="c.id" class="cursor-pointer" @click="activeId = c.id">
            <td class="flex items-center gap-2 font-medium"><AppAvatar :name="c.name" size="sm" /> {{ c.name }}</td>
            <td class="tabular">{{ fmtPhone(c.phone) }}</td>
            <td>{{ c.kind === 'person' ? 'Физлицо' : 'Юрлицо' }}</td>
            <td><StatusTag size="sm" :tone="c.origin === 'own' ? 'ok' : c.origin === 'partner' ? 'info' : 'warn'">{{ originLabel[c.origin] }}</StatusTag></td>
            <td class="text-muted">{{ fmtDate(c.createdAt) }}</td>
          </tr>
        </tbody>
      </table>
      <EmptyState v-if="!filtered.length" compact icon="ph:address-book" title="Ничего не найдено" />
    </div>

    <AppDrawer :model-value="!!activeId" :title="active?.name" :subtitle="active ? fmtPhone(active.phone) : ''" @update:model-value="activeId = null">
      <template v-if="active">
        <div class="flex flex-wrap gap-1.5">
          <StatusTag tone="neutral" size="sm">{{ active.kind === 'person' ? 'Физлицо' : 'Юрлицо' }}</StatusTag>
          <StatusTag :tone="active.origin === 'own' ? 'ok' : active.origin === 'partner' ? 'info' : 'warn'" size="sm">{{ originLabel[active.origin] }}</StatusTag>
        </div>
        <p v-if="active.passportMasked" class="mt-3 text-[12.5px] text-muted">Паспорт: {{ active.passportMasked }}</p>
        <p v-if="active.email" class="mt-1 text-[12.5px] text-muted">{{ active.email }}</p>

        <div class="mt-5">
          <p class="mb-2 text-[12.5px] font-bold uppercase tracking-wide text-muted">Заявки</p>
          <p v-if="!activeLeads.length" class="text-[12.5px] text-muted">Заявок нет</p>
          <div v-for="l in activeLeads" :key="l.id" class="border-b border-line py-2 text-[12.5px] last:border-0">{{ l.source }} · {{ fmtDate(l.createdAt) }}</div>
        </div>

        <div class="mt-5">
          <p class="mb-2 text-[12.5px] font-bold uppercase tracking-wide text-muted">Договоры</p>
          <p v-if="!activeContracts.length" class="text-[12.5px] text-muted">Договоров нет</p>
          <NuxtLink v-for="c in activeContracts" :key="c.id" :to="`/contracts/${c.id}`" class="flex items-center justify-between border-b border-line py-2 text-[12.5px] last:border-0 hover:text-plum">
            {{ c.number }} <Icon name="ph:arrow-right" size="13" />
          </NuxtLink>
        </div>
      </template>
    </AppDrawer>

    <AppModal v-model="showCreate" title="Новый клиент">
      <div class="flex flex-col gap-3.5">
        <AppSelect v-model="form.kind" label="Тип" :options="[{ value: 'person', label: 'Физлицо' }, { value: 'company', label: 'Юрлицо' }]" />
        <AppInput v-model="form.name" label="Имя / название" />
        <AppInput v-model="form.phone" label="Телефон" placeholder="+996 700 000 000" />
        <AppButton variant="primary" block @click="createClient">Добавить</AppButton>
      </div>
    </AppModal>
  </div>
</template>

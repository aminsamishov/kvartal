<script setup lang="ts">
definePageMeta({ breadcrumb: [{ label: 'Пользователи' }, { label: 'Офисы продаж' }] })

const settingsStore = useSettingsStore()
const unitsStore = useUnitsStore()
const ui = useUiStore()

const showCreate = ref(false)
const form = reactive({ name: '', address: '', phone: '' })
function create() {
  if (!form.name.trim()) return
  settingsStore.addOffice({ ...form, projectIds: [] })
  ui.toast('Офис добавлен', 'ok')
  showCreate.value = false
  form.name = ''; form.address = ''; form.phone = ''
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-[22px] font-semibold tracking-[-0.025em]">Офисы продаж</h1>
        <p class="mt-1 text-[13px] text-muted">Точки продаж и их привязка к проектам</p>
      </div>
      <AppButton variant="primary" icon="ph:plus-bold" @click="showCreate = true">Новый офис</AppButton>
    </div>

    <div class="grid grid-cols-1 gap-3.5 md:grid-cols-2">
      <div v-for="o in settingsStore.salesOffices" :key="o.id" class="rounded-card border border-line bg-panel p-[18px] shadow-card">
        <div class="flex items-start gap-3">
          <div class="grid h-10 w-10 shrink-0 place-items-center rounded-xl2 bg-plum-soft text-plum"><Icon name="ph:storefront" size="18" /></div>
          <div>
            <h3 class="text-[14.5px] font-semibold tracking-[-0.015em]">{{ o.name }}</h3>
            <p class="mt-0.5 text-[12.5px] text-muted">{{ o.address }}</p>
            <p class="text-[12.5px] text-muted">{{ o.phone }}</p>
          </div>
        </div>
        <div class="mt-3 flex flex-wrap gap-1.5">
          <StatusTag v-for="pid in o.projectIds" :key="pid" tone="neutral" size="sm">{{ unitsStore.project(pid)?.name }}</StatusTag>
        </div>
      </div>
    </div>

    <AppModal v-model="showCreate" title="Новый офис продаж">
      <div class="flex flex-col gap-3.5">
        <AppInput v-model="form.name" label="Название" />
        <AppInput v-model="form.address" label="Адрес" />
        <AppInput v-model="form.phone" label="Телефон" />
        <AppButton variant="primary" block @click="create">Создать</AppButton>
      </div>
    </AppModal>
  </div>
</template>

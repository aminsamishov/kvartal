<script setup lang="ts">
definePageMeta({ breadcrumb: [{ label: 'Настройки', to: '/settings' }, { label: 'Шаблоны документов' }] })

const settingsStore = useSettingsStore()
const ui = useUiStore()

const tab = ref<'templates' | 'variables' | 'builder'>('templates')

// шаблоны
const showCreate = ref(false)
const form = reactive({ name: '', process: '', source: 'Google Документы' as 'Google Документы' | 'LibreOffice', numberFormat: '' })
function createTemplate() {
  if (!form.name.trim()) return
  settingsStore.addTemplate({ ...form, active: true })
  ui.toast('Шаблон добавлен', 'ok')
  showCreate.value = false
  form.name = ''; form.process = ''; form.numberFormat = ''
}

// переменные
const varSearch = ref('')
const varGroup = ref('')
const filteredVars = computed(() => settingsStore.variables.filter((v) => {
  if (varGroup.value && v.group !== varGroup.value) return false
  if (varSearch.value) {
    const q = varSearch.value.toLowerCase()
    return v.name.toLowerCase().includes(q) || v.code.toLowerCase().includes(q)
  }
  return true
}))
function wrapCode(code: string) {
  return '{{' + code + '}}'
}
function copyCode(code: string) {
  const wrapped = wrapCode(code)
  navigator.clipboard?.writeText(wrapped)
  ui.toast(`Скопировано: ${wrapped}`, 'ok')
}

// конструктор условий
const hlpVar = ref('')
const hlpOp = ref<'empty' | 'notempty' | 'eq' | 'gt'>('notempty')
const hlpVal = ref('')
const opLabel = { empty: 'не заполнено', notempty: 'заполнено', eq: 'равно', gt: 'больше' }
const builderOutput = computed(() => {
  if (!hlpVar.value) return ''
  if (hlpOp.value === 'empty') return `{if:${hlpVar.value} empty}…{/if}`
  if (hlpOp.value === 'notempty') return `{if:${hlpVar.value} notempty}…{/if}`
  return `{if:${hlpVar.value} ${hlpOp.value}:${hlpVal.value || '…'}}…{/if}`
})
function copyBuilder() {
  if (!builderOutput.value) return
  navigator.clipboard?.writeText(builderOutput.value)
  ui.toast('Разметка скопирована', 'ok')
}
</script>

<template>
  <SettingsShell title="Шаблоны документов" subtitle="Шаблон правится в Google Документах или LibreOffice — платформа подставляет данные при формировании">
    <Tabs
      v-model="tab" class="mb-4" :tabs="[
        { value: 'templates', label: 'Шаблоны', icon: 'ph:files', count: settingsStore.docTemplates.length },
        { value: 'variables', label: 'Список переменных', icon: 'ph:brackets-curly', count: settingsStore.variables.length },
        { value: 'builder', label: 'Конструктор условий', icon: 'ph:magic-wand' },
      ]"
    />

    <div v-if="tab === 'templates'" class="flex flex-col gap-3.5">
      <div class="flex justify-end"><AppButton variant="primary" icon="ph:plus-bold" @click="showCreate = true">Добавить шаблон</AppButton></div>
      <div class="overflow-x-auto rounded-card border border-line">
        <table class="data-table">
          <thead><tr><th>Шаблон</th><th>Процесс</th><th>Источник</th><th>Формат номера</th><th>Статус</th></tr></thead>
          <tbody>
            <tr v-for="t in settingsStore.docTemplates" :key="t.id">
              <td class="font-medium">{{ t.name }}</td>
              <td>{{ t.process }}</td>
              <td class="text-muted">{{ t.source }}</td>
              <td class="tabular text-muted">{{ t.numberFormat }}</td>
              <td>
                <button @click="settingsStore.toggleTemplate(t.id)">
                  <StatusTag :tone="t.active ? 'ok' : 'neutral'" size="sm" dot>{{ t.active ? 'Активен' : 'Отключён' }}</StatusTag>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-else-if="tab === 'variables'" class="flex flex-col gap-3.5">
      <div class="flex flex-wrap gap-2">
        <AppInput v-model="varSearch" placeholder="Поиск по названию или коду" icon="ph:magnifying-glass" class="w-[240px]" />
        <AppSelect v-model="varGroup" class="w-[200px]" :options="[{ value: '', label: 'Все группы' }, ...settingsStore.variableGroups.map((g) => ({ value: g, label: g }))]" />
      </div>
      <div class="max-h-[480px] overflow-y-auto rounded-card border border-line">
        <table class="data-table">
          <thead><tr><th>Группа</th><th>Название</th><th>Код</th><th>Подсказка</th></tr></thead>
          <tbody>
            <tr v-for="v in filteredVars" :key="v.code" class="cursor-pointer" @click="copyCode(v.code)">
              <td class="text-muted">{{ v.group }}</td>
              <td class="font-medium">{{ v.name }}</td>
              <td class="tabular flex items-center gap-1.5 text-plum">{{ wrapCode(v.code) }} <Icon name="ph:copy" size="13" /></td>
              <td class="text-muted">{{ v.hint }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <AppCard v-else title="Помощник разметки" subtitle="Соберите условие — платформа напишет разметку за вас">
      <div class="flex flex-wrap items-end gap-2.5">
        <AppSelect v-model="hlpVar" label="Переменная" class="w-[220px]" :options="settingsStore.variables.map((v) => ({ value: v.code, label: v.name }))" placeholder="Выберите" />
        <AppSelect v-model="hlpOp" label="Условие" class="w-[160px]" :options="Object.entries(opLabel).map(([v, l]) => ({ value: v, label: l }))" />
        <AppInput v-if="hlpOp === 'eq' || hlpOp === 'gt'" v-model="hlpVal" label="Значение" class="w-[160px]" />
        <AppButton variant="primary" icon="ph:magic-wand" @click="copyBuilder">Получить разметку</AppButton>
      </div>
      <p v-if="builderOutput" class="tabular mt-4 rounded-xl2 bg-soft px-3.5 py-2.5 text-[13px]">{{ builderOutput }}</p>
    </AppCard>

    <AppModal v-model="showCreate" title="Новый шаблон">
      <div class="flex flex-col gap-3.5">
        <AppInput v-model="form.name" label="Название" />
        <AppInput v-model="form.process" label="Процесс" placeholder="Договор, Платёж, Ключи…" />
        <AppSelect v-model="form.source" label="Источник" :options="[{ value: 'Google Документы', label: 'Google Документы' }, { value: 'LibreOffice', label: 'LibreOffice' }]" />
        <AppInput v-model="form.numberFormat" label="Формат номера" placeholder="Д-{год}-{номер:4}" />
        <AppButton variant="primary" block @click="createTemplate">Добавить</AppButton>
      </div>
    </AppModal>
  </SettingsShell>
</template>

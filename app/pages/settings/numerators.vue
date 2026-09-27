<script setup lang="ts">
definePageMeta({ breadcrumb: [{ label: 'Настройки', to: '/settings' }, { label: 'Нумераторы документов' }] })

const settingsStore = useSettingsStore()

const numerators = computed(() => settingsStore.docTemplates.map((t, i) => ({
  process: t.process, template: t.name, format: t.numberFormat, next: 1000 + i * 37,
})))
</script>

<template>
  <SettingsShell title="Нумераторы документов" subtitle="Формат номера и следующее значение для каждого процесса">
    <div class="overflow-x-auto rounded-card border border-line">
      <table class="data-table">
        <thead><tr><th>Процесс</th><th>Шаблон</th><th>Формат</th><th>Следующий номер</th></tr></thead>
        <tbody>
          <tr v-for="n in numerators" :key="n.template">
            <td>{{ n.process }}</td>
            <td class="font-medium">{{ n.template }}</td>
            <td class="tabular text-muted">{{ n.format }}</td>
            <td class="tabular font-semibold">{{ n.next }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="mt-3 text-[12.5px] text-muted">Нумератор увеличивается автоматически при каждой генерации документа и не допускает повторов.</p>
  </SettingsShell>
</template>

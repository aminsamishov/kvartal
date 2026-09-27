<script setup lang="ts">
import type { ClientProfile } from '~/utils/clientProfile'
import { CONTRACT_STATUS_META, DEAL_TYPE_META, UNIT_KIND_META } from '~/utils/meta'
import { fmtDate, money } from '~/utils/format'

/**
 * Договоры клиента: таблица слева, предпросмотр справа. Файл договора уже
 * лежит в документах — здесь он открывается на месте, чтобы сверить сумму
 * и подпись, не уходя в раздел документов.
 */
const props = defineProps<{ profile: ClientProfile }>()

const unitsStore = useUnitsStore()

const rows = computed(() => props.profile.contracts.map((c) => {
  const units = c.unitIds.map((id) => unitsStore.unit(id)).filter((u): u is NonNullable<typeof u> => !!u)
  const first = units[0]
  return {
    contract: c,
    units,
    project: first ? unitsStore.project(first.projectId)?.name ?? '—' : '—',
    unitsLabel: units.length ? units.map((u) => `№ ${u.number}`).join(', ') : '—',
    kindLabel: first ? UNIT_KIND_META[first.kind].label : '—',
    doc: props.profile.documents.find((d) => d.contractId === c.id && d.kind === 'contract'),
  }
}))

const activeId = ref<string>('')
watchEffect(() => {
  if (!rows.value.some((r) => r.contract.id === activeId.value)) activeId.value = rows.value[0]?.contract.id ?? ''
})
const active = computed(() => rows.value.find((r) => r.contract.id === activeId.value))
</script>

<template>
  <div v-if="rows.length" class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
    <AppCard :padded="false">
      <div class="overflow-x-auto">
        <table class="data-table">
          <thead>
            <tr><th>Номер</th><th>ЖК</th><th>Помещение</th><th>Дата</th><th class="text-right">Стоимость</th><th>PDF</th><th>Статус</th></tr>
          </thead>
          <tbody>
            <tr
              v-for="r in rows" :key="r.contract.id" class="cursor-pointer"
              :class="activeId === r.contract.id ? 'bg-plum-soft/50' : ''"
              @click="activeId = r.contract.id"
            >
              <td class="tabular font-semibold">{{ r.contract.number }}</td>
              <td class="truncate">{{ r.project }}</td>
              <td class="tabular">
                {{ r.unitsLabel }}
                <span class="ml-1 text-[11px] font-normal text-muted">{{ r.kindLabel }}</span>
              </td>
              <td class="tabular">{{ fmtDate(r.contract.signedAt ?? r.contract.createdAt) }}</td>
              <td class="tabular text-right font-semibold">{{ money(r.contract.price, r.contract.currency) }}</td>
              <td>
                <a
                  v-if="r.doc" :href="r.doc.url" :download="r.doc.name" class="grid h-7 w-7 place-items-center rounded-lg text-muted hover:text-plum"
                  :title="`Скачать ${r.doc.name}`" @click.stop
                ><Icon name="ph:file-pdf" size="15" /></a>
                <span v-else class="text-muted">—</span>
              </td>
              <td><StatusTag :tone="CONTRACT_STATUS_META[r.contract.status].tone" size="sm" dot>{{ CONTRACT_STATUS_META[r.contract.status].label }}</StatusTag></td>
            </tr>
          </tbody>
        </table>
      </div>
    </AppCard>

    <!-- предпросмотр -->
    <AppCard v-if="active" :padded="false">
      <div class="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
        <div class="min-w-0">
          <p class="tabular truncate text-[14px] font-semibold text-ink">{{ active.contract.number }}</p>
          <p class="truncate text-[11.5px] text-muted">
            {{ DEAL_TYPE_META[active.contract.dealType] }}
            <template v-if="active.contract.bank"> · {{ active.contract.bank }}</template>
          </p>
        </div>
        <AppButton size="sm" icon="ph:arrow-square-out" @click="navigateTo(`/contracts/${active.contract.id}`)">Открыть</AppButton>
      </div>

      <div class="p-4">
        <FilePreview
          v-if="active.doc" :url="active.doc.url" :mime="active.doc.mime" :name="active.doc.name"
          height="min(46vh, 420px)"
        />
        <EmptyState
          v-else compact icon="ph:file-dashed" title="Файл договора не приложен"
          text="Сформируйте документ из шаблона — он появится здесь и в Data Room"
        />

        <dl class="mt-3">
          <div v-for="row in [
            ['Стоимость', money(active.contract.price, active.contract.currency)],
            ['Скидка', active.contract.discount ? `${active.contract.discount}%` : '—'],
            ['Оформление', active.contract.route === 'company' ? 'Через компанию' : active.contract.route === 'notary' ? 'Нотариус' : 'Госрегистр'],
            ['Помещения', active.unitsLabel],
            ['Подписан', active.contract.signedAt ? fmtDate(active.contract.signedAt) : '—'],
          ]" :key="row[0]" class="flex items-baseline justify-between gap-3 border-b border-line py-1.5 last:border-0"
          >
            <dt class="text-[12px] text-muted">{{ row[0] }}</dt>
            <dd class="tabular truncate text-right text-[12.5px] font-medium text-ink">{{ row[1] }}</dd>
          </div>
        </dl>
      </div>
    </AppCard>
  </div>

  <EmptyState v-else icon="ph:file-text" title="Договоров нет" text="Клиент ещё не покупал — договор появится здесь после оформления сделки" />
</template>

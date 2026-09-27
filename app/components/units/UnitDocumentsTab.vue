<script setup lang="ts">
import type { DocKind, Unit } from '~/types/models'
import { fileToObjectUrl } from '~/composables/useFileUpload'

/**
 * Документы по помещению. Отдельного хранилища у квартиры нет и не нужно:
 * документы принадлежат клиенту и договору, а карточка показывает те из них,
 * что относятся к этой сделке. Так реестр остаётся один.
 */
const props = defineProps<{ unit: Unit }>()

const salesStore = useSalesStore()
const dealsStore = useDealsStore()
const auth = useAuthStore()
const ui = useUiStore()

const contract = computed(() => (props.unit.contractId ? dealsStore.contract(props.unit.contractId) : undefined))
const reservation = computed(() => salesStore.reservationForUnit(props.unit.id))
const clientId = computed(() => contract.value?.clientId ?? reservation.value?.clientId ?? '')
const client = computed(() => (clientId.value ? salesStore.client(clientId.value) : undefined))

const docs = computed(() => {
  if (!clientId.value) return []
  const all = salesStore.documentsForClient(clientId.value)
  // по договору — только его документы; до договора показываем всё досье
  return contract.value ? all.filter((d) => !d.contractId || d.contractId === contract.value!.id) : all
})

function upload({ files, kind }: { files: File[]; kind: DocKind }) {
  if (!clientId.value) { ui.toast('Документы появятся, когда у помещения будет клиент', 'warn'); return }
  for (const file of files) {
    salesStore.addDocument({
      clientId: clientId.value,
      contractId: contract.value?.id,
      leadId: reservation.value?.leadId ?? contract.value?.leadId,
      kind, name: file.name, url: fileToObjectUrl(file),
      mime: file.type || 'application/octet-stream', sizeBytes: file.size,
      uploadedBy: auth.user?.name ?? 'Система',
    })
  }
  ui.toast(files.length > 1 ? `Загружено файлов: ${files.length}` : 'Файл загружен', 'ok')
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <p v-if="client" class="flex items-center gap-1.5 rounded-xl2 bg-soft px-3 py-2 text-[12px] text-muted">
      <Icon name="ph:user" size="13" />
      Досье клиента <b class="text-ink">{{ client.name }}</b>
      <template v-if="contract"> · договор {{ contract.number }}</template>
    </p>

    <DataRoom
      v-if="clientId" :documents="docs"
      :required="['passport', 'contract']"
      empty-hint="По этой сделке файлов пока нет — загрузите паспорт или договор"
      @upload="upload"
      @remove="salesStore.removeDocument($event)"
      @toggle-signed="salesStore.toggleDocumentSigned($event)"
      @set-kind="salesStore.setDocumentKind($event.id, $event.kind)"
    />

    <EmptyState
      v-else compact icon="ph:folder-simple-dashed" title="Помещение свободно"
      text="Документы привязаны к клиенту: они появятся после брони или договора"
    />
  </div>
</template>

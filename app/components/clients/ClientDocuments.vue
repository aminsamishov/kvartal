<script setup lang="ts">
import type { DocKind } from '~/types/models'
import type { ClientProfile } from '~/utils/clientProfile'
import { fileToObjectUrl } from '~/composables/useFileUpload'

/**
 * Data Room клиента. Хранилище то же, что у заявки, поэтому и компонент тот
 * же — здесь только привязка новых файлов к клиенту и его текущему договору.
 */
const props = defineProps<{ profile: ClientProfile }>()

const salesStore = useSalesStore()
const auth = useAuthStore()
const ui = useUiStore()

const REQUIRED: DocKind[] = ['passport', 'contract']

function upload({ files, kind }: { files: File[]; kind: DocKind }) {
  const contractId = props.profile.contracts[0]?.id
  for (const file of files) {
    salesStore.addDocument({
      clientId: props.profile.client.id,
      contractId: kind === 'contract' || kind === 'annex' || kind === 'receipt' ? contractId : undefined,
      kind,
      name: file.name,
      url: fileToObjectUrl(file),
      mime: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      uploadedBy: auth.user?.name ?? 'Система',
    })
  }
  ui.toast(files.length > 1 ? `Загружено файлов: ${files.length}` : 'Файл загружен', 'ok')
}
</script>

<template>
  <AppCard :padded="false">
    <div class="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
      <h3 class="text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">
        Документы клиента
        <span v-if="profile.documents.length" class="tabular ml-1 rounded-full bg-soft px-1.5 py-0.5 text-[11px] text-ink">
          {{ profile.documents.length }}
        </span>
      </h3>
      <p class="text-[11.5px] text-muted">Файлы по всем заявкам и договорам этого клиента</p>
    </div>

    <div class="p-4">
      <DataRoom
        :documents="profile.documents" :required="REQUIRED"
        empty-hint="Документов нет — загрузите паспорт, договор или квитанцию"
        @upload="upload"
        @remove="salesStore.removeDocument($event)"
        @toggle-signed="salesStore.toggleDocumentSigned($event)"
        @set-kind="salesStore.setDocumentKind($event.id, $event.kind)"
      />
    </div>
  </AppCard>
</template>

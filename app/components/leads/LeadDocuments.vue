<script setup lang="ts">
import type { DocKind } from '~/types/models'
import { fileToObjectUrl } from '~/composables/useFileUpload'

/**
 * Документы заявки. Вся механика — в общем Data Room; здесь только привязка
 * файлов к заявке и клиенту, потому что кто владелец документа, знает
 * вызывающая сторона, а не хранилище.
 */
const props = defineProps<{ leadId: string; clientId: string }>()

const salesStore = useSalesStore()
const auth = useAuthStore()
const ui = useUiStore()

const docs = computed(() => salesStore.documentsForLead(props.leadId))

function upload({ files, kind }: { files: File[]; kind: DocKind }) {
  for (const file of files) {
    salesStore.addDocument({
      clientId: props.clientId, leadId: props.leadId, kind,
      name: file.name, url: fileToObjectUrl(file),
      mime: file.type || 'application/octet-stream', sizeBytes: file.size,
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
        Документы
        <span v-if="docs.length" class="tabular ml-1 rounded-full bg-soft px-1.5 py-0.5 text-[11px] text-ink">{{ docs.length }}</span>
      </h3>
    </div>

    <div class="p-4">
      <DataRoom
        :documents="docs"
        @upload="upload"
        @remove="salesStore.removeDocument($event)"
        @toggle-signed="salesStore.toggleDocumentSigned($event)"
        @set-kind="salesStore.setDocumentKind($event.id, $event.kind)"
      />
    </div>
  </AppCard>
</template>

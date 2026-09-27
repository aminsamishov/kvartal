<script setup lang="ts">
import type { ClientDocument, DocKind } from '~/types/models'
import { DOC_KINDS, DOC_KIND_META } from '~/utils/meta'
import { fmtDate } from '~/utils/format'
import { fileToObjectUrl, pickFiles } from '~/composables/useFileUpload'

const props = defineProps<{ leadId: string; clientId: string }>()

const salesStore = useSalesStore()
const auth = useAuthStore()
const ui = useUiStore()

const docs = computed(() => salesStore.documentsForLead(props.leadId))
const preview = ref<ClientDocument | null>(null)

function sizeLabel(bytes: number) {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} МБ` : `${Math.round(bytes / 1024)} КБ`
}

async function upload(kind: DocKind) {
  const files = await pickFiles('image/*,application/pdf', true)
  if (!files.length) return
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

const uploadOpen = ref(false)
</script>

<template>
  <AppCard id="sec-docs" :padded="false">
    <div class="flex items-center justify-between gap-3 px-4 pt-4">
      <h3 class="text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">
        Документы
        <span v-if="docs.length" class="tabular ml-1 rounded-full bg-soft px-1.5 py-0.5 text-[11px] text-ink">{{ docs.length }}</span>
      </h3>
      <AppButton size="sm" icon="ph:upload-simple" @click="uploadOpen = !uploadOpen">Загрузить</AppButton>
    </div>

    <div class="p-4">
      <div v-if="uploadOpen" class="mb-3 rounded-xl2 border border-plum bg-plum-soft/40 p-3">
        <p class="mb-2 text-[12px] font-medium text-muted">Что загружаем?</p>
        <div class="flex flex-wrap gap-1.5">
          <Chip v-for="k in DOC_KINDS" :key="k" :icon="DOC_KIND_META[k].icon" @click="upload(k); uploadOpen = false">
            {{ DOC_KIND_META[k].label }}
          </Chip>
        </div>
        <p class="mt-2 text-[11px] text-muted">Изображения и PDF. Превью откроется прямо здесь.</p>
      </div>

      <div v-if="docs.length" class="flex flex-col gap-1.5">
        <div
          v-for="d in docs" :key="d.id"
          class="group flex items-center gap-2.5 rounded-xl2 border border-line p-2 transition-colors hover:border-plum/40"
        >
          <button
            type="button" class="focus-ring h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-line bg-soft"
            title="Открыть превью" @click="preview = d"
          >
            <img v-if="d.mime.startsWith('image/')" :src="d.url" class="h-full w-full object-cover" :alt="d.name">
            <span v-else class="grid h-full w-full place-items-center text-muted"><Icon name="ph:file-pdf" size="18" /></span>
          </button>

          <div class="min-w-0 flex-1">
            <p class="truncate text-[12.5px] font-medium text-ink">{{ d.name }}</p>
            <p class="truncate text-[11px] text-muted">
              {{ DOC_KIND_META[d.kind].label }} · {{ sizeLabel(d.sizeBytes) }} · {{ fmtDate(d.uploadedAt) }}
            </p>
          </div>

          <button
            type="button"
            class="focus-ring shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold transition-colors"
            :class="d.signed ? 'bg-ok-bg text-ok' : 'bg-warn-bg text-warn'"
            :title="d.signed ? 'Отметить как неподписанный' : 'Отметить подписанным'"
            @click="salesStore.toggleDocumentSigned(d.id)"
          >
            <Icon :name="d.signed ? 'ph:check-circle' : 'ph:clock'" size="11" class="mr-0.5 inline" />
            {{ d.signed ? 'Подписан' : 'Не подписан' }}
          </button>

          <div class="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <a :href="d.url" :download="d.name" class="grid h-7 w-7 place-items-center rounded-lg text-muted hover:text-ink" title="Скачать">
              <Icon name="ph:download-simple" size="14" />
            </a>
            <button class="grid h-7 w-7 place-items-center rounded-lg text-muted hover:text-bad" title="Удалить" @click="salesStore.removeDocument(d.id)">
              <Icon name="ph:trash" size="14" />
            </button>
          </div>
        </div>
      </div>

      <p v-else class="flex items-center gap-2 rounded-xl2 border border-dashed border-line px-3 py-2.5 text-[12.5px] text-muted">
        <Icon name="ph:paperclip" size="15" /> Документов нет — загрузите паспорт или договор
      </p>
    </div>

    <AppModal :model-value="!!preview" :title="preview?.name" width="lg" @update:model-value="preview = null">
      <FilePreview v-if="preview" :url="preview.url" :mime="preview.mime" :name="preview.name" height="min(70vh, 640px)" />
      <div v-if="preview" class="mt-3 flex items-center gap-2">
        <StatusTag :tone="preview.signed ? 'ok' : 'warn'" size="sm">{{ preview.signed ? 'Подписан' : 'Не подписан' }}</StatusTag>
        <span class="text-[12px] text-muted">{{ DOC_KIND_META[preview.kind].label }} · загрузил {{ preview.uploadedBy }}</span>
        <a :href="preview.url" :download="preview.name" class="ml-auto"><AppButton size="sm" icon="ph:download-simple">Скачать</AppButton></a>
      </div>
    </AppModal>
  </AppCard>
</template>
